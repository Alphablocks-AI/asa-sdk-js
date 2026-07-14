import { getIframePostMessageTarget } from "./post-message-target.ts";

export type HostScrollDepthPayload = {
  maxDepthPercent: number;
  scrollHeight: number;
  clientHeight: number;
  isShortPage: boolean;
};

let maxDepthPercent = 0;
let rafId = 0;
let installed = false;
let teardown: (() => void) | null = null;

function readScrollMetrics(): HostScrollDepthPayload {
  const scrollRoot = document.scrollingElement ?? document.documentElement;
  const scrollY = Math.max(0, window.scrollY ?? scrollRoot.scrollTop ?? 0);
  const scrollHeight = scrollRoot.scrollHeight;
  const clientHeight = window.innerHeight;
  const isShortPage = scrollHeight <= clientHeight + 1;
  const scrollable = Math.max(0, scrollHeight - clientHeight);
  const depth =
    isShortPage || scrollable <= 1 ? 100 : Math.min(100, Math.round((scrollY / scrollable) * 100));

  return {
    maxDepthPercent: depth,
    scrollHeight,
    clientHeight,
    isShortPage,
  };
}

function postScrollDepth(iframe: HTMLIFrameElement, payload: HostScrollDepthPayload): void {
  if (!iframe.contentWindow) return;
  iframe.contentWindow.postMessage(
    { type: "alphablocks-host-scroll-depth", data: payload },
    getIframePostMessageTarget(iframe),
  );
}

function publishIfIncreased(iframe: HTMLIFrameElement, sample: HostScrollDepthPayload): void {
  const sampleDepth = sample.isShortPage ? 100 : sample.maxDepthPercent;
  if (sampleDepth <= maxDepthPercent) return;
  maxDepthPercent = sampleDepth;
  postScrollDepth(iframe, {
    ...sample,
    maxDepthPercent: sampleDepth,
  });
}

function onScroll(iframe: HTMLIFrameElement): void {
  if (rafId) return;
  rafId = window.requestAnimationFrame(() => {
    rafId = 0;
    publishIfIncreased(iframe, readScrollMetrics());
  });
}

/**
 * Tracks max host-page scroll depth and posts updates to the widget iframe.
 * Lightweight: rAF-throttled scroll listener, no Framer / no polling.
 */
export function installHostScrollDepthReporter(
  getIframe: () => HTMLIFrameElement | null,
): () => void {
  if (installed && teardown) return teardown;
  installed = true;

  const iframe = getIframe();
  if (!iframe) {
    installed = false;
    return () => undefined;
  }

  maxDepthPercent = 0;
  postScrollDepth(iframe, readScrollMetrics());

  const handler = () => onScroll(iframe);
  window.addEventListener("scroll", handler, { passive: true, capture: true });
  document.addEventListener("scroll", handler, { passive: true, capture: true });

  teardown = () => {
    window.removeEventListener("scroll", handler, { capture: true });
    document.removeEventListener("scroll", handler, { capture: true });
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    installed = false;
    teardown = null;
  };

  return teardown;
}

/** Reset max depth when parent URL changes (new page visit). */
export function resetHostScrollDepthReporter(getIframe: () => HTMLIFrameElement | null): void {
  maxDepthPercent = 0;
  const iframe = getIframe();
  if (!iframe) return;
  postScrollDepth(iframe, readScrollMetrics());
}

/** Test helper */
export function resetHostScrollDepthStateForTests(): void {
  maxDepthPercent = 0;
  rafId = 0;
  if (teardown) teardown();
  installed = false;
}

export function readHostScrollMetricsForTests(): HostScrollDepthPayload {
  return readScrollMetrics();
}
