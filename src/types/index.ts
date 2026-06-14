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
  variantId?: number;
  quantity?: number;
  event?: string;
  frameBorderRadius?: string;
  marginBottom?: string;
  marginTop?: string;
  marginRight?: string;
  query?: string;
  searchQuery?: string;
  hasProducts?: boolean;
  productCount?: number;
  success?: boolean;
  error?: string;
}

export interface CustomCSSProperties {
  bottom?: string;
  right?: string;
  left?: string;
  top?: string;
}
