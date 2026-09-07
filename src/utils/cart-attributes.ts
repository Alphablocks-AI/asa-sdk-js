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

/** Identity fields the host can refresh while we wait for assistant hydration. */
export type CartAttributeIdentity = Pick<
  CartAttributeContext,
  "assistantId" | "endUserId" | "sessionId"
>;

/** Chat must exist before any ASA cart attribute is written (CRO attribution gate). */
export function resolveEffectiveSessionId(
  ctx: CartAttributeIdentity,
  existingAttrs: Record<string, string>,
): string {
  return (ctx.sessionId ?? "").trim() || (existingAttrs[CART_ATTR_KEYS.SESSION_ID] ?? "").trim();
}

export function shouldSyncCartAttributes(
  ctx: CartAttributeIdentity,
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

/** ~1.8s — only used when a chat session exists but assistantId/endUserId are still hydrating. */
const HYDRATE_ATTEMPTS = 6;
const HYDRATE_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * Write ASA cart attributes.
 *
 * - No chat session (SDK or cart) → no-op (ordinary storefront ATC).
 * - Session exists but assistant/endUser still hydrating → brief wait via `refreshIdentity`.
 * - `sessionId` on `identity` should be pinned by the caller for that write.
 *
 * Ship with widget builds that re-assert session via `alphablocks-set-cart-attributes`.
 */
export async function syncCartAttributes(
  identity: CartAttributeIdentity,
  extras: Pick<CartAttributeContext, "variantIdsToAppend" | "sourceNotesToAppend"> = {},
  refreshIdentity?: () => Pick<CartAttributeIdentity, "assistantId" | "endUserId">,
): Promise<void> {
  try {
    const cart = await getCart();
    const existingAttrs = (cart.attributes ?? {}) as Record<string, string>;

    let ctx: CartAttributeContext = { ...identity, ...extras };
    if (!resolveEffectiveSessionId(ctx, existingAttrs)) return;

    if ((!ctx.assistantId || !ctx.endUserId) && refreshIdentity) {
      for (let attempt = 0; attempt < HYDRATE_ATTEMPTS; attempt++) {
        await sleep(HYDRATE_DELAY_MS);
        const next = refreshIdentity();
        ctx = { ...ctx, assistantId: next.assistantId, endUserId: next.endUserId };
        if (ctx.assistantId && ctx.endUserId) break;
      }
    }

    if (!shouldSyncCartAttributes(ctx, existingAttrs)) return;

    const sessionId = resolveEffectiveSessionId(ctx, existingAttrs);
    await persistCartAttributes(
      cart.item_count ?? 0,
      buildAsaCartAttributes(existingAttrs, { ...ctx, sessionId }),
    );
  } catch (err) {
    console.error("syncCartAttributes error:", err);
  }
}
