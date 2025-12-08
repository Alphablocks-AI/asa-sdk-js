import { addToCart, getCart, updateCartAttributes } from "./api.ts";

const CART_DETAILS_RESPONSE = "alphablocks-get-cart-details-response";
const ADD_PRODUCT_TO_CART_RESPONSE = "alphablocks-add-product-to-cart-response";

// 🔹 0. Refresh cart UI
export async function refreshCartUI(): Promise<void> {
  try {
    const cart = await fetch("/cart.js").then((r) => r.json());

    // 1) Try section-based refresh (most reliable)
    const drawer =
      document.querySelector("cart-drawer, cart-drawer-component, .cart-drawer, #cart-drawer") ||
      document.querySelector("[id*='cart'][id^='shopify-section-']");

    const drawerSection = drawer?.closest("[id^='shopify-section-']");

    if (drawerSection) {
      const sectionId = drawerSection.id.replace("shopify-section-", "");
      const url = `/?sections=${sectionId}`;

      const json = await fetch(url).then((r) => r.json());
      if (json?.[sectionId]) {
        drawerSection.innerHTML = json[sectionId];
        return;
      }
    }

    // 2) Try Dawn / OS2.0 event
    document.dispatchEvent(new CustomEvent("cart:refresh", { detail: cart }));

    // 3) Last fallback – no-op update.js forces refresh
    const key = cart.items?.[0]?.key;
    if (key) {
      await fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: { [key]: cart.items[0].quantity },
        }),
      });
    }
  } catch (err) {
    console.error("refreshCartUI() failed", err);
  }
}

// 🔹 1. Get cart details (returns cart in message)
export async function handleGetCartDetails(iframe: HTMLIFrameElement | null) {
  if (!iframe || !iframe.contentWindow) return;
  const cart = await getCart();
  iframe.contentWindow.postMessage(
    {
      type: CART_DETAILS_RESPONSE,
      data: cart,
    },
    "*",
  );
}

// 🔹 2. Update only attributes (no response returned)
export async function handleSetCartAttributes(
  assistantId: number | null,
  endUserId: string,
): Promise<void> {
  if (!assistantId || !endUserId) return;

  try {
    // 1️⃣ Get initial cart
    let cart = await getCart();

    // 2️⃣ Build new attributes
    const newAttrs = {
      "asa.alphablocks.ai_assistant_id": assistantId.toString(),
      "asa.alphablocks.ai_end_user_id": endUserId,
    };
    const mergedAttrs = { ...(cart.attributes || {}), ...newAttrs };

    // 4️⃣ Ensure cart exists before setting attributes
    const payload =
      cart.item_count === 0
        ? { note: "init_cart", attributes: mergedAttrs }
        : { attributes: mergedAttrs };

    // 5️⃣ First attempt
    await updateCartAttributes(payload);

    // 6️⃣ Validate
    cart = await getCart();
    const updatedAttrs = cart.attributes || {};

    let needsRetry = false;
    for (const k of Object.keys(newAttrs)) {
      if (updatedAttrs[k as keyof typeof updatedAttrs] !== newAttrs[k as keyof typeof newAttrs]) {
        needsRetry = true;
        break;
      }
    }

    // 7️⃣ Retry ONCE only
    if (needsRetry) {
      await updateCartAttributes(payload);
    }
  } catch (err) {
    console.error("handleSetCartAttributes error:", err);
  }
}

// 🔹 3. Add product to cart (returns updated cart in message)
export async function handleAddProductToCart(
  variantId: number | undefined,
  quantity: number = 1,
  iframe: HTMLIFrameElement | null,
  assistantId: number | null,
  endUserId: string,
): Promise<void> {
  if (!variantId || !iframe?.contentWindow) return;

  try {
    // 1) Add item to cart
    await addToCart(variantId, quantity);

    // 2) Read the cart (source of truth)
    const cart = await getCart();
    // 3) Get existing line items
    const existingLineItems = cart.attributes?.["asa.alphablocks.ai_line_items"] || "";

    // 4) Prepare attributes merging existing attributes on cart
    const existingAttrs = cart.attributes || {};
    const updatedAttrs: Record<string, string> = {
      ...existingAttrs,
      "asa.alphablocks.ai_line_items": existingLineItems
        ? `${existingLineItems}, ${variantId}`
        : `${variantId}`,
    };

    // 4.1) Ensure assistant/end-user attributes exist:
    //      - If they already exist on the cart, leave them as-is
    //      - If missing AND we have values, add them
    if (assistantId && endUserId) {
      if (!updatedAttrs["asa.alphablocks.ai_assistant_id"]) {
        updatedAttrs["asa.alphablocks.ai_assistant_id"] = assistantId.toString();
      }
      if (!updatedAttrs["asa.alphablocks.ai_end_user_id"]) {
        updatedAttrs["asa.alphablocks.ai_end_user_id"] = endUserId;
      }
    }

    // 5) Persist attributes using the correct payload shape
    //    updateCartAttributes expects { attributes: Record<string,string>, note?: string }
    await updateCartAttributes({ attributes: updatedAttrs });

    // 6) Refresh storefront cart UI silently (theme-agnostic)
    await refreshCartUI();

    // 7) Fetch final cart state (after attributes + UI refresh)
    const finalCart = await getCart();

    // 8) Post success response back to iframe
    iframe.contentWindow.postMessage(
      {
        type: ADD_PRODUCT_TO_CART_RESPONSE,
        data: {
          success: true,
          cart: { ...finalCart, attributes: updatedAttrs },
        },
      },
      "*",
    );
  } catch (err) {
    console.error("❌ handleAddProductToCart error:", err);
    iframe.contentWindow.postMessage(
      {
        type: ADD_PRODUCT_TO_CART_RESPONSE,
        data: { success: false, error: (err as Error).message || String(err) },
      },
      "*",
    );
  }
}
