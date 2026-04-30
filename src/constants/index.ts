/* eslint-disable no-undef */

export const CHATBOT_URL = process.env.SDK_URL as string;
export const API_URL = process.env.API_URL as string;
export const ALPHABLOCKS_WRAPPER_ID = "alphablocks-assistant-container";
export const ASSISTANT_DETAILS_STORAGE_KEY = "alphablocks-assistant-details";

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
