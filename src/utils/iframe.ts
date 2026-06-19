import {
  ALPHABLOCKS_WRAPPER_ID,
  CHATBOT_URL,
  CHAT_IFRAME_VIEWPORT_HEIGHT,
  CHAT_IFRAME_WIDTH_PX,
  EMBED_MOBILE_MAX_INNER_WIDTH_PX,
  MOBILE_NUDGE_SCROLL_DISMISS_VIEWPORT_PERCENT,
} from "../constants/index.ts";
import { EventDataType } from "../types/index.ts";
import { getCookie } from "./cookie.ts";
import {
  applyContainerCornerPosition,
  applyContainerOffsetPosition,
  applyFrameWrapperChrome,
  getCurrentPosition,
  getElement,
  getOrCreateFrameWrapper,
  revealFrameWrapper,
  syncFrameWrapperSize,
} from "./dom.ts";
import { resetHostScrollDepthReporter } from "./host-scroll-depth.ts";
import { getIframePostMessageTarget } from "./post-message-target.ts";

let mobileNudgeScrollCleanup: (() => void) | null = null;

function teardownMobileNudgeScrollDismiss(): void {
  if (mobileNudgeScrollCleanup) {
    mobileNudgeScrollCleanup();
    mobileNudgeScrollCleanup = null;
  }
}

function syncMobileNudgeScrollDismiss(properties: EventDataType, iframe: HTMLIFrameElement): void {
  teardownMobileNudgeScrollDismiss();

  if (
    properties.event !== "mobileNudgeView" ||
    window.innerWidth > EMBED_MOBILE_MAX_INNER_WIDTH_PX
  ) {
    return;
  }

  const scrollRoot = document.scrollingElement ?? document.documentElement;
  const initialY = window.scrollY ?? scrollRoot.scrollTop ?? 0;
  const targetOrigin = getIframePostMessageTarget(iframe);

  const resolveMinScrollDeltaPx = (): number =>
    (window.innerHeight * MOBILE_NUDGE_SCROLL_DISMISS_VIEWPORT_PERCENT) / 100;

  const onScroll = (): void => {
    const y = window.scrollY ?? scrollRoot.scrollTop ?? 0;
    if (Math.abs(y - initialY) < resolveMinScrollDeltaPx()) return;
    if (!iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "alphablocks-dismiss-nudge-on-scroll", data: {} },
      targetOrigin,
    );
    teardownMobileNudgeScrollDismiss();
  };

  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  document.addEventListener("scroll", onScroll, { passive: true, capture: true });
  mobileNudgeScrollCleanup = () => {
    window.removeEventListener("scroll", onScroll, { capture: true });
    document.removeEventListener("scroll", onScroll, { capture: true });
  };
}

export function setIframeAccessibleTitle(iframe: HTMLIFrameElement, assistantName: string): void {
  const label = (assistantName || "").trim();
  iframe.title = label ? `AlphaBlocks chat — ${label}` : "AlphaBlocks chat assistant";
}

