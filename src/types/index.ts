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
  cart?: string;
  cart_sig?: string;
  assistantId?: number;
  endUserId?: string;
  variantId?: number;
  quantity?: number;
  event?: string;
}

export interface CustomCSSProperties {
  bottom?: string;
  right?: string;
}
