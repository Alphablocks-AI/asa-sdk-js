/**
 * @jest-environment jsdom
 */
import { setIframeSize } from "../utils/iframe.ts";
import { getOrCreateFrameWrapper } from "../utils/dom.ts";

describe("setIframeSize mobileView", () => {
  test("sets iframe dimensions for full-bleed mobile chat", () => {
    document.body.innerHTML = `<div id="alphablocks-assistant-container"></div>`;
    const container = document.getElementById("alphablocks-assistant-container")!;
    const frameWrapper = getOrCreateFrameWrapper(container);
    const iframe = document.createElement("iframe");
    iframe.style.height = "60px";
    frameWrapper.appendChild(iframe);

    setIframeSize(
      {
        event: "mobileView",
        width: "100%",
        height: "100dvh",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
      iframe,
    );

    expect(iframe.style.width).toBe("100%");
    expect(iframe.style.height).not.toBe("60px");
    expect(["100dvh", "100vh"]).toContain(iframe.style.height);
    expect(frameWrapper.style.visibility).toBe("visible");
  });
});
