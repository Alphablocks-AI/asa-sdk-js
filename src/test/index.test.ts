/**
 * @jest-environment jsdom
 */
import { AlphaBlocks } from "../alphablocks.ts";
import "@testing-library/jest-dom";

describe("AlphaBlocks", () => {
  function setup() {
    return new AlphaBlocks({
      token: "test-token",
      name: "Test Assistant",
      avatar: "avatar.png",
      bgColor: "blue",
      textColor: "white",
    });
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("should create an instance correctly", () => {
    const alphaBlocks = setup();
    expect(alphaBlocks.token).toBe("test-token");
    expect(alphaBlocks.assistantName).toBe("Test Assistant");
    expect(alphaBlocks.assistantAvatar).toBe("avatar.png");
    expect(alphaBlocks.assistantColor).toBe("blue");
    expect(alphaBlocks.assistantTextColor).toBe("white");
  });

  test("should render the chat pill correctly", () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="container"></div>';
    alphaBlocks.renderPill("container", "assistant-container");

    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    expect(chatIconContainer).toBeInTheDocument();
    expect(chatIconContainer?.querySelector("img")?.src).toContain("avatar.png");
    expect(chatIconContainer?.querySelector("p")?.textContent).toBe("Test Assistant");
  });

  test("should not render the chat pill if it already exists", () => {
    const alphaBlocks = setup();
    document.body.innerHTML = `
      <div id="container">
        <div id="alphablocks-chat-icon-container"></div>
      </div>`;
    alphaBlocks.renderPill("container", "assistant-container");

    const containers = document.querySelectorAll("#alphablocks-chat-icon-container");
    expect(containers.length).toBe(1);
  });

  test("should hide chat pill", () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="container"></div><div id="assistant-container"></div>';
    alphaBlocks.renderPill("container", "assistant-container");
    alphaBlocks.hideChatPill();

    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    expect(chatIconContainer).toHaveStyle("display: none");
  });

  test("should show the assistant iframe", () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="assistant-container"></div>';
    alphaBlocks.showAssistant("assistant-container");

    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe?.src).toContain("test-token");
  });

  test("should pre-render the assistant iframe", () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="assistant-container"></div>';
    alphaBlocks.preRenderAssistant("assistant-container");

    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe?.style.display).toBe("none");
  });

  test("should change dimensions based on events", async () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="assistant-container"></div>';
    alphaBlocks.showAssistant("assistant-container");
    const iframe = document.querySelector("iframe");
    expect(iframe?.style.width).toBe("562px");
    expect(iframe?.style.height).toBe("52px");
    window.parent.postMessage(
      {
        type: "alphablocks-resize",
        data: {
          width: "562px",
          height: "405px",
        },
      },
      "*",
    );
    await +(() => expect(iframe?.style.width).toBe("562px"));
    await +(() => expect(iframe?.style.height).toBe("405px"));
  });
});
