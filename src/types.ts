export type AlphaBlocksConstructor = {
  token: string;
  theme?: string;
  name?: string;
  id?: number;
  avatar?: string;
  bgColor?: string;
  textColor?: string;
};

export type HandleEventProps = {
  type: string;
  data: IFrameDimensions;
};

export type IFrameDimensions = {
  width?: string;
  height?: string;
  bottom?: string;
  right?: string;
  left?: string;
};

export type AssistantProperties = {
  id: string;
  name: string;
  color: string;
  avatar: string;
  placeholder: string;
  alphablock_branding: boolean;
  widget_open: boolean;
  response_length: string;
  email_support: string;
  language: {
    name: string;
    code: string;
  };
  text_color: string;
  token: string;
  theme: string;
  position: string;
};
