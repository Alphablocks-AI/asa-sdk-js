import { getCart, updateCartAttributes } from "./api.ts";

export const CART_ATTR_KEYS = {
  ASSISTANT_ID: "asa.alphablocks.ai_assistant_id",
  END_USER_ID: "asa.alphablocks.ai_end_user_id",
  SESSION_ID: "asa.alphablocks.ai_session_id",
  OLD_SESSION_ID: "asa.alphablocks.ai_old_session_id",
  LINE_ITEMS: "asa.alphablocks.ai_line_items",
  /** Comma-separated widget ATC provenance, e.g. `cart-carousel-nudge-123,product-card-456`. */
  SOURCE_NOTE: "asa.alphablocks.ai_source_note",
} as const;

export type CartAttributeContext = {
  assistantId: number | null;
  endUserId: string;
  sessionId?: string;
  /** When set, appends variant id(s) to `ai_line_items` (widget ATC only). */
  variantIdsToAppend?: number[];
  /**
   * When set, appends entries to `ai_source_note` (widget ATC only).
   * Shape: `{surface}-{productId}` e.g. `cart-carousel-nudge-123`.
   */
  sourceNotesToAppend?: string[];
};

/** Chat must exist before any ASA cart attribute is written (CRO attribution gate). */
export function resolveEffectiveSessionId(
  ctx: CartAttributeContext,
  existingAttrs: Record<string, string>,
): string {
  return (ctx.sessionId ?? "").trim() || (existingAttrs[CART_ATTR_KEYS.SESSION_ID] ?? "").trim();
}

export function shouldSyncCartAttributes(
  ctx: CartAttributeContext,
  existingAttrs: Record<string, string>,
): boolean {
  if (!ctx.assistantId || !ctx.endUserId) return false;
  return resolveEffectiveSessionId(ctx, existingAttrs).length > 0;
}

export function appendCommaSeparated(existing: string, values: string[]): string {
  if (values.length === 0) return existing;

  const seen = new Set(
    existing
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );

  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) seen.add(trimmed);
  }

  return [...seen].join(", ");
}

export function appendLineItems(existing: string, variantIds: number[]): string {
  return appendCommaSeparated(
    existing,
    variantIds.map((id) => String(id)),
  );
}

/**
 * Merge ASA cart attributes onto existing Shopify cart attributes.
 * When the stored session differs from the current session, appends the previous
 * `ai_session_id` to `ai_old_session_id` (comma-separated, like line items).
 */
export function buildAsaCartAttributes(
  existingAttrs: Record<string, string>,
  ctx: CartAttributeContext,
): Record<string, string> {
  const result: Record<string, string> = { ...existingAttrs };

  if (ctx.assistantId) {
    result[CART_ATTR_KEYS.ASSISTANT_ID] = ctx.assistantId.toString();
  }
  if (ctx.endUserId) {
    result[CART_ATTR_KEYS.END_USER_ID] = ctx.endUserId;
  }

  const nextSessionId = (ctx.sessionId ?? "").trim();
  if (nextSessionId) {
    const storedSessionId = (existingAttrs[CART_ATTR_KEYS.SESSION_ID] ?? "").trim();
    if (storedSessionId && storedSessionId !== nextSessionId) {
      const existingOldSessions = (existingAttrs[CART_ATTR_KEYS.OLD_SESSION_ID] ?? "").trim();
      result[CART_ATTR_KEYS.OLD_SESSION_ID] = appendCommaSeparated(existingOldSessions, [
        storedSessionId,
      ]);
    }
    result[CART_ATTR_KEYS.SESSION_ID] = nextSessionId;
  }

  const variantIds = ctx.variantIdsToAppend ?? [];
  if (variantIds.length > 0) {
    const existingLineItems = result[CART_ATTR_KEYS.LINE_ITEMS] ?? "";
    result[CART_ATTR_KEYS.LINE_ITEMS] = appendLineItems(existingLineItems, variantIds);
  }

  const sourceNotes = (ctx.sourceNotesToAppend ?? [])
    .map((note) => note.trim())
    .filter(Boolean);
  if (sourceNotes.length > 0) {
    const existingSourceNotes = result[CART_ATTR_KEYS.SOURCE_NOTE] ?? "";
    result[CART_ATTR_KEYS.SOURCE_NOTE] = appendCommaSeparated(
      existingSourceNotes,
      sourceNotes,
    );
  }

  return result;
}

function attrsMatchExpected(
  actual: Record<string, string>,
  expected: Record<string, string>,
): boolean {
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) return false;
  }
  return true;
}

const MAX_PERSIST_ATTEMPTS = 3;

/**
 * Persist cart attributes with retries when Shopify does not echo them back.
 */
export async function persistCartAttributes(
  itemCount: number,
  attributes: Record<string, string>,
): Promise<void> {
  const payload = itemCount === 0 ? { note: "init_cart", attributes } : { attributes };

  for (let attempt = 0; attempt < MAX_PERSIST_ATTEMPTS; attempt++) {
    await updateCartAttributes(payload);

    const cart = await getCart();
    const updatedAttrs = (cart.attributes ?? {}) as Record<string, string>;
    if (attrsMatchExpected(updatedAttrs, attributes)) return;
  }

  console.error("persistCartAttributes: attributes did not persist after retries", attributes);
}

