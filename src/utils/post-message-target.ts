/** Use iframe.src origin so localhost vs 127.0.0.1 mismatches do not break postMessage. */
export function getIframePostMessageTarget(iframe: HTMLIFrameElement): string {
  try {
    return new URL(iframe.src).origin;
  } catch {
    return "*";
  }
}
