/**
 * Serializes Shopify cart attribute read/merge/persist across widget postMessage
 * handlers and the storefront fetch bridge. Without this, concurrent get→merge→write
 * races drop `ai_line_items` / `ai_source_note` / session attrs.
 */
let cartWriteQueue: Promise<void> = Promise.resolve();

/**
 * Enqueue a cart write. Always continues the chain after failures so one bad
 * op cannot permanently stall later attribution.
 */
export function enqueueCartWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = cartWriteQueue.then(task, task);
  cartWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
