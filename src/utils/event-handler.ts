import { addToCart, getCart, updateCartAttributes } from "./api.ts";

const CART_DETAILS_RESPONSE = "alphablocks-get-cart-details-response";
const ADD_PRODUCT_TO_CART_RESPONSE = "alphablocks-add-product-to-cart-response";

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
    const newAttrs = {
      "asa.alphablocks.ai_assistant_id": assistantId.toString(),
      "asa.alphablocks.ai_end_user_id": endUserId,
    };

    const cart = await getCart();
    const updatedAttrs = { ...(cart.attributes || {}), ...newAttrs };

    const payload = {
      attributes: updatedAttrs,
      note: cart.item_count === 0 ? "init" : undefined,
    };

    await updateCartAttributes(payload);
  } catch (err) {
    console.error("❌ handleSetCartAttributes error:", err);
  }
}

// 🔹 3. Add product to cart (returns updated cart in message)
export async function handleAddProductToCart(
  variantId: number | undefined,
  quantity: number = 1,
  iframe: HTMLIFrameElement | null,
): Promise<void> {
  if (!variantId || !iframe || !iframe.contentWindow) return;
  try {
    // 1️⃣ Get current cart
    const cartBefore = await getCart();
    const existingAttrs = cartBefore.attributes || {};
    const existingLineItemsAttr = existingAttrs["asa.alphablocks.ai_line_items"] || "";
    const trackedItems = existingLineItemsAttr
      ? existingLineItemsAttr
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    // 2️⃣ Add product to cart
    await addToCart(variantId, quantity);

    // 3️⃣ Update tracked line items (add only new variantId if not tracked)
    const updatedLineItems = new Set(trackedItems);
    updatedLineItems.add(variantId.toString());

    // 4️⃣ Prepare new attributes
    const updatedAttrs = {
      ...existingAttrs,
      "asa.alphablocks.ai_line_items": Array.from(updatedLineItems).join(", "),
    };

    // 5️⃣ Update attributes on cart
    await updateCartAttributes({ attributes: updatedAttrs });

    // 6️⃣ Fetch the latest cart (optional but cleaner for response)
    const updatedCart = await getCart();

    // 7️⃣ Respond back to widget
    iframe.contentWindow.postMessage(
      {
        type: ADD_PRODUCT_TO_CART_RESPONSE,
        data: {
          success: true,
          cart: { ...updatedCart, attributes: updatedAttrs },
        },
      },
      "*",
    );
  } catch (error) {
    console.error("❌ handleAddProductToCart error:", error);
    iframe.contentWindow.postMessage(
      {
        type: ADD_PRODUCT_TO_CART_RESPONSE,
        data: { success: false, error: (error as Error).message },
      },
      "*",
    );
  }
}
