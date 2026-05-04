/**
 * AlphaBlocks Widget Integration Script
 * Works in React, Next.js, and vanilla HTML
 *
 * Prefer placing before </body> with defer for minimal HTML parser blocking:
 *   <script defer src="https://unpkg.com/asa-sdk@latest/embed.js" data-token="pk_..."></script>
 *
 * Beta / pilot (npm dist-tag "next"): same snippet, swap @latest → @next. The loader resolves
 * the UMD from the same package version as this script (no mismatch with @latest).
 *
 * Usage:
 *   <script
 *     defer
 *     src="https://unpkg.com/asa-sdk@latest/embed.js"
 *     data-token="pk_your_token_here"
 *   ></script>
 *
 * Optional logged-in user id (e.g. Shopify customer), same as manual `new AlphaBlocks({ userId })`:
 *   <script defer src="https://unpkg.com/asa-sdk@next/embed.js" data-token="pk_..." data-user-id="123"></script>
 *   Or set window.alphablocksConfig = { token: "pk_...", userId: "123" } before this script.
 *
 * OR set token globally before loading:
 *   <script>
 *     window.ALPHABLOCKS_TOKEN = "pk_your_token_here";
 *   </script>
 *   <script src="https://unpkg.com/asa-sdk@latest/embed.js"></script>
 */
(function () {
  "use strict";

  /**
   * When this file is served as .../embed.js (e.g. unpkg asa-sdk@next/embed.js), load the UMD
   * from the same origin path (.../dist/index.umd.js) so @next and version pins stay consistent.
   */
  function defaultSdkUrlFromCurrentScript() {
    try {
      const src =
        typeof document !== "undefined" && document.currentScript && document.currentScript.src;
      if (src && /\/embed\.js(\?|#|$)/i.test(src)) {
        return src.replace(/\/embed\.js((\?|#).*)?$/i, "/dist/index.umd.js$1");
      }
    } catch (_e) {
      /* ignore */
      console.error("AlphaBlocks: Failed to get SDK URL from current script", _e);
    }
    return null;
  }

  // Production SDK URL (can be overridden with window.ALPHABLOCKS_SDK_URL)
  const SDK_URL =
    window.ALPHABLOCKS_SDK_URL ||
    defaultSdkUrlFromCurrentScript() ||
    "https://unpkg.com/asa-sdk@latest/dist/index.umd.js";
  const EMBED_GUARD_KEY = "__ALPHABLOCKS_EMBED_INITIALIZED__";

  function normalizeToken(rawToken) {
    if (typeof rawToken !== "string") return null;
    const token = rawToken.trim();
    if (!token || token === "undefined" || token === "null") return null;
    return token;
  }

  function normalizeUserId(raw) {
    if (raw == null || raw === false) return undefined;
    if (typeof raw === "number") {
      if (Number.isNaN(raw)) return undefined;
      return String(raw);
    }
    if (typeof raw !== "string") return undefined;
    const s = raw.trim();
    if (!s || s === "undefined" || s === "null") return undefined;
    return s;
  }

  /**
   * Get token from script tag data attribute or global variable
   */
  function getToken() {
    // Method 1 (new usage): use current script's data-token when available.
    const currentScriptToken =
      typeof document !== "undefined" && document.currentScript
        ? normalizeToken(document.currentScript.getAttribute("data-token"))
        : null;
    if (currentScriptToken) return currentScriptToken;

    // Method 2 (legacy usage): scan embed script tags for data-token.
    const scripts = document.querySelectorAll('script[src*="embed.js"]');
    for (let i = 0; i < scripts.length; i++) {
      const token = normalizeToken(scripts[i].getAttribute("data-token"));
      if (token) return token;
    }

    // Method 3 (legacy usage): get from global variable.
    if (typeof window !== "undefined") {
      const globalToken = normalizeToken(window.ALPHABLOCKS_TOKEN);
      if (globalToken) return globalToken;
    }

    // Method 4 (new usage): get from window.alphablocksConfig.
    if (typeof window !== "undefined") {
      const configToken = normalizeToken(window.alphablocksConfig?.token);
      if (configToken) return configToken;
    }

    return null;
  }

  /**
   * Optional user id (e.g. Shopify customer id) — same precedence style as token where applicable.
   */
  function getUserId() {
    const fromCurrent =
      typeof document !== "undefined" && document.currentScript
        ? normalizeUserId(document.currentScript.getAttribute("data-user-id"))
        : undefined;
    if (fromCurrent) return fromCurrent;

    const scripts = document.querySelectorAll('script[src*="embed.js"]');
    for (let i = 0; i < scripts.length; i++) {
      const uid = normalizeUserId(scripts[i].getAttribute("data-user-id"));
      if (uid) return uid;
    }

    if (typeof window !== "undefined") {
      const g = normalizeUserId(window.ALPHABLOCKS_USER_ID);
      if (g) return g;
      const c = normalizeUserId(window.alphablocksConfig?.userId);
      if (c) return c;
    }

    return undefined;
  }

  /**
   * Initialize and show the widget
   */
  async function initWidget(token, userId) {
    if (!window.AlphaBlocks || !token) {
      console.error(
        'AlphaBlocks: Token is required. Add data-token="pk_xxx" to script tag or set window.ALPHABLOCKS_TOKEN',
      );
      return;
    }

    try {
      const props = { token: token };
      if (userId) props.userId = userId;
      const assistant = new window.AlphaBlocks(props);
      await assistant.renderWrapper();
      assistant.showAssistant();
    } catch (error) {
      console.error("AlphaBlocks: Failed to initialize widget", error);
    }
  }

  /**
   * Load SDK script if not already loaded
   */
  function loadSDK(token, userId) {
    // Check if SDK is already loaded
    if (window.AlphaBlocks) {
      // initWidget is async, but we don't need to await it here
      initWidget(token, userId).catch((error) => {
        console.error("AlphaBlocks: Failed to initialize widget", error);
      });
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existingScript) {
      // Wait for it to load
      existingScript.addEventListener("load", () => {
        initWidget(token, userId).catch((error) => {
          console.error("AlphaBlocks: Failed to initialize widget", error);
        });
      });
      return;
    }

    // Create and append script tag
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      initWidget(token, userId).catch((error) => {
        console.error("AlphaBlocks: Failed to initialize widget", error);
      });
    };
    script.onerror = () => {
      console.error("AlphaBlocks: Failed to load SDK from", SDK_URL);
    };

    // Append to head or body
    (document.head || document.body || document.documentElement).appendChild(script);
  }

  function scheduleLoadSDK(token, userId) {
    function run() {
      loadSDK(token, userId);
    }
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 0);
    }
  }

  /**
   * Initialize when DOM is ready
   */
  function init() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window[EMBED_GUARD_KEY]) return;

    const token = getToken();
    const userId = getUserId();

    if (!token) {
      console.error(
        'AlphaBlocks: Token not found. Please add data-token="pk_xxx" to the script tag or set window.ALPHABLOCKS_TOKEN',
      );
      return;
    }
    window[EMBED_GUARD_KEY] = true;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => scheduleLoadSDK(token, userId));
    } else {
      scheduleLoadSDK(token, userId);
    }
  }

  // Auto-initialize
  init();
})();
