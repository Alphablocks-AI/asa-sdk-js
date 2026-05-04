/**
 * AlphaBlocks Widget Integration Script - Development Version
 * Works in React, Next.js, and vanilla HTML
 *
 * This version includes full local development support:
 * - Auto-detects localhost/127.0.0.1/file:// protocol
 * - Uses local dev build (/dist-dev/index.umd.js)
 * - Supports direct file access
 *
 * Usage (Local Development):
 *   <script
 *     src="http://127.0.0.1:5500/dist-dev/embed-dev.js"
 *     data-token="pk_your_token_here"
 *   ></script>
 *
 * Usage (Production - use embed.js instead):
 *   <script defer src="https://unpkg.com/asa-sdk@latest/embed.js" data-token="pk_..."></script>
 *
 * Beta: <script defer src="https://unpkg.com/asa-sdk@next/embed.js" data-token="pk_..."></script>
 *
 * OR set token globally before loading:
 *   <script>
 *     window.ALPHABLOCKS_TOKEN = "pk_your_token_here";
 *   </script>
 *   <script src="./embed-dev.js"></script>
 */
(function () {
  "use strict";

  // Simple local dev detection: localhost, 127.0.0.1, or file:// protocol
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:";

  function defaultSdkUrlFromCurrentScript() {
    try {
      const src =
        typeof document !== "undefined" && document.currentScript && document.currentScript.src;
      if (src && /\/embed-dev\.js(\?|#|$)/i.test(src)) {
        return src.replace(/\/embed-dev\.js((\?|#).*)?$/i, "/dist-dev/index.umd.js$1");
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  // Default to local dist-dev path, allow override
  const SDK_URL =
    window.ALPHABLOCKS_SDK_URL ||
    (isLocal
      ? "http://127.0.0.1:5500/dist-dev/index.umd.js"
      : defaultSdkUrlFromCurrentScript() ||
        "https://unpkg.com/asa-sdk@latest/dist-dev/index.umd.js");
  const EMBED_GUARD_KEY = "__ALPHABLOCKS_EMBED_INITIALIZED__";

  function normalizeToken(rawToken) {
    if (typeof rawToken !== "string") return null;
    const token = rawToken.trim();
    if (!token || token === "undefined" || token === "null") return null;
    return token;
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
    const scripts = document.querySelectorAll('script[src*="embed"]');
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
   * Initialize and show the widget
   */
  async function initWidget(token) {
    if (!window.AlphaBlocks || !token) {
      console.error(
        'AlphaBlocks: Token is required. Add data-token="pk_xxx" to script tag or set window.ALPHABLOCKS_TOKEN',
      );
      return;
    }

    try {
      const assistant = new window.AlphaBlocks({ token: token });
      await assistant.renderWrapper();
      assistant.showAssistant();
    } catch (error) {
      console.error("AlphaBlocks: Failed to initialize widget", error);
    }
  }

  /**
   * Load SDK script if not already loaded
   */
  function loadSDK(token) {
    // Check if SDK is already loaded
    if (window.AlphaBlocks) {
      // initWidget is async, but we don't need to await it here
      initWidget(token).catch((error) => {
        console.error("AlphaBlocks: Failed to initialize widget", error);
      });
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existingScript) {
      // Wait for it to load
      existingScript.addEventListener("load", () => {
        initWidget(token).catch((error) => {
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
      initWidget(token).catch((error) => {
        console.error("AlphaBlocks: Failed to initialize widget", error);
      });
    };
    script.onerror = () => {
      console.error("AlphaBlocks: Failed to load SDK from", SDK_URL);
    };

    // Append to head or body
    (document.head || document.body || document.documentElement).appendChild(script);
  }

  function scheduleLoadSDK(token) {
    function run() {
      loadSDK(token);
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

    if (!token) {
      console.error(
        'AlphaBlocks: Token not found. Please add data-token="pk_xxx" to the script tag or set window.ALPHABLOCKS_TOKEN',
      );
      return;
    }
    window[EMBED_GUARD_KEY] = true;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => scheduleLoadSDK(token));
    } else {
      scheduleLoadSDK(token);
    }
  }

  // Auto-initialize
  init();
})();
