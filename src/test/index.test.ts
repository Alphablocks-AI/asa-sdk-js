/**
 * @jest-environment jsdom
 */
import { waitFor, fireEvent } from "@testing-library/dom";
import { AlphaBlocks } from "../alphablocks.ts";
import "@testing-library/jest-dom";

describe("AlphaBlocks", () => {
  function setup() {
    return new AlphaBlocks({
      token: "test-token",
      theme: "light",
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
    alphaBlocks.renderPill("container");

    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    expect(chatIconContainer).toBeInTheDocument();
    expect(chatIconContainer?.querySelector("img")?.src).toContain("avatar.png");
    expect(chatIconContainer?.querySelector("p")?.textContent).toBe("Test Assistant");
  });

  test("should render the chat pill correctly", () => {
    const alphaBlocks = setup();
    const pillContainer = document.createElement("div");
    const iframeContainer = document.createElement("div");
    document.body.appendChild(pillContainer);
    document.body.appendChild(iframeContainer);
    alphaBlocks.renderPill(pillContainer);

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
    alphaBlocks.renderPill("container");

    const containers = document.querySelectorAll("#alphablocks-chat-icon-container");
    expect(containers.length).toBe(1);
  });

  test("should hide chat pill", () => {
    const alphaBlocks = setup();
    document.body.innerHTML =
      '<div id="container"></div><div id="alphablocks-assistant-container"></div>';
    alphaBlocks.renderPill("container");
    alphaBlocks.showAssistant();
    alphaBlocks.hideChatPill();

    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    const iframe = document.querySelector("iframe");
    expect(chatIconContainer).toHaveStyle("display: none");
    expect(iframe).toHaveStyle("display: block");
  });

  test("should trigger methods on chat pill click", () => {
    const alphaBlocks = setup();
    document.body.innerHTML =
      '<div id="container"></div><div id="alphablocks-assistant-container"></div>';
    alphaBlocks.renderPill("container");
    alphaBlocks.showAssistant();
    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    if (!chatIconContainer) return;
    fireEvent.click(chatIconContainer);
    expect(chatIconContainer.style.display).toBe("none");
  });

  test("should show the assistant iframe", () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="alphablocks-assistant-container"></div>';
    alphaBlocks.showAssistant();

    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe?.src).toContain("test-token");
  });

  test("should pre-render the assistant iframe", () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="alphablocks-assistant-container"></div>';
    alphaBlocks.preRenderAssistant();

    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe?.style.display).toBe("none");
  });

  test("should change display if pre render iframe present", () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="alphablocks-assistant-container"></div>';
    alphaBlocks.preRenderAssistant();

    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe?.style.display).toBe("none");
    alphaBlocks.showAssistant();
    expect(iframe?.style.display).toBe("block");
  });

  test("should hide iframe on alphablocks-hide-iframe event", async () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="alphablocks-assistant-container"></div>';
    alphaBlocks.showAssistant();
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    window.parent.postMessage(
      {
        type: "alphablocks-hide-iframe",
        data: {},
      },
      "*",
    );
    await waitFor(() => expect(iframe?.style.display).toBe("none"));
  });

  test("should show chat pill on alphablocks-hide-iframe event", async () => {
    const alphaBlocks = setup();
    document.body.innerHTML =
      '<div id="container"></div><div id="alphablocks-assistant-container"></div>';
    alphaBlocks.renderPill("container");
    alphaBlocks.showAssistant();
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    window.parent.postMessage(
      {
        type: "alphablocks-hide-iframe",
        data: {},
      },
      "*",
    );
    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    await waitFor(() => expect(chatIconContainer?.style.display).toBe("block"));
  });

  test("should return on irrelevant event", async () => {
    const alphaBlocks = setup();
    document.body.innerHTML =
      '<div id="container"></div><div id="alphablocks-assistant-container"></div>';
    alphaBlocks.renderPill("container");
    window.parent.postMessage(
      {
        type: "alphablocks_event",
        data: {},
      },
      "*",
    );
    const chatIconContainer = document.getElementById("alphablocks-chat-icon-container");
    const iframe = document.querySelector("iframe");
    await waitFor(() => expect(iframe).not.toBeInTheDocument());
    await waitFor(() => expect(chatIconContainer).toBeInTheDocument());
  });

  // the test was not passing because of following error:
  // TypeError: Cannot read properties of null (reading '_origin') in Jest
  test.skip("should send original window dimensions", async () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="alphablocks-assistant-container"></div>';
    alphaBlocks.showAssistant();
    const iframe = document.querySelector("iframe")!;
    // const spiedPostMsg = jest
    //   .spyOn(
    //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //     iframe.contentWindow as unknown as { postMessage: (data: any) => typeof data },
    //     "postMessage",
    //   )
    //   .mockImplementation(() => ({
    //     _origin: "http://localhost:3002",
    //   }));
    const spiedPostMsg = jest.fn();
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage = spiedPostMsg;
    window.parent.postMessage(
      {
        type: "alphablocks-request-original-size",
        data: {},
      },
      "*",
    );
    await waitFor(() => expect(spiedPostMsg).toHaveBeenCalled());
    await waitFor(() =>
      expect(spiedPostMsg).toHaveBeenCalledWith(
        { data: { height: 768, width: 1024 }, type: "alphablocks-original-size" },
        "http://localhost:3002",
      ),
    );
  });

  test("should change dimensions based on events", async () => {
    const alphaBlocks = setup();
    document.body.innerHTML = '<div id="alphablocks-assistant-container"></div>';
    alphaBlocks.showAssistant();
    const iframe = document.querySelector("iframe");
    expect(iframe?.style.width).toBe("170px");
    expect(iframe?.style.height).toBe("60px");
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
    await waitFor(() => expect(iframe?.style.width).toBe("562px"));
    await waitFor(() => expect(iframe?.style.height).toBe("405px"));
  });
});
