import { AlphaBlocksConstructor } from "./types";

function getElement(container: string | HTMLElement) {
  if (typeof container === "string") {
    const element = document.getElementById(container);
    if (!element) throw new Error("Container not found");
    return element;
  }
  return container;
}

function getAssistantHTML(
  name: string,
  avatar: string,
  bgColor: string,
  textColor: string,
): string {
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
  iframe.src = `http://localhost:3002/?token=${token}&version=2`;
  iframe.style.width = "570px";
  iframe.style.height = "420px";
  iframe.style.border = "none";
  return iframe;
}

export class AlphaBlocks {
  token: string;
  assistantName: string;
  assistantAvatar: string;
  assistantColor: string;
  assistantTextColor: string;

  constructor({ token, name, avatar, bgColor, textColor }: AlphaBlocksConstructor) {
    this.token = token;
    this.assistantName = name;
    this.assistantAvatar = avatar;
    this.assistantColor = bgColor;
    this.assistantTextColor = textColor;
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
    const assistantHTML = getAssistantHTML(
      this.assistantName,
      this.assistantAvatar,
      this.assistantColor,
      this.assistantTextColor,
    );
    element.insertAdjacentHTML("beforeend", assistantHTML);
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
  }

  showAssistant(this: AlphaBlocks, assistantContainer: string | HTMLElement) {
    const element = getElement(assistantContainer);
    const iframe = element.querySelector("iframe");
    if (!iframe) {
      const iframe = createIFrame(this.token);
      element.appendChild(iframe);
      return;
    }
    iframe.style.display = "block";
  }

  preRenderAssistant(this: AlphaBlocks, assistantContainer: string | HTMLElement) {
    const iframe = createIFrame(this.token);
    iframe.style.display = "none";
    const element = getElement(assistantContainer);
    element.appendChild(iframe);
  }
}
