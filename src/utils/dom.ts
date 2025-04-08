import { ALPHABLOCKS_WRAPPER_ID } from "../constants/index.ts";

export function getElement(container: string | HTMLElement): HTMLElement {
  if (typeof container === "string") {
    const element = document.getElementById(container);
    if (!element) throw new Error("Container not found");
    return element;
  }
  return container;
}

export function createWrapper(): void {
  const wrapperDiv = document.createElement("div");
  wrapperDiv.setAttribute("id", ALPHABLOCKS_WRAPPER_ID);
  wrapperDiv.style.position = "fixed";
  wrapperDiv.style.right = "24px";
  wrapperDiv.style.bottom = "24px";
  document.body.appendChild(wrapperDiv);
}

export function updateWrapperProperties(properties: { position: string }): void {
  const wrapperDiv = getElement(ALPHABLOCKS_WRAPPER_ID);
  wrapperDiv.style.left = "";
  wrapperDiv.style.right = "";
  wrapperDiv.style.transform = "";

  switch (properties.position) {
    case "bottom-left":
      wrapperDiv.style.left = "24px";
      break;
    case "bottom-center":
      wrapperDiv.style.left = "50%";
      wrapperDiv.style.transform = "translateX(-50%)";
      break;
    default:
      wrapperDiv.style.right = "24px";
      break;
  }
}

export function getChatIconHTML(
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
