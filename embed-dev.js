/**
 * AlphaBlocks embed loader (development).
 * - Initializes once per document.
 * - Loads UMD lazily and mounts iframe after page load/idle or first interaction.
 */
(function () {
  "use strict";

  const LOADER_SCRIPT_SELECTOR = 'script[src*="embed-dev.js"], script[src*="embed.js"]';
  const EMBED_GUARD_KEY = "__ALPHABLOCKS_EMBED_INITIALIZED__";

  const locationInfo = typeof window !== "undefined" ? window.location : null;
  const isLocal =
    !!locationInfo &&
    (locationInfo.hostname === "localhost" ||
      locationInfo.hostname === "127.0.0.1" ||
      locationInfo.protocol === "file:");

  function defaultSdkUrlFromCurrentScript() {
    try {
      const src =
        typeof document !== "undefined" && document.currentScript && document.currentScript.src;
      if (src && /\/embed-dev\.js(\?|#|$)/i.test(src)) {
        return src.replace(/\/embed-dev\.js((\?|#).*)?$/i, "/dist-dev/index.umd.js$1");
      }
    } catch {
      /* ignored */
    }
    return null;
  }

  const SDK_URL =
    window.ALPHABLOCKS_SDK_URL ||
    (isLocal
      ? "http://127.0.0.1:5500/dist-dev/index.umd.js"
      : defaultSdkUrlFromCurrentScript() ||
        "https://unpkg.com/asa-sdk@latest/dist-dev/index.umd.js");

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

  function resolveEmbedConfig() {
    let token =
      typeof document !== "undefined" && document.currentScript
        ? normalizeToken(document.currentScript.getAttribute("data-token"))
        : null;
    let userId =
      typeof document !== "undefined" && document.currentScript
        ? normalizeUserId(document.currentScript.getAttribute("data-user-id"))
        : undefined;

    if (!token || !userId) {
      const scripts = document.querySelectorAll(LOADER_SCRIPT_SELECTOR);
      for (let i = 0; i < scripts.length; i++) {
        if (!token) token = normalizeToken(scripts[i].getAttribute("data-token"));
        if (!userId) userId = normalizeUserId(scripts[i].getAttribute("data-user-id"));
        if (token && userId) break;
      }
    }

    if (typeof window !== "undefined") {
      if (!token) {
        token =
          normalizeToken(window.ALPHABLOCKS_TOKEN) ||
          normalizeToken(window.alphablocksConfig?.token);
      }
      if (!userId) {
        userId =
          normalizeUserId(window.ALPHABLOCKS_USER_ID) ||
          normalizeUserId(window.alphablocksConfig?.userId);
      }
    }

    return { token: token || null, userId: userId || undefined };
  }

  function injectPreconnect() {
    try {
      const origin = new URL(SDK_URL).origin;
      const head = document.head || document.documentElement;
      if (head.querySelector('link[rel="preconnect"][href="' + origin + '"]')) return;
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      link.crossOrigin = "";
      head.appendChild(link);
    } catch {
      /* ignored */
    }
  }

  function getMountStrategy() {
    const conn = (typeof navigator !== "undefined" && navigator.connection) || {};
    if (conn.saveData) return { mode: "timeout", timeoutMs: 8000 };
    switch (conn.effectiveType) {
      case "slow-2g":
      case "2g":
        return { mode: "timeout", timeoutMs: 8000 };
      case "3g":
        return { mode: "idle", timeoutMs: 4000 };
      case "4g":
      default:
        return { mode: "idle", timeoutMs: 1500 };
    }
  }

  function scheduleIframeMount(assistant) {
    let mounted = false;
    let cleanup = function () {};

    function mount() {
      if (mounted) return;
      mounted = true;
      try {
        cleanup();
      } catch {
        /* ignored */
      }
      try {
        assistant.showAssistant();
      } catch (error) {
        console.error("AlphaBlocks: Failed to mount widget iframe", error);
      }
    }

    function afterLoad() {
      const { mode, timeoutMs } = getMountStrategy();
      const interactionEvents = ["scroll", "pointerdown", "keydown", "touchstart"];
      const removeInteraction = function () {
        for (let i = 0; i < interactionEvents.length; i++) {
          window.removeEventListener(interactionEvents[i], mount, true);
        }
      };
      for (let i = 0; i < interactionEvents.length; i++) {
        window.addEventListener(interactionEvents[i], mount, {
          once: true,
          passive: true,
          capture: true,
        });
      }

      if (mode === "idle" && typeof requestIdleCallback === "function") {
        const idleId = requestIdleCallback(mount, { timeout: timeoutMs });
        cleanup = function () {
          removeInteraction();
          if (typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
        };
        return;
      }

      const timerId = setTimeout(mount, timeoutMs);
      cleanup = function () {
        removeInteraction();
        clearTimeout(timerId);
      };
    }

    if (document.readyState === "complete") {
      afterLoad();
      return;
    }

    let scheduled = false;
    const triggerAfterLoad = function () {
      if (scheduled) return;
      scheduled = true;
      afterLoad();
    };
    const safetyTimer = setTimeout(triggerAfterLoad, 10000);
    window.addEventListener(
      "load",
      function () {
        clearTimeout(safetyTimer);
        triggerAfterLoad();
      },
      { once: true },
    );
  }

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

      const eagerMount =
        typeof window !== "undefined" &&
        window.alphablocksConfig &&
        window.alphablocksConfig.lazyMount === "eager";
      if (eagerMount) {
        assistant.showAssistant();
        return;
      }

      scheduleIframeMount(assistant);
    } catch (error) {
      console.error("AlphaBlocks: Failed to initialize widget", error);
    }
  }

  function initWidgetSafely(token, userId) {
    initWidget(token, userId).catch((error) => {
      console.error("AlphaBlocks: Failed to initialize widget", error);
    });
  }

  function loadSDK(token, userId) {
    if (window.AlphaBlocks) {
      initWidgetSafely(token, userId);
      return;
    }

    const existingScript = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => initWidgetSafely(token, userId), {
        once: true,
      });
      if (window.AlphaBlocks) initWidgetSafely(token, userId);
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      initWidgetSafely(token, userId);
    };
    script.onerror = () => {
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
    if (window[EMBED_GUARD_KEY]) return;

    const { token, userId } = resolveEmbedConfig();

    if (!token) {
      console.error(
        'AlphaBlocks: Token not found. Please add data-token="pk_xxx" to the script tag or set window.ALPHABLOCKS_TOKEN',
      );
      return;
    }
    window[EMBED_GUARD_KEY] = true;

    injectPreconnect();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => scheduleLoadSDK(token, userId));
    } else {
      scheduleLoadSDK(token, userId);
    }
  }

  init();
})();
