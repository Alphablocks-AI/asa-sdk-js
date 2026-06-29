import { CART_AJAX_EVENT, type CartAjaxEventName } from "./cart-ajax-constants.ts";
import { handleStorefrontCartLineAdded } from "./event-handler.ts";

export type CartAttributeBridgeContext = {
  assistantId: number | null;
  endUserId: string;
  sessionId: string;
};

const ASA_CART_LINE_SOURCE = "asa.alphablocks.ai";

/** Avoid `RequestInfo` / `RequestInit` in annotations — ESLint `no-undef` does not treat DOM lib types as defined. */
type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

/** postMessage type → widget (`useWidgetNudges`). Kept in sync with Asa-MonoRepo `WIDGET_CONSTANTS.PARENT_IFRAME`. */
export const ALPHABLOCKS_SHOPIFY_CART_LINE_MESSAGE = "alphablocks-shopify-cart-line-event";

type UnknownRecord = Record<string, unknown>;

let patched = false;
let innerFetch: typeof fetch;

let resolveIframe: () => HTMLIFrameElement | null = () => null;
let resolveCartAttributeContext: () => CartAttributeBridgeContext | null = () => null;

/** Update whenever `AlphaBlocks` assigns `this.iframe` (latest embed wins if multiple). */
export function registerCartBridgeIframe(getIframe: () => HTMLIFrameElement | null): void {
  resolveIframe = getIframe;
}

/** Supplies assistant/end-user/session for storefront cart attribute sync. */
export function registerCartAttributeContext(
  getContext: () => CartAttributeBridgeContext | null,
): void {
  resolveCartAttributeContext = getContext;
}

function isSdkOriginatedLine(line: UnknownRecord): boolean {
  const props = line.properties;
  if (!isRecord(props)) return false;
  return props.source === ASA_CART_LINE_SOURCE;
}

