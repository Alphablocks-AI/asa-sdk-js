export type AlphaBlocksConstructor = {
  token: string;
  name: string;
  avatar: string;
  bgColor: string;
  textColor: string;
};

export type HandleEventProps = {
  type: string;
  data: IFrameDimensions;
};

export type IFrameDimensions = {
  width?: string;
  height?: string;
};
