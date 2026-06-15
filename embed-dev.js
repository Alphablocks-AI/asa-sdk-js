/**
 * AlphaBlocks Widget Integration Script — staging / local development loader
 * Works in React, Next.js, and vanilla HTML
 *
 * Lifecycle: same as embed.js — one guarded init per document; a full page refresh runs init again.
 * One store / site typically uses one widget (one public token).
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
 * Local usage (serve the asa-sdk-js package root; run npm run build:nudge-dev):
 *   <script defer src="./embed-dev.js" data-token="pk_..."></script>
 *   <script defer src="/asa-sdk-js/embed-dev.js" data-token="pk_..."></script>
 *
 * Do not place this file inside dist-dev/ — it must sit beside dist-dev/ (package root),
 * mirroring how embed.js sits beside dist/.
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

  /**
   * When served as .../embed-dev.js, load the UMD from the same base path (.../dist-dev/index.umd.js)
   * so npm dist-tags and version pins stay aligned with this file.
   */
  function defaultSdkUrlFromCurrentScript() {
    try {
      const src =
        typeof document !== "undefined" && document.currentScript && document.currentScript.src;
      if (src && /\/embed-dev\.js(\?|#|$)/i.test(src)) {
        return src.replace(/\/embed-dev\.js((\?|#).*)?$/i, "/dist-dev/index.umd.js$1");
      }
    } catch {
      /* currentScript / URL resolution unavailable — use explicit SDK_URL or CDN default */
    }
    return null;
  }

  function defaultSdkUrlFromLoaderScripts() {
    try {
      const scripts = document.querySelectorAll('script[src*="embed-dev.js"]');
      for (let i = scripts.length - 1; i >= 0; i--) {
        const src = scripts[i].src;
        if (src && /\/embed-dev\.js(\?|#|$)/i.test(src)) {
          return src.replace(/\/embed-dev\.js((\?|#).*)?$/i, "/dist-dev/index.umd.js$1");
        }
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

  /** Ensures one init per document; cleared automatically on full page navigation / refresh. */
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

  function isDevBundleScript(scriptEl) {
    if (!scriptEl || !scriptEl.src) return false;
    return /\/dist-dev\/index\.umd\.js(\?|#|$)/i.test(scriptEl.src);
  }

  /**
   * Load SDK script if not already loaded
   */
  function loadSDK(token, userId) {
    if (window.AlphaBlocks) {
      const loadedDevSdk = document.querySelector(`script[src="${SDK_URL}"]`);
      if (loadedDevSdk && isDevBundleScript(loadedDevSdk)) {
        initWidget(token, userId).catch((error) => {
          console.error("AlphaBlocks: Failed to initialize widget", error);
        });
        return;
      }

      console.warn(
        "AlphaBlocks: embed-dev.js found an existing SDK (likely prod). Loading dev bundle from",
        SDK_URL,
      );
      try {
        delete window.AlphaBlocks;
      } catch {
        window.AlphaBlocks = undefined;
      }
    }

    const existingScript = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        initWidget(token, userId).catch((error) => {
          console.error("AlphaBlocks: Failed to initialize widget", error);
        });
      });
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      initWidget(token, userId).catch((error) => {
        console.error("AlphaBlocks: Failed to initialize widget", error);
      });
    };
    script.onerror = () => {
      console.error(
        "AlphaBlocks: Failed to load dev SDK from",
        SDK_URL,
        "— for local dev run npm run build:nudge-dev; for staging publish dist-dev via npm run build:dev",
      );
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

  init();
})();
