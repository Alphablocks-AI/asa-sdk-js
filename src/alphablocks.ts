import { AlphaBlocksConstructor, AssistantProperties, IFrameDimensions } from "./types.ts";
// eslint-disable-next-line no-undef
export const CHATBOT_URL = process.env.SDK_URL as string;
export const ALPHABLOCKS_WRAPPER_ID = "alphablocks-assistant-container";

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

function createWrapper() {
  const wrapperDiv = document.createElement("div");
  wrapperDiv.setAttribute("id", ALPHABLOCKS_WRAPPER_ID);
  wrapperDiv.style.position = "fixed";
  wrapperDiv.style.right = "24px";
  wrapperDiv.style.bottom = "24px";
  document.body.appendChild(wrapperDiv);
}

function updateWrapperProperties(assistantProperties: AssistantProperties) {
  const wrapperDiv = getElement(ALPHABLOCKS_WRAPPER_ID);
  switch (assistantProperties.position) {
    case "bottom-left": {
      wrapperDiv.style.left = "24px";
      break;
    }
    case "bottom-center": {
      wrapperDiv.style.left = "50%";
      wrapperDiv.style.transform = "translateX(-50%)";
      break;
    }
    default: {
      wrapperDiv.style.right = "24px";
      break;
    }
  }
}

function createIFrame(token: string, theme: string, name: string, version: number) {
  const iframe = document.createElement("iframe");
  const width = name.length <= 7 ? "110px" : name.length <= 15 ? "160px" : "225px";
  iframe.src = `${CHATBOT_URL}/?token=${token}&version=${version}&theme=${theme}`;
  iframe.style.width = version == 1 ? width : "562px";
  iframe.style.height = version == 1 ? "60px" : "545px";
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
  const wrapperDiv = getElement(ALPHABLOCKS_WRAPPER_ID);
  iframe.style.height = properties.height;
  iframe.style.width = properties.width;
  wrapperDiv.style.right = "24px";
  wrapperDiv.style.bottom = "24px";
  wrapperDiv.style.width = "fit-content";
  if (properties.right && properties.left && properties.bottom) {
    wrapperDiv.style.right = properties.right;
    wrapperDiv.style.bottom = properties.bottom;
    wrapperDiv.style.width = "100%";
  }
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
  assistantTheme: string = "";
  assistantName: string = "";
  assistantAvatar: string = "";
  assistantColor: string = "";
  assistantTextColor: string = "";
  iframe: HTMLIFrameElement | null = null;

  constructor({ token, name, avatar, bgColor, textColor, theme }: AlphaBlocksConstructor) {
    this.token = token;
    this.assistantName = name || "";
    this.assistantAvatar = avatar || "";
    this.assistantColor = bgColor || "";
    this.assistantTextColor = textColor || "";
    this.assistantTheme = theme || "";
    window.addEventListener("message", (event) => {
      handleEvents(event.data.type, event.data.data, this.iframe);
    });
  }

  renderPill(this: AlphaBlocks, container: string | HTMLElement) {
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
        this.showAssistant();
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

  showAssistant() {
    const element = getElement(ALPHABLOCKS_WRAPPER_ID);
    const iframe = element.querySelector("iframe");
    if (!iframe) {
      const iframe = createIFrame(this.token, this.assistantTheme, this.assistantName, 1);
      element.style.zIndex = "2147480000";
      element.appendChild(iframe);
      this.iframe = iframe;
      return;
    }
    iframe.src = `${CHATBOT_URL}/?token=${this.token}&version=1&theme=${this.assistantTheme}`;
    iframe.style.display = "block";
  }

  async renderWrapper() {
    createWrapper();
    const response = await fetch(
      `https://api-prod.alphablocks.ai/api/v1/assistant/widget/assistant-details/?token=${this.token}`,
      {
        headers: { Authorization: "Bearer " + this.token, "Content-Type": "*" },
      },
    );
    const data = await response.json();
    this.assistantName = data.data.name;
    updateWrapperProperties(data.data);
  }

  showAssistantOnBtnClick() {
    const element = getElement(ALPHABLOCKS_WRAPPER_ID);
    const iframe = element.querySelector("iframe");
    if (!iframe) {
      const iframe = createIFrame(this.token, this.assistantTheme, this.assistantName, 2);
      element.style.zIndex = "2147480000";
      element.appendChild(iframe);
      this.iframe = iframe;
      return;
    }
    iframe.src = `${CHATBOT_URL}/?token=${this.token}&version=2&theme=${this.assistantTheme}`;
    iframe.style.display = "block";
  }

  preRenderAssistant() {
    const iframe = createIFrame(this.token, this.assistantTheme, this.assistantName, 2);
    iframe.style.display = "none";
    this.iframe = iframe;
    const element = getElement(ALPHABLOCKS_WRAPPER_ID);
    element.style.zIndex = "2147480000";
    element.appendChild(iframe);
  }
}
