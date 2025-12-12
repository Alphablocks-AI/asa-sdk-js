import {
  ALPHABLOCKS_WRAPPER_ID,
  CHATBOT_URL,
  ASSISTANT_DETAILS_STORAGE_KEY,
} from "./constants/index.ts";
import { AlphaBlocksConstructor, EventDataType, CustomCSSProperties } from "./types/index.ts";
import { getAssistantDetails, getEndUser } from "./utils/api.ts";
import { getCookie, sendCookie, setCookie } from "./utils/cookie.ts";
import {
  createWrapper,
  getChatIconHTML,
  getElement,
  updateWrapperProperties,
} from "./utils/dom.ts";
import { setCustomOffsets } from "./utils/dom.ts";
import {
  handleAddProductToCart,
  handleGetCartDetails,
  handleSetCartAttributes,
} from "./utils/event-handler.ts";
import {
  createIFrame,
  hideIframe,
  sendOriginalWindowMessage,
  sendParentUrlParams,
  setIframeSize,
} from "./utils/iframe.ts";

export class AlphaBlocks {
  private token: string;
  private assistantTheme: string = "";
  private assistantName: string = "";
  private assistantId: number | null = null;
  private assistantAvatar: string = "";
  private assistantColor: string = "";
  private assistantTextColor: string = "";
  private iframe: HTMLIFrameElement | null = null;
  public endUserId: string = "";
  public userId: string = "";

  constructor(props: AlphaBlocksConstructor) {
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
      case "alphablocks-nudge-render":
        if (!this.iframe) return;
        this.iframe.style.display = "block";
        break;
    }
  }

  private handleSessionCookie(): void {
    if (!this.token) return;

    let isExisted = true;
    let sessionCookie = getCookie(`alphablocks-sessionId-${this.token}`);

    if (sessionCookie === "28ab532d") {
      isExisted = false;
      sessionCookie = setCookie(`alphablocks-sessionId-${this.token}`, "sessionId");
    }

    if (!sessionCookie) {
      isExisted = false;
      sessionCookie = setCookie(`alphablocks-sessionId-${this.token}`, "sessionId");
    }
    console.log("this.userId", this.userId);
    this.endUserId = sessionCookie;
    sendCookie(
      { sessionCookie, cookieIsExisted: isExisted, userId: this.userId },
      this.iframe,
      "session-cookie",
    );
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
      document.location.reload();
    }
  }

  private async handleCartUpdates(event: string, data: EventDataType): Promise<void> {
    if (event === "alphablocks-set-cart-attributes") {
      await handleSetCartAttributes(this.assistantId, this.endUserId);
    }
    if (event === "alphablocks-add-product-to-cart") {
      await handleAddProductToCart(
        data.variantId,
        data.quantity,
        this.iframe,
        this.assistantId,
        this.endUserId,
      );
    }
    if (event === "alphablocks-get-cart-details") {
      await handleGetCartDetails(this.iframe);
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

  public showAssistant(): void {
    const element = getElement(ALPHABLOCKS_WRAPPER_ID);
    let iframe = element.querySelector("iframe");

    if (!iframe) {
      iframe = createIFrame(this.token, this.assistantTheme, this.assistantName, 1);
      element.style.zIndex = "2147480000";
      element.appendChild(iframe);
      this.iframe = iframe;
      return;
    }

    iframe.src = `${CHATBOT_URL}/?token=${this.token}&version=1&theme=${this.assistantTheme}`;
    iframe.style.display = "block";
  }

  public async renderWrapper(): Promise<void> {
    createWrapper();

    const storageKey = `${ASSISTANT_DETAILS_STORAGE_KEY}-${this.token}`;
    const cachedAssistantDetails = sessionStorage.getItem(storageKey);
    if (cachedAssistantDetails) {
      const parsedAssistantDetails = JSON.parse(cachedAssistantDetails);
      if (parsedAssistantDetails) {
        this.assistantName = parsedAssistantDetails.name;
        this.assistantId = parsedAssistantDetails.id;
        updateWrapperProperties(parsedAssistantDetails);
        return;
      }
    }

    const data = await getAssistantDetails(this.token);
    if (data && data.data?.assistant_details) {
      this.assistantName = data.data.name;
      this.assistantId = data.data.id;
      sessionStorage.setItem(storageKey, JSON.stringify(data.data.assistant_details));
      updateWrapperProperties(data.data.assistant_details);
    }
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
      element.appendChild(iframe);
      this.iframe = iframe;
    } else {
      iframe.style.display = "block";
    }

    if (this.assistantId && this.endUserId) {
      await getEndUser(this.assistantId, this.endUserId, this.userId);
    }
  }

  public preRenderAssistant(): void {
    const iframe = createIFrame(this.token, this.assistantTheme, this.assistantName, 2);
    iframe.style.display = "none";
    this.iframe = iframe;
    const element = getElement(ALPHABLOCKS_WRAPPER_ID);
    element.style.zIndex = "2147480000";
    element.appendChild(iframe);
  }
}
