import {
  ALPHABLOCKS_WRAPPER_ID,
  ASA_STOREFRONT_ACTION_ATTR,
  ASA_STOREFRONT_MESSAGE_ATTR,
  ASSISTANT_DETAILS_STORAGE_KEY,
  NUDGE_DEV_ENABLED,
} from "./constants/index.ts";
import { AlphaBlocksConstructor, EventDataType, CustomCSSProperties } from "./types/index.ts";
import { getAssistantDetails, getEndUser, getSessionDetails } from "./utils/api.ts";
import { getCookie, sendCookie, setCookie } from "./utils/cookie.ts";
import {
  createWrapper,
  getChatIconHTML,
  getElement,
  getOrCreateFrameWrapper,
  hideFrameWrapperUntilReady,
  revealFrameWrapper,
  syncFrameWrapperSize,
  updateWrapperProperties,
} from "./utils/dom.ts";
import { setCustomOffsets } from "./utils/dom.ts";
import {
  handleAddProductToCart,
  handleCheckSearchProducts,
  handleGetCartDetails,
  handleSetCartAttributes,
} from "./utils/event-handler.ts";
import {
  buildWidgetIframeSrc,
  createIFrame,
  hideIframe,
  sendOriginalWindowMessage,
  sendParentUrlParams,
  setIframeAccessibleTitle,
  setIframeSize,
  sendStorefrontAction,
  type StorefrontAction,
} from "./utils/iframe.ts";
import {
  installHostScrollDepthReporter,
  resetHostScrollDepthReporter,
} from "./utils/host-scroll-depth.ts";
import {
  installShopifyCartFetchBridge,
  onCartBridgeIframeMounted,
  registerCartAttributeContext,
  registerCartBridgeIframe,
} from "./utils/cart-fetch-bridge.ts";
import { mountNudgeDevPanelIfLocal, NUDGE_DEV_PANEL_ID } from "./utils/nudge-dev-panel.ts";
import { installNudgeScrollQa } from "./utils/nudge-scroll-qa.ts";

installShopifyCartFetchBridge();

let asaStorefrontButtonListenerInstalled = false;

const ASA_STOREFRONT_BTN_SELECTOR = `[${ASA_STOREFRONT_ACTION_ATTR}]`;

function parseStorefrontAction(value: string | null): StorefrontAction | null {
  const action = (value || "").trim().toLowerCase();
  if (action === "btn-open" || action === "btn-ask" || action === "btn-assistant-append")
    return action;
  return null;
}

function installAsaStorefrontButtonListener(
  // eslint-disable-next-line no-unused-vars -- parameter name documents the callback contract
  runStorefrontAction: (action: StorefrontAction, message?: string) => void | Promise<void>,
): void {
  if (typeof document === "undefined" || asaStorefrontButtonListenerInstalled) return;
  asaStorefrontButtonListenerInstalled = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const btn = target.closest(ASA_STOREFRONT_BTN_SELECTOR);
    if (!btn) return;

    const action = parseStorefrontAction(btn.getAttribute(ASA_STOREFRONT_ACTION_ATTR));
    if (!action) return;

    const message = (btn.getAttribute(ASA_STOREFRONT_MESSAGE_ATTR) || "").trim();
    if ((action === "btn-ask" || action === "btn-assistant-append") && !message) return;

    event.preventDefault();
    void Promise.resolve(runStorefrontAction(action, message || undefined));
  });
}

export class AlphaBlocks {
  private token: string;
  private assistantTheme: string = "";
  private assistantName: string = "";
  private assistantId: number | null = null;
  private assistantAvatar: string = "";
  private assistantColor: string = "";
  private assistantTextColor: string = "";
  private iframe: HTMLIFrameElement | null = null;
  private hydratePromise: Promise<void> | null = null;
  public endUserId: string = "";
  public sessionId: string = "";
  public userId: string = "";
  public isActive: boolean = true;

  constructor(props: AlphaBlocksConstructor) {
    registerCartBridgeIframe(() => this.iframe);
    registerCartAttributeContext(() => ({
      assistantId: this.assistantId,
      endUserId: this.endUserId,
      sessionId: this.sessionId,
    }));
    mountNudgeDevPanelIfLocal(() => this.iframe);
    this.token = props.token;
    this.assistantName = props.name || "";
    this.assistantAvatar = props.avatar || "";
    this.assistantColor = props.bgColor || "";
    this.assistantTextColor = props.textColor || "";
    this.assistantTheme = props.theme || "";
    this.assistantId = props.id || null;
    this.endUserId = props.endUserId || "";
    this.userId = props.userId || "";

    window.addEventListener("message", (event) => {
      this.handleEvents(event.data.type, event.data.data);
    });
    window.addEventListener("popstate", () => this.syncParentUrlToWidget());
  }

