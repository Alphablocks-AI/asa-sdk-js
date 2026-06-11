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

function applyFrameWrapperStyles(frameWrapper: HTMLElement): void {
  frameWrapper.style.boxShadow = "rgba(9, 14, 21, 0.16) 0px 5px 40px 0px";
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
  wrapperDiv.style.right = "24px";
  wrapperDiv.style.bottom = "24px";
  wrapperDiv.style.zIndex = "2147480000";
  wrapperDiv.style.width = "fit-content";
  wrapperDiv.style.height = "fit-content";
  document.body.appendChild(wrapperDiv);
}

export function updateWrapperProperties(properties: { position: string }): void {
  const wrapperDiv = getElement(ALPHABLOCKS_WRAPPER_ID);
  wrapperDiv.style.left = "";
  wrapperDiv.style.right = "";
  wrapperDiv.style.transform = "";

  // Store the current position
  currentPosition = properties.position;

  switch (properties.position) {
    case "bottom-left":
      wrapperDiv.style.left = "24px";
      break;
    case "bottom-center":
      wrapperDiv.style.left = "50%";
      wrapperDiv.style.transform = "translateX(-50%)";
      break;
    default:
      wrapperDiv.style.right = "24px";
      break;
  }
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
  if (offsets.bottom) {
    wrapperDiv.style.bottom = offsets.bottom;
  }
  if (offsets.right && currentPosition !== "bottom-left" && currentPosition !== "bottom-center") {
    wrapperDiv.style.right = offsets.right;
  }
}

export function getCustomOffsets(): CustomCSSProperties {
  return { ...customOffsets };
}