async function syncStorefrontCartAttributesForAddedLines(lines: UnknownRecord[]): Promise<void> {
  const storefrontLines = lines.filter((line) => !isSdkOriginatedLine(line));
  if (storefrontLines.length === 0) return;

  const ctx = resolveCartAttributeContext();
  if (!ctx?.assistantId || !ctx.endUserId) return;

  const variantIds = storefrontLines
    .map((line) => {
      const id = line.variant_id;
      const parsed = typeof id === "number" ? id : parseInt(String(id ?? ""), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })
    .filter((id): id is number => id !== null);

  await handleStorefrontCartLineAdded(
    ctx.assistantId,
    ctx.endUserId,
    ctx.sessionId || undefined,
    variantIds.length > 0 ? variantIds : undefined,
  );
}

function addedLinesFromCartDiff(
  cartBeforeAdd: UnknownRecord | null,
  fullCart: UnknownRecord,
): UnknownRecord[] {
  const prevKeys = new Set(
    (cartBeforeAdd?.items as UnknownRecord[] | undefined)?.map(lineKey) ?? [],
  );
  return ((fullCart.items as UnknownRecord[]) ?? []).filter((line) => !prevKeys.has(lineKey(line)));
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

/** Shopify GET /cart.js (and change/update) body shape — boolean only for safe narrowing elsewhere. */
function isFullCartJson(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return Array.isArray(v.items) && typeof v.item_count === "number";
}

function asFullCart(v: unknown): UnknownRecord | null {
  return isFullCartJson(v) ? (v as UnknownRecord) : null;
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
    product_title: String(
      line.product_title ?? line.title ?? line.untranslated_product_title ?? "",
    ),
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
  const full = asFullCart(parsed);
  if (full) return full;
  try {
    const r = await innerFetch("/cart.js", { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j: unknown = await r.json();
    return asFullCart(j);
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

function isCartAddPathname(pathname: string): boolean {
  return (
    pathname.endsWith("/cart/add.js") ||
    pathname.endsWith("/cart/add.json") ||
    pathname.endsWith("/cart/add")
  );
}

function isCartChangePathname(pathname: string): boolean {
  return (
    pathname.endsWith("/cart/change.js") ||
    pathname.endsWith("/cart/change.json") ||
    pathname.endsWith("/cart/change") ||
    pathname.endsWith("/cart/update.js") ||
    pathname.endsWith("/cart/update.json") ||
    pathname.endsWith("/cart/update")
  );
}

async function fetchFreshCartJson(): Promise<UnknownRecord | null> {
  try {
    const r = await innerFetch("/cart.js", { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j: unknown = await r.json();
    return asFullCart(j);
  } catch {
    return null;
  }
}

/**
 * Section-style `change`/`update` bodies expose `items_removed` / `items_added`.
 * When present, emit line events without relying on snapshot diff.
 */
async function tryNotifyCartChangeFromSectionPayload(parsed: UnknownRecord): Promise<boolean> {
  const added = Array.isArray(parsed.items_added)
    ? (parsed.items_added as unknown[]).filter(isRecord)
    : [];
  const removed = Array.isArray(parsed.items_removed)
    ? (parsed.items_removed as unknown[]).filter(isRecord)
    : [];
  if (added.length === 0 && removed.length === 0) return false;

  let cart = asFullCart(parsed);
  if (!cart) {
    cart = await fetchFreshCartJson();
  }
  if (!cart) return false;

  cartSnapshotCache = cart;

  for (const line of added) {
    postCartLineToWidget({ ...payloadFromLine(line, CART_AJAX_EVENT.PRODUCT_ADDED), cart });
  }
  if (added.length > 0) {
    void syncStorefrontCartAttributesForAddedLines(added).catch(() => {
      /* storefront fetch must not break */
    });
  }

  if (removed.length === 1) {
    postCartLineToWidget({
      ...payloadFromLine(removed[0]!, CART_AJAX_EVENT.PRODUCT_REMOVED),
      cart,
    });
    return true;
  }

  if (removed.length > 1) {
    const linePayloads = removed.map((line) =>
      payloadFromLine(line, CART_AJAX_EVENT.PRODUCT_REMOVED),
    );
    const first = linePayloads[0]!;
    postCartLineToWidget({
      ...first,
      cart,
      cart_line_batch: true,
      removed_line_payloads: linePayloads,
    });
  }

  return true;
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

  if (pathname.endsWith("/cart.js") && method === "GET") {
    const snap = asFullCart(parsed);
    if (snap) {
      cartSnapshotCache = snap;
    }
    return;
  }

  if (isCartAddPathname(pathname)) {
    const before = cartSnapshotCache;
    const fullCart = await resolveFullCartAfterAdd(parsed);
    if (!fullCart) return;
    cartSnapshotCache = fullCart;
    const body = buildAddedEventPayload(parsed, fullCart, before);
    postCartLineToWidget(body);

    const addedLines = addedLinesFromCartDiff(before, fullCart);
    const linesForAttrs =
      addedLines.length > 0
        ? addedLines
        : isRecord(parsed) && parsed.product_id != null && !isFullCartJson(parsed)
          ? [parsed as UnknownRecord]
          : [];
    if (linesForAttrs.length > 0) {
      void syncStorefrontCartAttributesForAddedLines(linesForAttrs).catch(() => {
        /* storefront fetch must not break */
      });
    }
    return;
  }

  if (isCartChangePathname(pathname)) {
    if (isRecord(parsed) && (await tryNotifyCartChangeFromSectionPayload(parsed))) {
      return;
    }
    const newCart = asFullCart(parsed);
    if (!newCart) return;
    const prevItems = (cartSnapshotCache?.items as UnknownRecord[] | undefined) ?? [];
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
  if (typeof window.fetch !== "function") return;
  patched = true;
  innerFetch = window.fetch.bind(window);

  window.fetch = async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    const response = await innerFetch(input, init);
    /** Await so nested `/cart.js` during `/cart/add.js` updates `cartSnapshotCache` before callers continue — otherwise remove diffs see an empty snapshot. */
    await onFetchSettled(input, init, response).catch(() => {
      /* ignore bridge errors — storefront fetch must not break */
    });
    return response;
  };
}
