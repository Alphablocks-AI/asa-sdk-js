/* eslint-disable no-undef */

export const CHATBOT_URL = process.env.SDK_URL as string;
export const API_URL = process.env.API_URL as string;
export const ALPHABLOCKS_WRAPPER_ID = "alphablocks-assistant-container";
export const ALPHABLOCKS_FRAME_WRAPPER_CLASS = "alphablocks-frame-wrapper";
export const ASSISTANT_DETAILS_STORAGE_KEY = "alphablocks-assistant-details";

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
 * Iframe `innerWidth` above this is treated as desktop by the storefront SDK’s mobile-nudge scroll
 * dismiss hook. **Keep in sync with** Asa-MonoRepo `MOBILE_WIDTH_THRESHOLD` in
 * `apps/widget/lib/widget-events/widget-events.config.ts` (currently 500).
 */
export const EMBED_MOBILE_MAX_INNER_WIDTH_PX = 500;

/**
 * Minimum host-page scroll delta (px) before posting `alphablocks-dismiss-nudge-on-scroll` — filters
 * tiny jitter. Widget-side coupling: only `mobileNudgeView` uses this path.
 */
export const MOBILE_NUDGE_SCROLL_DISMISS_MIN_DELTA_PX = 10;

/** Keep in sync with Asa-MonoRepo `HOST_IFRAME_CHAT_MIN_HEIGHT_PX`. */
export const CHAT_IFRAME_MIN_HEIGHT_PX = 575;
/** Keep in sync with Asa-MonoRepo `HOST_IFRAME_CHAT_MAX_HEIGHT_PX`. */
export const CHAT_IFRAME_MAX_HEIGHT_PX = 720;
/** Keep in sync with Asa-MonoRepo `HOST_IFRAME_EDGE_MARGIN_PX` / `WRAPPER_EDGE_OFFSET_DESKTOP`. */
export const CHAT_IFRAME_EDGE_MARGIN_PX = 24;
/** Desktop chat iframe height — viewport minus symmetric margins, clamped to min/max. */
export const CHAT_IFRAME_VIEWPORT_HEIGHT = `min(${CHAT_IFRAME_MAX_HEIGHT_PX}px, max(${CHAT_IFRAME_MIN_HEIGHT_PX}px, calc(100dvh - ${CHAT_IFRAME_EDGE_MARGIN_PX * 2}px)))`;
