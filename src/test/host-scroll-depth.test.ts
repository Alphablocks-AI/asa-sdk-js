/**
 * @jest-environment jsdom
 */
import {
  readHostScrollMetricsForTests,
  resetHostScrollDepthStateForTests,
} from "../utils/host-scroll-depth.ts";

describe("host scroll depth", () => {
  beforeEach(() => {
    resetHostScrollDepthStateForTests();
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2400,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 400,
      writable: true,
    });
  });

  it("reads scroll metrics from the host page", () => {
    const sample = readHostScrollMetricsForTests();
    expect(sample.isShortPage).toBe(false);
    expect(sample.maxDepthPercent).toBe(25);
  });

  it("marks short pages as 100% depth", () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 700,
    });
    const sample = readHostScrollMetricsForTests();
    expect(sample.isShortPage).toBe(true);
    expect(sample.maxDepthPercent).toBe(100);
  });
});