function isLocalChatbotHost(): boolean {
  try {
    const host = new URL(CHATBOT_URL).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function buildWidgetIframeSrc(token: string, version: number, theme: string): string {
  const params = new URLSearchParams({
    token,
    version: String(version),
    theme: theme || "",
  });
  if (isLocalChatbotHost()) {
    params.set("widgetNudgeDev", "1");
  }
  return `${CHATBOT_URL}/?${params.toString()}`;
}

export function createIFrame(
  token: string,
  theme: string,
  name: string,
  version: number,
): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  const assistantName = name || "";
  const width =
    assistantName.length <= 7 ? "120px" : assistantName.length <= 15 ? "170px" : "235px";
  iframe.src = buildWidgetIframeSrc(token, version, theme);
  iframe.style.width = version === 1 ? width : `${CHAT_IFRAME_WIDTH_PX}px`;
  iframe.style.height = version === 1 ? "60px" : CHAT_IFRAME_VIEWPORT_HEIGHT;
  iframe.style.border = "none";
  iframe.style.background = "transparent";
  iframe.style.display = "block";
  iframe.style.transition = "none";
  iframe.allow = "microphone";
  setIframeAccessibleTitle(iframe, assistantName);
  return iframe;
}

const NUDGE_RESIZE_EVENTS = new Set(["productPageNudgeView", "mobileNudgeView", "nudgeView"]);

function isFullBleedMobileLayout(properties: EventDataType): boolean {
  return Boolean(properties.right) && Boolean(properties.left) && Boolean(properties.bottom);
}

/** Apply a CSS size; fall back to `vh` when `dvh` is rejected (older engines / jsdom). */
function setElementStyleDimension(
  el: HTMLElement,
  dimension: "width" | "height",
  value: string,
): void {
  el.style.setProperty(dimension, value);
  const applied = el.style.getPropertyValue(dimension);
  if (applied === value) return;

  if (value.endsWith("dvh")) {
    const vhFallback = value.replace(/dvh$/, "vh");
    if (applied !== vhFallback) {
      el.style.setProperty(dimension, vhFallback);
    }
    return;
  }
  if (value.endsWith("dvw")) {
    const vwFallback = value.replace(/dvw$/, "vw");
    if (applied !== vwFallback) {
      el.style.setProperty(dimension, vwFallback);
    }
  }
}

function shouldRevealHostFrame(properties: EventDataType): boolean {
  const event = properties.event ?? "";
  const hasExplicitPxSize =
    Boolean(properties.width?.endsWith("px")) && Boolean(properties.height?.endsWith("px"));
  if (NUDGE_RESIZE_EVENTS.has(event) && hasExplicitPxSize) return true;
  if (NUDGE_RESIZE_EVENTS.has(event)) return false;
  if (event === "mobileView" || isFullBleedMobileLayout(properties)) return true;
  return Boolean(properties.frameBorderRadius);
}

export function setIframeSize(properties: EventDataType, iframe: HTMLIFrameElement | null): void {
  if (!iframe) return;

  const containerDiv = getElement(ALPHABLOCKS_WRAPPER_ID);
  const frameWrapper = getOrCreateFrameWrapper(containerDiv);

  if (properties.frameBorderRadius) {
    frameWrapper.style.borderRadius = properties.frameBorderRadius;
  }

  if (!properties.height || !properties.width) {
    if (shouldRevealHostFrame(properties)) {
      revealFrameWrapper(frameWrapper);
    }
    return;
  }

  setElementStyleDimension(iframe, "width", properties.width);

  const eventName = properties.event ?? "";
  const hasExplicitPxSize = properties.width.endsWith("px") && properties.height.endsWith("px");
  const isMobileNudgeEvent = eventName === "mobileNudgeView";
  const skipFitContentReset =
    NUDGE_RESIZE_EVENTS.has(eventName) && (hasExplicitPxSize || isMobileNudgeEvent);

  if (!skipFitContentReset) {
    containerDiv.style.width = "fit-content";
    containerDiv.style.height = "fit-content";
    frameWrapper.style.width = "fit-content";
    frameWrapper.style.height = "fit-content";
  }

  const currentPosition = getCurrentPosition();
  const isMobileViewport = window.innerWidth <= EMBED_MOBILE_MAX_INNER_WIDTH_PX;
  const isNudgeFrame = NUDGE_RESIZE_EVENTS.has(eventName);
  const isFullBleedMobile = isFullBleedMobileLayout(properties);

  if (isFullBleedMobile) {
    containerDiv.style.bottom = properties.bottom!;
    containerDiv.style.left = properties.left!;
    containerDiv.style.right = properties.right!;
    containerDiv.style.top = "0";
    containerDiv.style.transform = "";
    containerDiv.style.margin = "";
    containerDiv.style.width = "100%";
    containerDiv.style.height = "100%";
    setElementStyleDimension(iframe, "width", properties.width);
    setElementStyleDimension(iframe, "height", properties.height);
    frameWrapper.style.width = "100%";
    frameWrapper.style.height = "100%";
  } else if (isNudgeFrame) {
    if (isMobileNudgeEvent) {
      containerDiv.style.left = "0";
      containerDiv.style.right = "0";
      containerDiv.style.bottom = "0";
      containerDiv.style.top = "";
      containerDiv.style.transform = "";
      containerDiv.style.margin = "";
      containerDiv.style.width = "100%";
      containerDiv.style.height = properties.height;
      frameWrapper.style.width = "100%";
      frameWrapper.style.height = properties.height;
      setElementStyleDimension(iframe, "width", "100%");
      setElementStyleDimension(iframe, "height", properties.height);
    } else {
      applyContainerCornerPosition(containerDiv, currentPosition);
      setElementStyleDimension(iframe, "height", properties.height);
      frameWrapper.style.width = properties.width;
      frameWrapper.style.height = properties.height;
      syncFrameWrapperSize(frameWrapper, iframe);
    }
  } else {
    const hasTopOffset = Boolean(properties.marginTop ?? properties.top);
    applyContainerOffsetPosition(containerDiv, currentPosition, {
      isMobile: isMobileViewport,
      top: hasTopOffset ? (properties.marginTop ?? properties.top) : "",
      bottom: properties.marginBottom ?? properties.bottom,
      right: properties.marginRight ?? properties.right,
    });
    setElementStyleDimension(iframe, "height", properties.height);
    frameWrapper.style.width = properties.width;
    frameWrapper.style.height = properties.height;
    syncFrameWrapperSize(frameWrapper, iframe);
  }

  if (properties.frameBorderRadius) {
    frameWrapper.style.borderRadius = properties.frameBorderRadius;
  }

  applyFrameWrapperChrome(frameWrapper, iframe, containerDiv, {
    isNudge: isNudgeFrame,
  });

  if (shouldRevealHostFrame(properties)) {
    revealFrameWrapper(frameWrapper);
    iframe.style.display = "block";
  }

  syncMobileNudgeScrollDismiss(properties, iframe);
}

export function sendOriginalWindowMessage(iframe: HTMLIFrameElement | null): void {
  const message = {
    type: "alphablocks-original-size",
    data: { width: window.innerWidth, height: window.innerHeight },
  };
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(message, getIframePostMessageTarget(iframe));
}

export function hideIframe(iframe: HTMLIFrameElement | null): void {
  teardownMobileNudgeScrollDismiss();
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
  const searchQuery = url.searchParams.get("q") || "";
  const params = url.pathname.split("/").filter(Boolean);
  const sessionCookie = getCookie(`alphablocks-sessionId-${assistantId}`);
  url.searchParams.delete("ask_asa");
  url.searchParams.delete("query");
  const urlPath = `${url.pathname}${url.search}`;
  window.history.replaceState({}, document.title, url.toString());
  const message = {
    type: "alphablocks-parent-url",
    data: {
      ask_asa: askAsa,
      query,
      searchQuery,
      urlPath,
      params,
      sessionCookie,
      hostname: window.location.hostname,
    },
  };
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(message, getIframePostMessageTarget(iframe));
  resetHostScrollDepthReporter(() => iframe);
}
