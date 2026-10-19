declare global {
  interface Window {
    alphablocksConfig?: {
      token?: string;
      /** Logged-in user id (e.g. Shopify `customer.id`) passed to the widget session API. */
      userId?: string | number;
      /** @default false. Set true to restore previous full-page reload after cart cookies are stored (Shopify compatibility). */
      reloadOnCartCookieStore?: boolean;
    };
    /** Optional; embed reads this if `data-user-id` is not on the script tag. */
    ALPHABLOCKS_USER_ID?: string | number;
  }
}

export interface AlphaBlocksConstructor {
  token: string;
  name?: string;
  avatar?: string;
  bgColor?: string;
  textColor?: string;
  theme?: string;
  id?: number | null;
  endUserId?: string;
  userId?: string;
  /** Shopify Liquid `customer.first_name` from App Embed (optional). */
  userFirstName?: string;
  /** Shopify Liquid `customer.orders_count` from App Embed (optional). */
  userOrdersCount?: number;
}

export interface EventDataType {
  height?: string;
  width?: string;
  right?: string;
  bottom?: string;
  left?: string;
  top?: string;
  cart?: string;
  cart_sig?: string;
  assistantId?: number;
  endUserId?: string;
  sessionId?: string;
  variantId?: number;
  quantity?: number;
  /**
   * Widget ATC provenance for `asa.alphablocks.ai_source_note`
   * (e.g. `cart-carousel-nudge-123`). Appended as a comma-separated list.
   */
  sourceNote?: string;
  event?: string;
  frameBorderRadius?: string;
  marginBottom?: string;
  marginTop?: string;
  marginRight?: string;
  query?: string;
  searchQuery?: string;
  handle?: string;
  /** Shopify product id (numeric or GID) for recommendations Ajax. */
  productId?: string;
  /** Shopify recommendations intent: `related` | `complementary`. */
  intent?: string;
  limit?: number;
  hasProducts?: boolean;
  productCount?: number;
  success?: boolean;
  error?: string;
  product?: {
    id?: number;
    title?: string;
    handle?: string;
    price?: number;
  } | null;
  /** Slim rows from `/recommendations/products.json`. */
  products?: Array<{
    id: string;
    title: string;
    imageUrl?: string | null;
    onlineStoreUrl?: string | null;
    priceDisplay?: string | null;
    variantId?: string | null;
  }>;
}

export interface CustomCSSProperties {
  bottom?: string;
  right?: string;
  left?: string;
  top?: string;
}
