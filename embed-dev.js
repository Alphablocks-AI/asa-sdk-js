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
 *     src="./embed-dev.js"
 *     data-token="pk_your_token_here"
 *   ></script>
 *
 * Usage (Production - use embed.js instead):
 *   <script
 *     src="https://unpkg.com/asa-sdk@latest/embed.js"
 *     data-token="pk_your_token_here"
 *   ></script>
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

  // Default to local dist-dev path, allow override
  const SDK_URL =
    window.ALPHABLOCKS_SDK_URL ||
    (isLocal ? "/dist-dev/index.umd.js" : "https://unpkg.com/asa-sdk@latest/dist/index.umd.js");

  /**
   * Get token from script tag data attribute or global variable
   */
  function getToken() {
    // Method 1: Get from script tag data-token attribute
    const scripts = document.querySelectorAll('script[src*="embed"]');
    for (let i = 0; i < scripts.length; i++) {
      const token = scripts[i].getAttribute("data-token");
      if (token) return token;
    }

    // Method 2: Get from global variable
    if (typeof window !== "undefined" && window.ALPHABLOCKS_TOKEN) {
      return window.ALPHABLOCKS_TOKEN;
    }

    // Method 3: Get from window.alphablocksConfig
    if (typeof window !== "undefined" && window.alphablocksConfig?.token) {
      return window.alphablocksConfig.token;
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
      // renderWrapper() is async, so we await it before showing assistant
      await assistant.renderWrapper();
      // showAssistant() is synchronous, so no await needed
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

  /**
   * Initialize when DOM is ready
   */
  function init() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const token = getToken();

    if (!token) {
      console.error(
        'AlphaBlocks: Token not found. Please add data-token="pk_xxx" to the script tag or set window.ALPHABLOCKS_TOKEN',
      );
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => loadSDK(token));
    } else {
      loadSDK(token);
    }
  }

  // Auto-initialize
  init();
})();