  /** Push host URL + reset scroll depth to the widget (SPA / scroll QA harness). */
  public syncParentUrlToWidget(): void {
    if (!this.iframe) return;
    resetHostScrollDepthReporter(() => this.iframe);
    sendParentUrlParams(this.iframe, this.assistantId);
  }

  private ensureNudgeScrollQaHarness(): void {
    if (!NUDGE_DEV_ENABLED) return;
    installNudgeScrollQa({
      getAssistant: () => this,
      getNudgeDevPanel: () => document.getElementById(NUDGE_DEV_PANEL_ID),
    });
    if (/^\/products\//.test(location.pathname)) {
      this.syncParentUrlToWidget();
    }
  }

  private handleEvents(type: string, data: EventDataType): void {
    if (!type) return;
    switch (type) {
      case "alphablocks-resize":
        setIframeSize(data, this.iframe);
        break;
      case "alphablocks-request-original-size":
        sendOriginalWindowMessage(this.iframe);
        break;
      case "alphablocks-hide-iframe":
        hideIframe(this.iframe);
        break;
      case "alphablocks-request-session-cookie":
        this.handleSessionCookie();
        break;
      case "alphablocks-request-parent-url":
        sendParentUrlParams(this.iframe, this.assistantId);
        break;
      case "alphablocks-request-cart-cookie":
        this.handleCartCookie("alphablocks-request-cart-cookie", data);
        break;
      case "alphablocks-store-cart-cookie":
        this.handleCartCookie("alphablocks-store-cart-cookie", data);
        break;
      case "alphablocks-set-cart-attributes":
        this.handleCartUpdates("alphablocks-set-cart-attributes", data);
        break;
      case "alphablocks-add-product-to-cart":
        this.handleCartUpdates("alphablocks-add-product-to-cart", data);
        break;
      case "alphablocks-get-cart-details":
        this.handleCartUpdates("alphablocks-get-cart-details", data);
        break;
      case "alphablocks-check-search-products":
        this.handleCartUpdates("alphablocks-check-search-products", data);
        break;
      case "alphablocks-nudge-render":
        if (!this.iframe) return;
        this.iframe.style.display = "block";
        try {
          const container = getElement(ALPHABLOCKS_WRAPPER_ID);
          const frameWrapper = getOrCreateFrameWrapper(container);
          revealFrameWrapper(frameWrapper);
        } catch {
          // container not mounted yet
        }
        break;
    }
  }

  private handleSessionCookie(): void {
    if (!this.token) return;

    void this.resolveAndSendSessionCookie();
  }

  private async resolveAndSendSessionCookie(): Promise<void> {
    const cookieName = `alphablocks-sessionId-${this.token}`;
    const existingCookie = getCookie(cookieName);
    const hasValidExistingCookie = Boolean(existingCookie && existingCookie !== "28ab532d");
    const url = new URL(window.location.href);
    const endUserIdFromParams = (url.searchParams.get("asa_end_user_id") || "").trim();
    const sessionIdFromParams = (url.searchParams.get("asa_web_session_id") || "").trim();

    let isExisted = hasValidExistingCookie;
    let resolvedEndUserId = existingCookie;
    let preferredSessionId = "";

    if (!hasValidExistingCookie) {
      isExisted = false;
      if (endUserIdFromParams) {
        resolvedEndUserId = endUserIdFromParams;
        setCookie(cookieName, "cart", endUserIdFromParams);
        if (sessionIdFromParams) {
          preferredSessionId = sessionIdFromParams;
        }
      } else {
        resolvedEndUserId = setCookie(cookieName, "sessionId");
      }
    } else if (endUserIdFromParams && sessionIdFromParams) {
      const isSameAsCookie = existingCookie === endUserIdFromParams;
      const isParamPairValid = await this.isSessionOwnedByEndUser(
        sessionIdFromParams,
        endUserIdFromParams,
      );
      if (isSameAsCookie || isParamPairValid) {
        resolvedEndUserId = endUserIdFromParams;
        preferredSessionId = sessionIdFromParams;
      } else {
        resolvedEndUserId = existingCookie;
      }
    } else if (endUserIdFromParams && !sessionIdFromParams) {
      resolvedEndUserId = existingCookie;
    }

    this.endUserId = resolvedEndUserId;
    sendCookie(
      {
        sessionCookie: resolvedEndUserId,
        cookieIsExisted: isExisted,
        userId: this.userId,
        preferredSessionId,
      },
      this.iframe,
      "session-cookie",
    );
  }

