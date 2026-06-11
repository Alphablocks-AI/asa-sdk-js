import { ALPHABLOCKS_FRAME_WRAPPER_CLASS, ALPHABLOCKS_WRAPPER_ID } from "../constants/index.ts";
import { CustomCSSProperties } from "../types/index.ts";

// Store the current position to prevent it from being overwritten by setIframeSize
let currentPosition: string = "bottom-right";
let customOffsets: CustomCSSProperties = {};

export function getElement(container: string | HTMLElement): HTMLElement {
  if (typeof container === "string") {
    const element = document.getElementById(container);
    if (!element) throw new Error("Container not found");
    return element;
  }
  return container;
}

const FRAME_WRAPPER_AWAITING_REVEAL_ATTR = "data-alphablocks-awaiting-reveal";

export const FRAME_WRAPPER_DEFAULT_BOX_SHADOW = "rgba(9, 14, 21, 0.16) 0px 5px 40px 0px";

export const WRAPPER_EDGE_OFFSET_DESKTOP = "24px";
export const WRAPPER_EDGE_OFFSET_MOBILE = "16px";

export type ContainerOffsetPositionOpts = {
  isMobile?: boolean;
  bottom?: string;
  right?: string;
  left?: string;
};

/** Flush to viewport corner — nudges; page offset lives inside the iframe padding. */
export function applyContainerCornerPosition(container: HTMLElement, position: string): void {
  container.style.top = "";
  container.style.bottom = "0";
  container.style.margin = "";

  switch (position) {
    case "bottom-left":
      container.style.left = "0";
      container.style.right = "";
      container.style.transform = "";
      break;
    case "bottom-center":
      container.style.left = "50%";
      container.style.right = "";
      container.style.transform = "translateX(-50%)";
      break;
    default:
      container.style.right = "0";
      container.style.left = "";
      container.style.transform = "";
      break;
  }
}

/** Fixed corner placement with right/bottom/left offsets (pill + chat). */
export function applyContainerOffsetPosition(
  container: HTMLElement,
  position: string,
  opts: ContainerOffsetPositionOpts = {},
): void {
  const defaultOffset = opts.isMobile ? WRAPPER_EDGE_OFFSET_MOBILE : WRAPPER_EDGE_OFFSET_DESKTOP;
  const custom = getCustomOffsets();

  container.style.top = "";
  container.style.margin = "";
  container.style.bottom = opts.bottom ?? custom.bottom ?? defaultOffset;

  switch (position) {
    case "bottom-left":
      container.style.left = opts.left ?? custom.left ?? defaultOffset;
      container.style.right = "";
      container.style.transform = "";
      break;
    case "bottom-center":
      container.style.left = "50%";
      container.style.right = "";
      container.style.transform = "translateX(-50%)";
      break;
    default:
      container.style.right = opts.right ?? custom.right ?? defaultOffset;
      container.style.left = "";
      container.style.transform = "";
      break;
  }
}

function applyFrameWrapperStyles(frameWrapper: HTMLElement): void {
  frameWrapper.style.boxShadow = FRAME_WRAPPER_DEFAULT_BOX_SHADOW;
  // border-radius is set from widget theme via alphablocks-resize `frameBorderRadius`
  frameWrapper.style.background = "transparent";
  frameWrapper.style.overflow = "hidden";
  frameWrapper.style.display = "block";
  frameWrapper.style.width = "fit-content";
  frameWrapper.style.height = "fit-content";
  frameWrapper.style.transition = "none";
  hideFrameWrapperUntilReady(frameWrapper);
}

/** Hide host chrome until the widget paints and posts theme-sized autosize (frameBorderRadius). */
export function hideFrameWrapperUntilReady(frameWrapper: HTMLElement): void {
  frameWrapper.style.visibility = "hidden";
  frameWrapper.setAttribute(FRAME_WRAPPER_AWAITING_REVEAL_ATTR, "true");
}

