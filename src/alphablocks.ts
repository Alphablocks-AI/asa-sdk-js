import { ALPHABLOCKS_WRAPPER_ID, CHATBOT_URL } from "./constants/index.ts";
import { AlphaBlocksConstructor, IFrameDimensions } from "./types/index.ts";
import { getAssistantDetails, getEndUser } from "./utils/api.ts";
import { getCookie, sendSessionCookie, setCookie } from "./utils/cookie.ts";
import {
  createWrapper,
  getChatIconHTML,
  getElement,
  updateWrapperProperties,
} from "./utils/dom.ts";
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

  constructor(props: AlphaBlocksConstructor) {
    this.token = props.token;
    this.assistantName = props.name || "";
    this.assistantAvatar = props.avatar || "";
    this.assistantColor = props.bgColor || "";
    this.assistantTextColor = props.textColor || "";
    this.assistantTheme = props.theme || "";
    this.assistantId = props.id || null;
    this.endUserId = props.endUserId || "";

    window.addEventListener("message", (event) => {
      this.handleEvents(event.data.type, event.data.data);
    });
  }

  private handleEvents(type: string, data: IFrameDimensions): void {
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
    }
  }

  private handleSessionCookie(): void {
    if (!this.assistantId) return;

    let isExisted = true;
    let sessionCookie = getCookie(`alphablocks-sessionId-${this.assistantId}`);

    if (!sessionCookie) {
      isExisted = false;
      sessionCookie = setCookie(`alphablocks-sessionId-${this.assistantId}`);
    }

    this.endUserId = sessionCookie;
    sendSessionCookie(sessionCookie, this.iframe, isExisted);
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
    const data = await getAssistantDetails(this.token);
    if (data) {
      this.assistantName = data.data.name;
      this.assistantId = data.data.id;
      updateWrapperProperties(data.data);
    }
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
      await getEndUser(this.assistantId, this.endUserId);
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
