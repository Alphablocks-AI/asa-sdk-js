/* eslint-disable no-undef */

export const CHATBOT_URL = process.env.SDK_URL as string;
export const API_URL = process.env.API_URL as string;
export const ALPHABLOCKS_WRAPPER_ID = "alphablocks-assistant-container";
export const ALPHABLOCKS_FRAME_WRAPPER_CLASS = "alphablocks-frame-wrapper";
export const ASSISTANT_DETAILS_STORAGE_KEY = "alphablocks-assistant-details";

/**
 * Host wrapper stacking order for closed launcher and open chat (same value).
 * Mid-range so theme cart drawers/sheets can sit above checkout CTAs; avoid max int.
 */
export const ALPHABLOCKS_HOST_Z_INDEX = "999";

export const ASA_STOREFRONT_ACTION_ATTR = "data-asa-action";
export const ASA_STOREFRONT_MESSAGE_ATTR = "data-asa-message";
export const ASA_STOREFRONT_PILL_QUESTIONS_ATTR = "data-asa-pill-questions";

/**
 * Local-only dev harness flag.
 *
 * This SDK is bundled with Rollup `--environment SDK_URL:...`, so we can detect "local"
 * by the widget hostname at build time.
 */
export const NUDGE_DEV_ENABLED = (() => {
  try {
    const host = new URL(CHATBOT_URL).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
})();

/**
 * Iframe `innerWidth` at or below this is treated as mobile layout.
 *
 * **Monorepo sync:** keep in sync with `WIDGET_EMBED_LAYOUT.mobileBreakpointPx` in
 * `Asa-MonoRepo/packages/widget-theme/src/embed-layout.ts` and widget
 * `MOBILE_WIDTH_THRESHOLD` in `apps/widget/lib/widget-events/widget-events.config.ts`.
 */
export const EMBED_MOBILE_MAX_INNER_WIDTH_PX = 500;

/**
 * Desktop floating chat shell width.
 *
 * **Monorepo sync:** keep in sync with `WIDGET_CHAT_LAYOUT.shellWidthPx` in
 * `Asa-MonoRepo/packages/widget-theme/src/chat-layout.ts`.
 * Expanded open-chat size is sent via postMessage (`min(850px, 90dvw)` ×
 * `min(650px, calc(100dvh - edge))`); the host applies those strings on the iframe.
 */
export const CHAT_IFRAME_WIDTH_PX = 500;

/**
 * Desktop floating chat shell height (collapsed).
 *
 * **Monorepo sync:** keep in sync with `WIDGET_CHAT_LAYOUT.shellHeightPx`.
 */
export const CHAT_IFRAME_MIN_HEIGHT_PX = 500;

/**
 * Collapsed desktop chat shell max height (same as min for fixed 500×500 default).
 *
 * **Monorepo sync:** keep in sync with `WIDGET_CHAT_LAYOUT.shellMaxHeightPx`.
 */
export const CHAT_IFRAME_MAX_HEIGHT_PX = 500;

/**
 * Host viewport inset — chat iframe bottom margin + wrapper corner offset.
 *
 * **Monorepo sync:** keep in sync with `WIDGET_EMBED_LAYOUT.hostEdgeInsetDesktopPx` in
 * `Asa-MonoRepo/packages/widget-theme/src/embed-layout.ts` and `WRAPPER_EDGE_OFFSET_DESKTOP`
 * in `src/utils/dom.ts`.
 */
export const CHAT_IFRAME_EDGE_MARGIN_PX = 24;

/** Desktop chat iframe height — fixed collapsed size, never taller than the viewport. */
export const CHAT_IFRAME_VIEWPORT_HEIGHT = `min(${CHAT_IFRAME_MAX_HEIGHT_PX}px, calc(100dvh - ${CHAT_IFRAME_EDGE_MARGIN_PX}px))`;