  private async isSessionOwnedByEndUser(sessionId: string, endUserId: string): Promise<boolean> {
    if (!sessionId || !endUserId || !this.assistantId) return false;
    const sessionData = await getSessionDetails(this.assistantId, this.token, sessionId);
    const beEndUserId = sessionData?.data?.session_details?.end_user_id || "";
    return beEndUserId === endUserId;
  }

  private handleCartCookie(event: string, data: EventDataType): void {
    if (!this.assistantId) return;
    if (event === "alphablocks-request-cart-cookie") {
      const cartCookie = getCookie("cart");
      const cartSig = getCookie("cart_sig");
      sendCookie({ cart: cartCookie, cartSig }, this.iframe, "cart-cookie");
    }
    if (event === "alphablocks-store-cart-cookie") {
      setCookie("cart", "cart", data.cart);
      setCookie("cart_sig", "cart", data.cart_sig);
      window.dispatchEvent(
        new CustomEvent("alphablocks-cart-cookies-updated", {
          detail: { cart: data.cart, cart_sig: data.cart_sig },
        }),
      );
      if (window.alphablocksConfig?.reloadOnCartCookieStore) {
        document.location.reload();
      }
    }
  }

  private async hydrateAssistantDetails(storageKey: string): Promise<void> {
    const data = await getAssistantDetails(this.token);
    if (data && data.data?.assistant_details) {
      const details = data.data.assistant_details;
      this.isActive = details.is_active ?? true;
      if (!this.isActive) {
        sessionStorage.removeItem(storageKey);
        return;
      }
      this.assistantName = data.data.name;
      this.assistantId = data.data.id;
      sessionStorage.setItem(storageKey, JSON.stringify(details));
      updateWrapperProperties(details);
      if (this.iframe) {
        setIframeAccessibleTitle(this.iframe, this.assistantName);
      }
    }
  }

  private async handleCartUpdates(event: string, data: EventDataType): Promise<void> {
    if (event === "alphablocks-set-cart-attributes") {
      if (data.sessionId) {
        this.sessionId = data.sessionId;
      }
      await handleSetCartAttributes(this.assistantId, this.endUserId, this.sessionId);
    }
    if (event === "alphablocks-add-product-to-cart") {
      if (data.sessionId) {
        this.sessionId = data.sessionId;
      }
      await handleAddProductToCart(
        data.variantId,
        data.quantity,
        this.iframe,
        this.assistantId,
        this.endUserId,
        this.sessionId,
      );
    }
    if (event === "alphablocks-get-cart-details") {
      await handleGetCartDetails(this.iframe);
    }
    if (event === "alphablocks-check-search-products") {
      await handleCheckSearchProducts(data.query || "", this.iframe);
    }
  }

  public renderPill(container: string | HTMLElement): void {
    if (!container) throw new Error("Please provide either id or element");
    if (!this.assistantName || !this.assistantAvatar) {
      throw new Error("Please provide assistant details");
    }

    const element = getElement(container);
    if (element.querySelector("#alphablocks-chat-icon-container")) return;

    const chatIconHTML = getChatIconHTML(
      this.assistantName,
      this.assistantAvatar,
      this.assistantColor,
      this.assistantTextColor,
    );

    element.insertAdjacentHTML("beforeend", chatIconHTML);
    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");

    chatIconContainer?.addEventListener("click", () => {
      this.hideChatPill();
      this.showAssistant();
    });
  }

  public hideChatPill(): void {
    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    if (chatIconContainer) {
      chatIconContainer.style.display = "none";
    }
    if (this.iframe) {
      this.iframe.style.display = "block";
    }
  }

  public async showAssistant(): Promise<void> {
    if (this.hydratePromise) await this.hydratePromise;
    if (!this.isActive) return;
    const element = getElement(ALPHABLOCKS_WRAPPER_ID);
    let iframe = element.querySelector("iframe");

    if (!iframe) {
      iframe = createIFrame(this.token, this.assistantTheme, this.assistantName, 1);
      element.style.zIndex = "2147480000";
      const frameWrapper = getOrCreateFrameWrapper(element);
      frameWrapper.appendChild(iframe);
      syncFrameWrapperSize(frameWrapper, iframe);
      this.iframe = iframe;
      onCartBridgeIframeMounted(iframe);
      installHostScrollDepthReporter(() => this.iframe);
      this.ensureNudgeScrollQaHarness();
      return;
    }

    iframe.src = buildWidgetIframeSrc(this.token, 1, this.assistantTheme || "");
    setIframeAccessibleTitle(iframe, this.assistantName);
    hideFrameWrapperUntilReady(getOrCreateFrameWrapper(element));
    iframe.style.display = "block";
    this.iframe = iframe;
    onCartBridgeIframeMounted(iframe);
    installHostScrollDepthReporter(() => this.iframe);
    this.ensureNudgeScrollQaHarness();
  }

