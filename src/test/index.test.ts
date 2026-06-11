/**
 * @jest-environment jsdom
 */
import { waitFor } from "@testing-library/dom";
import { AlphaBlocks } from "../alphablocks.ts";
import "@testing-library/jest-dom";

describe("AlphaBlocks", () => {
  let alphaBlocks: AlphaBlocks;
  let originalContentWindow: PropertyDescriptor | undefined;

  const defaultProps = {
    token: "test-token",
    theme: "light",
    name: "Test Assistant",
    avatar: "avatar.png",
    bgColor: "blue",
    textColor: "white",
  };

  beforeEach(() => {
    document.body.innerHTML = "";
    alphaBlocks = new AlphaBlocks(defaultProps);

    originalContentWindow = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      "contentWindow",
    );

    globalThis.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ data: { name: "Test Assistant", id: 1 } }),
      }),
    ) as jest.Mock;
  });

  afterEach(() => {
    if (originalContentWindow) {
      Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", originalContentWindow);
    }
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("Initialization", () => {
    test("should create instance with constructor props", () => {
      expect(alphaBlocks).toBeInstanceOf(AlphaBlocks);
    });
  });

  describe("renderPill", () => {
    test("should throw error if no container provided", () => {
      expect(() => alphaBlocks.renderPill("")).toThrow("Please provide either id or element");
    });

    test("should throw error if assistant details missing", () => {
      const incompleteAlpha = new AlphaBlocks({ token: "test-token" });
      expect(() => incompleteAlpha.renderPill("container")).toThrow(
        "Please provide assistant details",
      );
    });

    test("should render chat pill in container", () => {
      document.body.innerHTML = '<div id="container"></div>';
      alphaBlocks.renderPill("container");
      const chatIcon = document.getElementById("alphablocks-chat-icon-container");
      expect(chatIcon).toBeInTheDocument();
      expect(chatIcon?.querySelector("img")).toHaveAttribute("src", "avatar.png");
      expect(chatIcon?.querySelector("p")?.textContent).toBe("Test Assistant");
    });

    test("should not duplicate chat pill if already exists", () => {
      document.body.innerHTML = '<div id="container"></div>';
      alphaBlocks.renderPill("container");
      alphaBlocks.renderPill("container");
      const chatIcons = document.querySelectorAll("#alphablocks-chat-icon-container");
      expect(chatIcons.length).toBe(1);
    });
  });

  describe("hideChatPill", () => {
    test("should hide chat pill and show iframe", () => {
      document.body.innerHTML = `
        <div id="container"></div>
        <div id="alphablocks-assistant-container"></div>
      `;
      alphaBlocks.renderPill("container");
      alphaBlocks.showAssistant();
      alphaBlocks.hideChatPill();

      const chatIcon = document.getElementById("alphablocks-chat-icon-container");
      const iframe = document.querySelector("iframe");
      expect(chatIcon).toHaveStyle("display: none");
      expect(iframe?.style.display).toBe("block");
    });
  });

  describe("showAssistant", () => {
    test("should reuse existing iframe", async () => {
      document.body.innerHTML = '<div id="alphablocks-assistant-container"></div>';
      alphaBlocks.showAssistant();
      const firstIframe = document.querySelector("iframe");
      alphaBlocks.showAssistant();
      await waitFor(() => {
        const allIframes = document.querySelectorAll("iframe");
        expect(allIframes.length).toBe(1);
        expect(allIframes[0]).toBe(firstIframe);
      });
    });
  });

  describe("renderWrapper", () => {
    test("should create wrapper and fetch assistant details", async () => {
      await alphaBlocks.renderWrapper();
      const wrapper = document.getElementById("alphablocks-assistant-container");
      expect(wrapper).toBeInTheDocument();
      expect(wrapper?.style.position).toBe("fixed");
      expect(wrapper?.style.right).toBe("24px");
      expect(wrapper?.style.bottom).toBe("24px");
      expect(wrapper?.style.zIndex).toBe("2147480000");
      expect(wrapper?.style.boxShadow).toBe("");
      expect(wrapper?.style.borderRadius).toBe("");
      expect(wrapper?.querySelector(".alphablocks-frame-wrapper")).toBeNull();
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  describe("preRenderAssistant", () => {
    test("should create hidden iframe inside frame wrapper", () => {
      document.body.innerHTML = '<div id="alphablocks-assistant-container"></div>';
      alphaBlocks.preRenderAssistant();
      const container = document.getElementById("alphablocks-assistant-container");
      const frameWrapper = container?.querySelector(
        ".alphablocks-frame-wrapper",
      ) as HTMLElement | null;
      const iframe = frameWrapper?.querySelector("iframe");
      expect(frameWrapper).toBeInTheDocument();
      expect(iframe).toBeInTheDocument();
      expect(iframe?.style.display).toBe("none");
      expect(frameWrapper?.style.boxShadow).toBe("rgba(9, 14, 21, 0.16) 0px 5px 40px 0px");
      expect(frameWrapper?.style.borderRadius).toBe("");
      expect(frameWrapper?.style.background).toBe("transparent");
      expect(frameWrapper?.style.overflow).toBe("hidden");
      expect(frameWrapper?.style.visibility).toBe("hidden");
      expect(iframe?.style.boxShadow).toBe("");
      expect(iframe?.style.borderRadius).toBe("");
    });
  });

  describe("Event Handling", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="container"></div>
        <div id="alphablocks-assistant-container"></div>
      `;
      alphaBlocks.renderPill("container");
      alphaBlocks.showAssistant();

      const iframe = document.querySelector("iframe");
      if (iframe) {
        Object.defineProperty(iframe, "contentWindow", {
          value: {
            postMessage: jest.fn(),
          },
          writable: true,
        });
      }
    });

    test("should handle resize event", async () => {
      const iframe = document.querySelector("iframe");
      const frameWrapper = document.querySelector(
        ".alphablocks-frame-wrapper",
      ) as HTMLElement | null;
      window.postMessage(
        {
          type: "alphablocks-resize",
          data: { width: "600px", height: "400px", frameBorderRadius: "24px" },
        },
        "*",
      );
      await waitFor(() => {
        expect(iframe?.style.width).toBe("600px");
        expect(iframe?.style.height).toBe("400px");
        expect(frameWrapper?.style.visibility).toBe("visible");
      });
    });

    test("should remove host shadow for nudge resize events", async () => {
      const iframe = document.querySelector("iframe");
      const frameWrapper = document.querySelector(
        ".alphablocks-frame-wrapper",
      ) as HTMLElement | null;
      window.postMessage(
        {
          type: "alphablocks-resize",
          data: {
            event: "productPageNudgeView",
            width: "342px",
            height: "240px",
            frameBorderRadius: "0.75rem",
          },
        },
        "*",
      );
      await waitFor(() => {
        expect(frameWrapper?.style.boxShadow).toBe("none");
        expect(frameWrapper?.style.background).toBe("transparent");
        expect(frameWrapper?.style.overflow).toBe("visible");
        expect(iframe?.style.background).toBe("transparent");
      });
    });

    test("should handle hide iframe event", async () => {
      const iframe = document.querySelector("iframe");
      const chatIcon = document.getElementById("alphablocks-chat-icon-container");
      window.postMessage({ type: "alphablocks-hide-iframe", data: {} }, "*");
      await waitFor(() => {
        expect(iframe?.style.display).toBe("none");
        expect(chatIcon?.style.display).toBe("block");
      });
    });
  });
});