export function revealFrameWrapper(frameWrapper: HTMLElement): void {
  if (!frameWrapper.hasAttribute(FRAME_WRAPPER_AWAITING_REVEAL_ATTR)) return;
  frameWrapper.removeAttribute(FRAME_WRAPPER_AWAITING_REVEAL_ATTR);
  frameWrapper.style.visibility = "visible";
}

export function syncFrameWrapperSize(frameWrapper: HTMLElement, iframe: HTMLIFrameElement): void {
  frameWrapper.style.width = iframe.style.width;
  frameWrapper.style.height = iframe.style.height;
}

/** Nudges render their own shadows inside the iframe — host chrome stays transparent. */
export function applyFrameWrapperChrome(
  frameWrapper: HTMLElement,
  iframe: HTMLIFrameElement,
  containerDiv: HTMLElement,
  opts: { isNudge: boolean },
): void {
  iframe.style.background = "transparent";
  containerDiv.style.background = "transparent";

  if (opts.isNudge) {
    frameWrapper.style.boxShadow = "none";
    frameWrapper.style.background = "transparent";
    frameWrapper.style.overflow = "visible";
    return;
  }

  frameWrapper.style.boxShadow = FRAME_WRAPPER_DEFAULT_BOX_SHADOW;
  frameWrapper.style.background = "transparent";
  frameWrapper.style.overflow = "hidden";
}

export function getOrCreateFrameWrapper(container?: HTMLElement): HTMLElement {
  const containerEl = container ?? getElement(ALPHABLOCKS_WRAPPER_ID);
  const existing = containerEl.querySelector(`.${ALPHABLOCKS_FRAME_WRAPPER_CLASS}`);
  if (existing instanceof HTMLElement) return existing;

  const frameWrapper = document.createElement("div");
  frameWrapper.className = ALPHABLOCKS_FRAME_WRAPPER_CLASS;
  applyFrameWrapperStyles(frameWrapper);
  containerEl.appendChild(frameWrapper);
  return frameWrapper;
}

export function createWrapper(): void {
  if (document.getElementById(ALPHABLOCKS_WRAPPER_ID)) return;

  const wrapperDiv = document.createElement("div");
  wrapperDiv.setAttribute("id", ALPHABLOCKS_WRAPPER_ID);
  wrapperDiv.style.position = "fixed";
  wrapperDiv.style.zIndex = "2147480000";
  applyContainerOffsetPosition(wrapperDiv, currentPosition);
  wrapperDiv.style.width = "fit-content";
  wrapperDiv.style.height = "fit-content";
  document.body.appendChild(wrapperDiv);
}

export function updateWrapperProperties(properties: { position: string }): void {
  const wrapperDiv = getElement(ALPHABLOCKS_WRAPPER_ID);
  currentPosition = properties.position;
  applyContainerOffsetPosition(wrapperDiv, properties.position);
}

// Export function to get current position
export function getCurrentPosition(): string {
  return currentPosition;
}

export function getChatIconHTML(
  name: string,
  avatar: string,
  bgColor: string,
  textColor: string,
): string {
  return `
    <div id="alphablocks-chat-icon-container">
      <button class="alphablocks-chat-icon-btn" style="background-color:${bgColor}">
          <img class="alphablocks-chat-icon-avatar" src="${avatar}" />
          <p class="alphablocks-chat-icon-name" style="color:${textColor}">${name}</p>
      </button>
    </div>`;
}

export function setCustomOffsets(offsets: CustomCSSProperties): void {
  customOffsets = { ...customOffsets, ...offsets };
  const wrapperDiv = getElement(ALPHABLOCKS_WRAPPER_ID);
  applyContainerOffsetPosition(wrapperDiv, currentPosition, {
    bottom: offsets.bottom,
    right: offsets.right,
    left: offsets.left,
  });
}

export function getCustomOffsets(): CustomCSSProperties {
  return { ...customOffsets };
}