  public renderWrapper(): void {
    createWrapper();
    installAsaStorefrontButtonListener((action, message) =>
      this.runStorefrontAction(action, message),
    );

    const storageKey = `${ASSISTANT_DETAILS_STORAGE_KEY}-${this.token}`;
    const cachedAssistantDetails = sessionStorage.getItem(storageKey);
    if (cachedAssistantDetails) {
      try {
        const parsedAssistantDetails = JSON.parse(cachedAssistantDetails);
        if (parsedAssistantDetails) {
          // If is_active is missing from cache (old cache), bust it and re-fetch.
          if (!("is_active" in parsedAssistantDetails)) {
            sessionStorage.removeItem(storageKey);
            this.hydratePromise = this.hydrateAssistantDetails(storageKey);
            return;
          }
          this.isActive = parsedAssistantDetails.is_active;
          this.hydratePromise = Promise.resolve();
          if (!this.isActive) return;
          this.assistantName = parsedAssistantDetails.name;
          this.assistantId = parsedAssistantDetails.id;
          updateWrapperProperties(parsedAssistantDetails);
          if (this.iframe) {
            setIframeAccessibleTitle(this.iframe, this.assistantName);
          }
          return;
        }
      } catch {
        /* invalid JSON in sessionStorage */
      }
      sessionStorage.removeItem(storageKey);
    }

    this.hydratePromise = this.hydrateAssistantDetails(storageKey);
  }

  public addCustomCSS(props: CustomCSSProperties): void {
    setCustomOffsets(props);
  }

  public async showAssistantOnBtnClick(): Promise<void> {
    const element = getElement(ALPHABLOCKS_WRAPPER_ID);
    let iframe = element.querySelector("iframe");

    if (!iframe) {
      iframe = createIFrame(this.token, this.assistantTheme, this.assistantName, 2);
      element.style.zIndex = "2147480000";
      const frameWrapper = getOrCreateFrameWrapper(element);
      frameWrapper.appendChild(iframe);
      syncFrameWrapperSize(frameWrapper, iframe);
      this.iframe = iframe;
      onCartBridgeIframeMounted(iframe);
    } else {
      setIframeAccessibleTitle(iframe, this.assistantName);
      iframe.style.display = "block";
      this.iframe = iframe;
      onCartBridgeIframeMounted(iframe);
    }

    installHostScrollDepthReporter(() => this.iframe);
    this.ensureNudgeScrollQaHarness();

    if (this.assistantId && this.endUserId) {
      await getEndUser(this.assistantId, this.endUserId);
    }
  }

  public preRenderAssistant(): void {
    const iframe = createIFrame(this.token, this.assistantTheme, this.assistantName, 2);
    iframe.style.display = "none";
    this.iframe = iframe;
    onCartBridgeIframeMounted(iframe);
    installHostScrollDepthReporter(() => this.iframe);
    const element = getElement(ALPHABLOCKS_WRAPPER_ID);
    element.style.zIndex = "2147480000";
    const frameWrapper = getOrCreateFrameWrapper(element);
    frameWrapper.appendChild(iframe);
    syncFrameWrapperSize(frameWrapper, iframe);
  }

  private async resolveStorefrontIframe(): Promise<HTMLIFrameElement | null> {
    if (this.hydratePromise) await this.hydratePromise;
    if (!this.isActive) return null;

    const iframe =
      this.iframe ??
      (getElement(ALPHABLOCKS_WRAPPER_ID).querySelector("iframe") as HTMLIFrameElement | null);
    if (!iframe) return null;
    this.iframe = iframe;
    return iframe;
  }

  public async runStorefrontAction(action: StorefrontAction, message?: string): Promise<void> {
    const iframe = await this.resolveStorefrontIframe();
    if (!iframe) return;
    sendStorefrontAction(iframe, action, message);
  }

  public async openChat(): Promise<void> {
    await this.runStorefrontAction("btn-open");
  }

  public async openWithQuestion(question: string): Promise<void> {
    const trimmed = (question || "").trim();
    if (!trimmed) return;
    await this.runStorefrontAction("btn-ask", trimmed);
  }

  public async openWithNudgeIntro(introText: string): Promise<void> {
    const trimmed = (introText || "").trim();
    if (!trimmed) return;
    await this.runStorefrontAction("btn-assistant-append", trimmed);
  }
}
