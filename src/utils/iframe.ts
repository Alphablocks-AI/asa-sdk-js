import { ALPHABLOCKS_WRAPPER_ID, CHATBOT_URL } from "../constants/index.ts";
import { EventDataType } from "../types/index.ts";
import { getCookie } from "./cookie.ts";
import { getElement, getCurrentPosition, getCustomOffsets } from "./dom.ts";

export function createIFrame(
  token: string,
  theme: string,
  name: string,
  version: number,
): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  // Ensure name is a string and has a default value
  const assistantName = name || "";
  const width =
    assistantName.length <= 7 ? "120px" : assistantName.length <= 15 ? "170px" : "235px";
  iframe.src = `${CHATBOT_URL}/?token=${token}&version=${version}&theme=${theme}`;
  iframe.style.width = version === 1 ? width : "562px";
  iframe.style.height = version === 1 ? "60px" : "545px";
  iframe.style.border = "none";
  iframe.style.background = "transparent";
  iframe.allow = "microphone";
  return iframe;
}

export function setIframeSize(properties: EventDataType, iframe: HTMLIFrameElement | null): void {
  if (!iframe || !properties.height || !properties.width) return;

  const wrapperDiv = getElement(ALPHABLOCKS_WRAPPER_ID);
  iframe.style.width = properties.width;

  wrapperDiv.style.width = "fit-content";
  wrapperDiv.style.height = "fit-content";

  // Get the current position to respect positioning set by updateWrapperProperties
  const currentPosition = getCurrentPosition();
  const custom = getCustomOffsets();

  if (properties.event === "mobileNudgeView") {
    wrapperDiv.style.left = "16px";
    iframe.style.width = "100%";
  } else {
    // Only remove left property if we're not in bottom-left or bottom-center position
    if (currentPosition !== "bottom-left" && currentPosition !== "bottom-center") {
      wrapperDiv.style.removeProperty("left");
    }
  }

  if (window.innerWidth <= 500) {
    // For mobile, respect the current position but adjust spacing
    if (currentPosition === "bottom-left") {
      wrapperDiv.style.left = "16px";
      wrapperDiv.style.right = "";
    } else if (currentPosition === "bottom-center") {
      wrapperDiv.style.left = "50%";
      wrapperDiv.style.transform = "translateX(-50%)";
      wrapperDiv.style.right = "";
    } else {
      wrapperDiv.style.right = custom.right || "16px";
      wrapperDiv.style.left = "";
      wrapperDiv.style.transform = "";
    }
    wrapperDiv.style.bottom = custom.bottom || "16px";
    // If event provides explicit overrides, apply them (each independently)
    if (
      properties.right &&
      currentPosition !== "bottom-left" &&
      currentPosition !== "bottom-center"
    )
      wrapperDiv.style.right = properties.right;
    if (properties.bottom) wrapperDiv.style.bottom = properties.bottom;
    wrapperDiv.style.width = properties.width;
    iframe.style.height = properties.height;
  } else {
    // For desktop, respect the current position
    if (currentPosition === "bottom-left") {
      wrapperDiv.style.left = "24px";
      wrapperDiv.style.right = "";
      wrapperDiv.style.transform = "";
    } else if (currentPosition === "bottom-center") {
      wrapperDiv.style.left = "50%";
      wrapperDiv.style.transform = "translateX(-50%)";
      wrapperDiv.style.right = "";
    } else {
      wrapperDiv.style.right = custom.right || "24px";
      wrapperDiv.style.left = "";
      wrapperDiv.style.transform = "";
    }
    wrapperDiv.style.bottom = custom.bottom || "24px";
    // Allow event to override custom/default individually
    if (
      properties.right &&
      currentPosition !== "bottom-left" &&
      currentPosition !== "bottom-center"
    )
      wrapperDiv.style.right = properties.right;
    if (properties.bottom) wrapperDiv.style.bottom = properties.bottom;
    iframe.style.height = properties.height;
  }

  if (properties.right && properties.left && properties.bottom) {
    wrapperDiv.style.right = properties.right;
    wrapperDiv.style.bottom = properties.bottom;
    wrapperDiv.style.left = properties.left;
    wrapperDiv.style.width = "100%";
    wrapperDiv.style.height = "100%";
  }
}

export function sendOriginalWindowMessage(iframe: HTMLIFrameElement | null): void {
  const message = {
    type: "alphablocks-original-size",
    data: { width: window.innerWidth, height: window.innerHeight },
  };
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(message, CHATBOT_URL);
}

export function hideIframe(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return;
  iframe.style.display = "none";
  const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
  if (chatIconContainer) {
    chatIconContainer.style.display = "block";
  }
}

export function sendParentUrlParams(
  iframe: HTMLIFrameElement | null,
  assistantId: number | null,
): void {
  const url = new URL(window.location.href);
  const askAsa = url.searchParams.get("ask_asa") === "true";
  const query = url.searchParams.get("query") || "";
  const urlPath = url.pathname;
  const params = urlPath.split("/").filter(Boolean);
  const sessionCookie = getCookie(`alphablocks-sessionId-${assistantId}`);
  url.searchParams.delete("ask_asa");
  url.searchParams.delete("query");
  window.history.replaceState({}, document.title, url.toString());
  const message = {
    type: "alphablocks-parent-url",
    data: { ask_asa: askAsa, query, urlPath, params, sessionCookie },
  };
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(message, CHATBOT_URL);
}
