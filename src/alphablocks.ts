import { AlphaBlocksConstructor, IFrameDimensions } from "./types.ts";
// eslint-disable-next-line no-undef
export const CHATBOT_URL = process.env.SDK_URL as string;

function getElement(container: string | HTMLElement) {
  if (typeof container === "string") {
    const element = document.getElementById(container);
    if (!element) throw new Error("Container not found");
    return element;
  }
  return container;
}

function getChatIconHTML(name: string, avatar: string, bgColor: string, textColor: string): string {
  return `
    <div id="alphablocks-chat-icon-container">
      <button class="alphablocks-chat-icon-btn" style="background-color:${bgColor}">
          <img class="alphablocks-chat-icon-avatar" src="${avatar}" />
          <p class="alphablocks-chat-icon-name" style="color:${textColor}">${name}</p>
      </button>
    </div>`;
}

function createIFrame(token: string) {
  const iframe = document.createElement("iframe");
  iframe.src = `${CHATBOT_URL}/?token=${token}&version=2`;
  iframe.style.width = "562px";
  iframe.style.height = "52px";
  iframe.style.border = "none";
  return iframe;
}

function sendOriginalWindowMessage(iframe: HTMLIFrameElement | null) {
  const message = {
    type: "alphablocks-original-size",
    data: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(message, CHATBOT_URL);
}

function setIframeSize(properties: IFrameDimensions, iframe: HTMLIFrameElement | null) {
  if (!iframe || !properties.height || !properties.width) return;
  iframe.style.height = properties.height;
  iframe.style.width = properties.width;
}

function hideIframe(iframe: HTMLIFrameElement | null) {
  if (!iframe) return;
  iframe.style.display = "none";
  const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
  if (!chatIconContainer) return;
  chatIconContainer.style.display = "block";
}

function handleEvents(type: string, data: IFrameDimensions, iframe: HTMLIFrameElement | null) {
  if (!type) return;
  switch (type) {
    case "alphablocks-resize": {
      setIframeSize(data, iframe);
      break;
    }
    case "alphablocks-request-original-size": {
      sendOriginalWindowMessage(iframe);
      break;
    }
    case "alphablocks-hide-iframe": {
      hideIframe(iframe);
      break;
    }
    default: {
      break;
    }
  }
}

export class AlphaBlocks {
  token: string;
  assistantName: string;
  assistantAvatar: string;
  assistantColor: string;
  assistantTextColor: string;
  iframe: HTMLIFrameElement | null = null;

  constructor({ token, name, avatar, bgColor, textColor }: AlphaBlocksConstructor) {
    this.token = token;
    this.assistantName = name;
    this.assistantAvatar = avatar;
    this.assistantColor = bgColor;
    this.assistantTextColor = textColor;
    window.addEventListener("message", (event) => {
      handleEvents(event.data.type, event.data.data, this.iframe);
    });
  }

  renderPill(
    this: AlphaBlocks,
    container: string | HTMLElement,
    assistantContainer: string | HTMLElement,
  ) {
    if (!container) throw new Error("Please provide either id or element");
    if (!this.assistantName || !this.assistantAvatar)
      throw new Error("Please provide assistant details");
    const element = getElement(container);
    if (element.querySelector("#alphablocks-chat-icon-container")) {
      return;
    }
    const chatIconHTML = getChatIconHTML(
      this.assistantName,
      this.assistantAvatar,
      this.assistantColor,
      this.assistantTextColor,
    );
    element.insertAdjacentHTML("beforeend", chatIconHTML);
    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    if (chatIconContainer) {
      chatIconContainer.addEventListener("click", () => {
        this.hideChatPill();
        this.showAssistant(assistantContainer);
      });
    }
  }

  hideChatPill() {
    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    if (chatIconContainer) {
      chatIconContainer.style.display = "none";
    }
    const iframe = this.iframe;
    if (!iframe) return;
    iframe.style.display = "block";
  }

  showAssistant(this: AlphaBlocks, assistantContainer: string | HTMLElement) {
    const element = getElement(assistantContainer);
    const iframe = element.querySelector("iframe");
    if (!iframe) {
      const iframe = createIFrame(this.token);
      element.style.zIndex = "2147480000";
      element.appendChild(iframe);
      this.iframe = iframe;
      return;
    }
    iframe.style.display = "block";
  }

  preRenderAssistant(this: AlphaBlocks, assistantContainer: string | HTMLElement) {
    const iframe = createIFrame(this.token);
    iframe.style.display = "none";
    this.iframe = iframe;
    const element = getElement(assistantContainer);
    element.style.zIndex = "2147480000";
    element.appendChild(iframe);
  }
}
