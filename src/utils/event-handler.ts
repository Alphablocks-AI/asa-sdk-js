import { addToCart, getCart, getSearchProductsCount } from "./api.ts";
import {
  buildAsaCartAttributes,
  persistCartAttributes,
  syncCartAttributes,
} from "./cart-attributes.ts";

const CART_DETAILS_RESPONSE = "alphablocks-get-cart-details-response";
const ADD_PRODUCT_TO_CART_RESPONSE = "alphablocks-add-product-to-cart-response";
const SEARCH_PRODUCTS_RESPONSE = "alphablocks-check-search-products-response";

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
  try {
    const cart = await getCart();
    iframe.contentWindow.postMessage(
      {
        type: CART_DETAILS_RESPONSE,
        data: cart,
      },
      "*",
    );
  } catch (err) {
    console.error("handleGetCartDetails error:", err);
    iframe.contentWindow.postMessage(
      {
        type: CART_DETAILS_RESPONSE,
        data: {
          items: [],
          item_count: 0,
          total_price: 0,
          items_subtotal_price: 0,
          discount_codes: [],
          cart_level_discount_applications: [],
          attributes: {},
        },
      },
      "*",
    );
  }
}

// 🔹 2. Update only attributes (no response returned)
export async function handleSetCartAttributes(
  assistantId: number | null,
  endUserId: string,
  sessionId?: string,
): Promise<void> {
  await syncCartAttributes({
    assistantId,
    endUserId,
    sessionId,
  });
}

// 🔹 3. Add product to cart (returns updated cart in message)
export async function handleAddProductToCart(
  variantId: number | undefined,
  quantity: number = 1,
  iframe: HTMLIFrameElement | null,
  assistantId: number | null,
  endUserId: string,
  sessionId?: string,
): Promise<void> {
  if (!variantId || !iframe?.contentWindow) return;

  try {
    // 1) Add item to cart
    await addToCart(variantId, quantity);

    // 2) Read the cart (source of truth)
    const cart = await getCart();
    const existingAttrs = (cart.attributes ?? {}) as Record<string, string>;
    const updatedAttrs = buildAsaCartAttributes(existingAttrs, {
      assistantId,
      endUserId,
      sessionId,
      variantIdsToAppend: [variantId],
    });

    // 3) Persist attributes
    await persistCartAttributes(cart.item_count ?? 0, updatedAttrs);

    // 4) Refresh storefront cart UI silently (theme-agnostic)
    await refreshCartUI();

    // 5) Fetch final cart state (after attributes + UI refresh)
    const finalCart = await getCart();

    // 6) Post success response back to iframe
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

/** Storefront `/cart/add.js` (or section `items_added`) — sync attributes without adding via SDK. */
export async function handleStorefrontCartLineAdded(
  assistantId: number | null,
  endUserId: string,
  sessionId: string | undefined,
  variantIds: number[],
): Promise<void> {
  if (!variantIds.length) return;

  await syncCartAttributes({
    assistantId,
    endUserId,
    sessionId,
    variantIdsToAppend: variantIds,
  });
}

export async function handleCheckSearchProducts(
  query: string,
  iframe: HTMLIFrameElement | null,
): Promise<void> {
  if (!iframe?.contentWindow) return;

  try {
    const { hasProducts, productCount } = await getSearchProductsCount(query);
    iframe.contentWindow.postMessage(
      {
        type: SEARCH_PRODUCTS_RESPONSE,
        data: {
          success: true,
          query,
          hasProducts,
          productCount,
        },
      },
      "*",
    );
  } catch (err) {
    iframe.contentWindow.postMessage(
      {
        type: SEARCH_PRODUCTS_RESPONSE,
        data: {
          success: false,
          query,
          hasProducts: false,
          productCount: 0,
          error: (err as Error).message || String(err),
        },
      },
      "*",
    );
  }
}
