/**
 * Intercepted cart lines → iframe: only these two event names (SDK + widget).
 */
export const CART_AJAX_EVENT = {
  PRODUCT_ADDED: "product_added_to_cart",
  PRODUCT_REMOVED: "product_removed_from_cart",
} as const;

export type CartAjaxEventName = (typeof CART_AJAX_EVENT)[keyof typeof CART_AJAX_EVENT];
