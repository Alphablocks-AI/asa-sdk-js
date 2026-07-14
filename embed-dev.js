/**
 * AlphaBlocks Widget Integration Script — staging / local development loader
 * Works in React, Next.js, and vanilla HTML
 *
 * Lifecycle: same as embed.js — idempotent init (skip if iframe already mounted; allow re-init
 * after host removes the widget DOM). One store / site typically uses one widget (one public token).
 *
 * Prefer placing before </body> with defer for minimal HTML parser blocking:
 *   <script defer src="https://unpkg.com/asa-sdk@latest/embed-dev.js" data-token="pk_..."></script>
 *
 * Beta / pilot (npm dist-tag "next"): same snippet, swap @latest → @next. The loader resolves
 * the UMD from the same package version as this script (no mismatch with @latest).
 *
 * Staging / hosted usage (same pattern as embed.js):
 *   <script defer src="https://unpkg.com/asa-sdk@latest/embed-dev.js" data-token="pk_..."></script>
 *
 * Local: run npm run build:nudge-dev, then <script defer src="./embed-dev.js" data-token="pk_..."></script>
 * (loads dist-local/ on localhost, dist-dev/ from unpkg)
 *
 * Optional user id: data-user-id on this script, or window.alphablocksConfig.userId / window.ALPHABLOCKS_USER_ID.
 *
 * OR set token globally before loading:
 *   <script>
 *     window.ALPHABLOCKS_TOKEN = "pk_your_token_here";
 *   </script>
 *   <script defer src="./embed-dev.js"></script>
 */
(function () {
  "use strict";

  /** Only AlphaBlocks loader URLs (avoids matching unrelated scripts with "embed" in the path). */
  const LOADER_SCRIPT_SELECTOR = 'script[src*="embed-dev.js"], script[src*="embed.js"]';
  const WRAPPER_ID = "alphablocks-assistant-container";

  function sdkUrlFromEmbedDevSrc(src) {
    if (!src || !/\/embed-dev\.js(\?|#|$)/i.test(src)) return null;
    let bundleDir = "dist-dev";
    try {
      const host = new URL(src, window.location.href).hostname;
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "[::1]" ||
        src.startsWith("file:")
      ) {
        bundleDir = "dist-local";
      }
    } catch {
      /* keep dist-dev default */
    }
    return src.replace(/\/embed-dev\.js((\?|#).*)?$/i, `/${bundleDir}/index.umd.js$1`);
  }

  function defaultSdkUrlFromCurrentScript() {
    try {
      const src =
        typeof document !== "undefined" && document.currentScript && document.currentScript.src;
      return sdkUrlFromEmbedDevSrc(src);
    } catch {
      /* currentScript / URL resolution unavailable */
    }
    return null;
  }

  function defaultSdkUrlFromLoaderScripts() {
    try {
      const scripts = document.querySelectorAll('script[src*="embed-dev.js"]');
      for (let i = scripts.length - 1; i >= 0; i--) {
        const resolved = sdkUrlFromEmbedDevSrc(scripts[i].src);
        if (resolved) return resolved;
      }
    } catch {
      /* DOM unavailable */
    }
    return null;
  }

  const SDK_URL =
    window.ALPHABLOCKS_SDK_URL ||
    defaultSdkUrlFromCurrentScript() ||
    defaultSdkUrlFromLoaderScripts() ||
    "https://unpkg.com/asa-sdk@latest/dist-dev/index.umd.js";

  /** True when the chat iframe is already in the DOM (live widget). */
  function isWidgetMounted() {
    try {
      const container = document.getElementById(WRAPPER_ID);
      return Boolean(container && container.querySelector("iframe"));
    } catch {
      return false;
    }
  }

  /** Prevents overlapping inits from duplicate tags before the iframe exists. */
  let embedStartInFlight = false;

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
   * Token resolution: currentScript (preferred), AlphaBlocks loader tags, globals, then config.
   */
  function getToken() {
    const currentScriptToken =
      typeof document !== "undefined" && document.currentScript
        ? normalizeToken(document.currentScript.getAttribute("data-token"))
        : null;
    if (currentScriptToken) return currentScriptToken;

    const scripts = document.querySelectorAll(LOADER_SCRIPT_SELECTOR);
    for (let i = 0; i < scripts.length; i++) {
      const token = normalizeToken(scripts[i].getAttribute("data-token"));
      if (token) return token;
    }

    if (typeof window !== "undefined") {
      const globalToken = normalizeToken(window.ALPHABLOCKS_TOKEN);
      if (globalToken) return globalToken;
    }

    if (typeof window !== "undefined") {
      const configToken = normalizeToken(window.alphablocksConfig?.token);
      if (configToken) return configToken;
    }

    return null;
  }

  /**
   * Optional user id; same order of precedence as getToken.
   */
  function getUserId() {
    const fromCurrent =
      typeof document !== "undefined" && document.currentScript
        ? normalizeUserId(document.currentScript.getAttribute("data-user-id"))
        : undefined;
    if (fromCurrent) return fromCurrent;

    const scripts = document.querySelectorAll(LOADER_SCRIPT_SELECTOR);
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

    if (isWidgetMounted()) return;

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

  function loadSDK(token, userId) {
    const runInit = () =>
      initWidget(token, userId)
        .catch((error) => {
          console.error("AlphaBlocks: Failed to initialize widget", error);
        })
        .finally(() => {
          embedStartInFlight = false;
        });

    if (window.AlphaBlocks) {
      runInit();
      return;
    }

    const existingScript = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existingScript) {
      if (window.AlphaBlocks) {
        runInit();
        return;
      }
      existingScript.addEventListener("load", runInit);
      existingScript.addEventListener(
        "error",
        () => {
          embedStartInFlight = false;
          console.error("AlphaBlocks: Failed to load SDK from", SDK_URL);
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = runInit;
    script.onerror = () => {
      embedStartInFlight = false;
      console.error("AlphaBlocks: Failed to load SDK from", SDK_URL);
    };

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

  function init() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (isWidgetMounted() || embedStartInFlight) return;

    const token = getToken();
    const userId = getUserId();

    if (!token) {
      console.error(
        'AlphaBlocks: Token not found. Please add data-token="pk_xxx" to the script tag or set window.ALPHABLOCKS_TOKEN',
      );
      return;
    }

    embedStartInFlight = true;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => scheduleLoadSDK(token, userId));
    } else {
      scheduleLoadSDK(token, userId);
    }
  }

  init();
})();
