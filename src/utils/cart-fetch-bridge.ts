import { CART_AJAX_EVENT, type CartAjaxEventName } from "./cart-ajax-constants.ts";

/** Avoid `RequestInfo` / `RequestInit` in annotations — ESLint `no-undef` does not treat DOM lib types as defined. */
type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

/** postMessage type → widget (`useWidgetNudges`). Kept in sync with Asa-MonoRepo `WIDGET_CONSTANTS.PARENT_IFRAME`. */
export const ALPHABLOCKS_SHOPIFY_CART_LINE_MESSAGE = "alphablocks-shopify-cart-line-event";

type UnknownRecord = Record<string, unknown>;

let patched = false;
let innerFetch: typeof fetch;

let resolveIframe: () => HTMLIFrameElement | null = () => null;

/** Update whenever `AlphaBlocks` assigns `this.iframe` (latest embed wins if multiple). */
export function registerCartBridgeIframe(getIframe: () => HTMLIFrameElement | null): void {
  resolveIframe = getIframe;
}

function getChatbotTargetOrigin(iframe: HTMLIFrameElement): string {
  try {
    return new URL(iframe.src).origin;
  } catch {
    return "*";
  }
}

/** Cart-line events while the widget iframe is not mounted yet (or not loaded) — replay when ready. */
const PENDING_CART_LINE_MAX = 25;
let pendingCartLineMessages: UnknownRecord[] = [];

function postCartLineToWidgetInternal(iframe: HTMLIFrameElement, payload: UnknownRecord): void {
  iframe.contentWindow!.postMessage(
    { type: ALPHABLOCKS_SHOPIFY_CART_LINE_MESSAGE, data: payload },
    getChatbotTargetOrigin(iframe),
  );
}

/**
 * Deliver any cart-line payloads that were queued before `iframe.contentWindow` existed.
 * Call when assigning the iframe and on its `load` (widget may not listen until after load).
 */
export function flushPendingCartLineMessagesToWidget(): void {
  const iframe = resolveIframe();
  if (!iframe?.contentWindow || pendingCartLineMessages.length === 0) return;
  const batch = pendingCartLineMessages;
  pendingCartLineMessages = [];
  for (const payload of batch) {
    postCartLineToWidgetInternal(iframe, payload);
  }
}

const cartBridgeLoadIframes = new WeakSet<HTMLIFrameElement>();

/**
 * Register load + delayed flush so messages are not lost if they fire before the widget bundle attaches `message`.
 * Listener remains attached for later `src` changes.
 */
export function onCartBridgeIframeMounted(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return;
  flushPendingCartLineMessagesToWidget();
  if (cartBridgeLoadIframes.has(iframe)) return;
  cartBridgeLoadIframes.add(iframe);
  iframe.addEventListener("load", () => {
    flushPendingCartLineMessagesToWidget();
    window.setTimeout(() => flushPendingCartLineMessagesToWidget(), 60);
  });
}

function postCartLineToWidget(payload: UnknownRecord): void {
  const iframe = resolveIframe();
  if (!iframe?.contentWindow) {
    if (pendingCartLineMessages.length >= PENDING_CART_LINE_MAX) {
      pendingCartLineMessages.shift();
    }
    pendingCartLineMessages.push(payload);
    return;
  }
  postCartLineToWidgetInternal(iframe, payload);
}

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Shopify GET /cart.js (and change/update) shape. */
function isFullCartJson(v: unknown): v is UnknownRecord {
  if (!isRecord(v)) return false;
  return Array.isArray(v.items) && typeof v.item_count === "number";
}

function lineKey(line: UnknownRecord): string {
  if (typeof line.key === "string" && line.key.length > 0) return line.key;
  const v = line.variant_id;
  const p = line.product_id;
  return `${v ?? ""}:${p ?? ""}`;
}

function handleFromProductUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  try {
    const baseUrl =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://shop.example";
    const u = new URL(url, baseUrl);
    const m = u.pathname.match(/\/products\/([^/?]+)/);
    return m?.[1];
  } catch {
    return undefined;
  }
}

function payloadFromLine(line: UnknownRecord, eventName: CartAjaxEventName): UnknownRecord {
  const productId = line.product_id;
  return {
    event_name: eventName,
    product_id: productId !== undefined && productId !== null ? String(productId) : "",
    product_title: String(line.product_title ?? line.title ?? ""),
    product_url_handle:
      line.handle !== undefined && line.handle !== null
        ? String(line.handle)
        : handleFromProductUrl(String(line.url ?? "")),
    quantity: typeof line.quantity === "number" ? line.quantity : Number(line.quantity ?? 1),
    variant_title: line.variant_title != null ? String(line.variant_title) : null,
  };
}

function findRemovedLines(
  prevItems: UnknownRecord[] | undefined,
  nextItems: UnknownRecord[] | undefined,
): UnknownRecord[] {
  const nextKeys = new Set((nextItems ?? []).map(lineKey));
  return (prevItems ?? []).filter((line) => !nextKeys.has(lineKey(line)));
}

/**
 * Lines still present after `/cart/change.js` or `/cart/update.js` but with a lower quantity
 * (same line key). Fully removed lines are excluded — use `findRemovedLines` for those.
 */