/**
 * Readiness budget (~1.8s). Deliberately short: these waits run inside `cartUpdateQueue`,
 * which serializes every widget cart operation (add-to-cart, cart details, search), so a
 * long wait here stalls visible widget actions. Assistant hydration is a single request —
 * if it has not landed within this budget it is not going to help this write.
 */
export const SYNC_READY_MAX_ATTEMPTS = 6;
export const SYNC_READY_RETRY_DELAY_MS = 300;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AttributeReadiness =
  | { status: "ready"; ctx: CartAttributeContext }
  /** This visitor has no chat session anywhere — attribution correctly does not apply. */
  | { status: "no-chat-session" }
  /** A chat session exists but assistantId/endUserId never became available. */
  | { status: "timed-out"; ctx: CartAttributeContext };

/** A chat session exists if the SDK knows one, or the cart already carries one. */
function hasChatSessionEvidence(
  ctx: CartAttributeContext,
  existingAttrs: Record<string, string>,
): boolean {
  return (
    (ctx.sessionId ?? "").trim().length > 0 ||
    (existingAttrs[CART_ATTR_KEYS.SESSION_ID] ?? "").trim().length > 0
  );
}

/**
 * True only when the SDK's OWN live session id is populated — unlike
 * `shouldSyncCartAttributes`, this does not accept the cart's stale `ai_session_id` as a
 * substitute. Used to gate what counts as "ready" during the retry loop below, so a
 * rotated session isn't re-stamped with the cart's old value before the SDK has had a
 * real chance to catch up.
 */
function isLiveSessionReady(ctx: CartAttributeContext): boolean {
  return (
    Boolean(ctx.assistantId) && Boolean(ctx.endUserId) && (ctx.sessionId ?? "").trim().length > 0
  );
}

/**
 * Resolve a context that is actually ready to write.
 *
 * `getCtx` is re-invoked on each retry so this picks up whatever the SDK's live context
 * resolves to, rather than being stuck with the `null`/"" values captured at the moment
 * the write was requested — that silent one-shot bail is what dropped attribution for
 * visitors who chatted before assistant hydration finished.
 *
 * Waiting is gated on a chat session actually existing. A visitor who never chatted is a
 * legitimate no-op, resolved immediately: retrying there would stall the cart queue and
 * log an error on every ordinary storefront add-to-cart.
 *
 * Readiness requires the SDK's *live* `ctx.sessionId`, not just `shouldSyncCartAttributes`
 * (which would also accept the cart's stale `ai_session_id` as "ready"). If that fallback
 * were checked first, a session rotation followed by a storefront add in the same instant
 * would re-stamp the cart with the OLD session on attempt one, before ever giving the live
 * value a chance to arrive — silently defeating the whole point of retrying. The stale
 * fallback is only accepted as a last resort, after the retry budget is exhausted.
 */
export async function resolveReadyAttributeContext(
  getCtx: () => CartAttributeContext,
  existingAttrs: Record<string, string>,
): Promise<AttributeReadiness> {
  let ctx = getCtx();
  if (isLiveSessionReady(ctx)) return { status: "ready", ctx };
  if (!hasChatSessionEvidence(ctx, existingAttrs)) return { status: "no-chat-session" };

  for (let attempt = 0; attempt < SYNC_READY_MAX_ATTEMPTS; attempt++) {
    await sleep(SYNC_READY_RETRY_DELAY_MS);
    ctx = getCtx();
    if (isLiveSessionReady(ctx)) return { status: "ready", ctx };
  }

  // The live session id never arrived within budget — degrade to the cart's existing
  // value now (graceful degradation), rather than never having retried for the live one.
  if (shouldSyncCartAttributes(ctx, existingAttrs)) return { status: "ready", ctx };

  return { status: "timed-out", ctx };
}

/**
 * Deploy note: this SDK's attribution correctness now depends on the widget
 * (`Asa-MonoRepo/apps/widget`) re-asserting the current session via
 * `alphablocks-set-cart-attributes` on every resolved send (see `resolveSession` in
 * `hooks/useSessionId.ts`), and on the lazy `getCtx()` + retry design here to actually
 * wait for that. An SDK build older than this readiness rework paired with a widget
 * build that expects it (or vice versa) leaves the hydration race this file exists to
 * close unfixed. Ship SDK and widget releases that touch cart attribution together.
 */
export async function syncCartAttributes(getCtx: () => CartAttributeContext): Promise<void> {
  try {
    const cart = await getCart();
    const existingAttrs = (cart.attributes ?? {}) as Record<string, string>;

    const readiness = await resolveReadyAttributeContext(getCtx, existingAttrs);
    if (readiness.status === "no-chat-session") return;
    if (readiness.status === "timed-out") {
      console.error(
        "syncCartAttributes: chat session exists but assistantId/endUserId never became ready — cart attributes NOT written",
        readiness.ctx,
      );
      return;
    }

    const { ctx } = readiness;
    const effectiveSessionId = resolveEffectiveSessionId(ctx, existingAttrs);
    const merged = buildAsaCartAttributes(existingAttrs, {
      ...ctx,
      sessionId: effectiveSessionId,
    });
    await persistCartAttributes(cart.item_count ?? 0, merged);
  } catch (err) {
    console.error("syncCartAttributes error:", err);
  }
}