function findQuantityDecrementedLines(
  prevItems: UnknownRecord[] | undefined,
  nextItems: UnknownRecord[] | undefined,
): UnknownRecord[] {
  const prev = prevItems ?? [];
  const next = nextItems ?? [];
  const nextByKey = new Map<string, UnknownRecord>();
  for (const line of next) {
    nextByKey.set(lineKey(line), line);
  }

  const out: UnknownRecord[] = [];
  for (const prevLine of prev) {
    const key = lineKey(prevLine);
    const nextLine = nextByKey.get(key);
    if (!nextLine) continue;

    const prevQty =
      typeof prevLine.quantity === "number" ? prevLine.quantity : Number(prevLine.quantity ?? 0);
    const nextQty =
      typeof nextLine.quantity === "number" ? nextLine.quantity : Number(nextLine.quantity ?? 0);

    if (nextQty < prevQty) {
      out.push(prevLine);
    }
  }
  return out;
}

/**
 * After /cart/add.js the body may be a single line item, `{ items: [...] }`, or a full cart.
 * Returns a full /cart.js-shaped object when possible.
 */
async function resolveFullCartAfterAdd(parsed: unknown): Promise<UnknownRecord | null> {
  if (isFullCartJson(parsed)) {
    return parsed;
  }
  try {
    const r = await innerFetch("/cart.js", { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j: unknown = await r.json();
    return isFullCartJson(j) ? j : null;
  } catch {
    return null;
  }
}

function buildAddedEventPayload(
  addResponse: unknown,
  fullCart: UnknownRecord,
  cartBeforeAdd: UnknownRecord | null,
): UnknownRecord {
  const prevKeys = new Set(
    (cartBeforeAdd?.items as UnknownRecord[] | undefined)?.map(lineKey) ?? [],
  );

  if (isRecord(addResponse) && addResponse.product_id != null && !isFullCartJson(addResponse)) {
    return {
      ...payloadFromLine(addResponse as UnknownRecord, CART_AJAX_EVENT.PRODUCT_ADDED),
      cart: fullCart,
    };
  }

  const items = (fullCart.items as UnknownRecord[]) ?? [];
  for (const line of items) {
    if (!prevKeys.has(lineKey(line))) {
      return { ...payloadFromLine(line, CART_AJAX_EVENT.PRODUCT_ADDED), cart: fullCart };
    }
  }

  const last = items[items.length - 1];
  if (last) {
    return { ...payloadFromLine(last, CART_AJAX_EVENT.PRODUCT_ADDED), cart: fullCart };
  }

  return {
    event_name: CART_AJAX_EVENT.PRODUCT_ADDED,
    product_id: "",
    product_title: "",
    cart: fullCart,
  };
}

function pathnameFromFetchInput(input: FetchInput): string {
  if (typeof input === "string") {
    try {
      return new URL(input, window.location.href).pathname;
    } catch {
      return "";
    }
  }
  if (input instanceof URL) return input.pathname;
  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      return new URL(input.url, window.location.href).pathname;
    } catch {
      return "";
    }
  }
  return "";
}

function methodFromInit(input: FetchInput, init?: FetchInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

let cartSnapshotCache: UnknownRecord | null = null;

async function onFetchSettled(
  input: FetchInput,
  init: FetchInit | undefined,
  response: Response,
): Promise<void> {
  if (!response.ok) return;
  const ct = response.headers.get("content-type") ?? "";
  if (!ct.includes("json") && !ct.includes("javascript")) return;

  let parsed: unknown;
  try {
    parsed = await response.clone().json();
  } catch {
    return;
  }

  const pathname = pathnameFromFetchInput(input);
  const method = methodFromInit(input, init);

  if (pathname.endsWith("/cart.js") && method === "GET" && isFullCartJson(parsed)) {
    cartSnapshotCache = parsed;
    return;
  }

  if (pathname.endsWith("/cart/add.js")) {
    const before = cartSnapshotCache;
    const fullCart = await resolveFullCartAfterAdd(parsed);
    if (!fullCart) return;
    cartSnapshotCache = fullCart;
    const body = buildAddedEventPayload(parsed, fullCart, before);
    postCartLineToWidget(body);
    return;
  }

  if (pathname.endsWith("/cart/change.js") || pathname.endsWith("/cart/update.js")) {
    if (!isFullCartJson(parsed)) return;
    const prevItems = (cartSnapshotCache?.items as UnknownRecord[] | undefined) ?? [];
    const newCart = parsed;
    const nextItems = (newCart.items as UnknownRecord[]) ?? [];
    const removed = findRemovedLines(prevItems, nextItems);
    const decremented = findQuantityDecrementedLines(prevItems, nextItems);
    cartSnapshotCache = newCart;

    const linesToNotify = [...removed, ...decremented];
    if (linesToNotify.length === 0) return;

    const linePayloads = linesToNotify.map((line) =>
      payloadFromLine(line, CART_AJAX_EVENT.PRODUCT_REMOVED),
    );
    if (linePayloads.length === 1) {
      postCartLineToWidget({ ...linePayloads[0]!, cart: newCart });
      return;
    }
    const first = linePayloads[0]!;
    postCartLineToWidget({
      ...first,
      cart: newCart,
      cart_line_batch: true,
      removed_line_payloads: linePayloads,
    });
  }
}

/**
 * Patches `window.fetch` once. Observes Shopify Cart AJAX routes and posts
 * `ALPHABLOCKS_SHOPIFY_CART_LINE_MESSAGE` to the widget iframe. Does not alter response bodies
 * or reject requests.
 */
export function installShopifyCartFetchBridge(): void {
  if (typeof window === "undefined" || patched) return;
  patched = true;
  innerFetch = window.fetch.bind(window);

  window.fetch = async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    const response = await innerFetch(input, init);
    void onFetchSettled(input, init, response).catch(() => {
      /* ignore bridge errors — storefront fetch must not break */
    });
    return response;
  };
}
