import { getCart, updateCartAttributes } from "./api.ts";

export const CART_ATTR_KEYS = {
  ASSISTANT_ID: "asa.alphablocks.ai_assistant_id",
  END_USER_ID: "asa.alphablocks.ai_end_user_id",
  SESSION_ID: "asa.alphablocks.ai_session_id",
  OLD_SESSION_ID: "asa.alphablocks.ai_old_session_id",
  NEW_SESSION_ID: "asa.alphablocks.ai_new_session_id",
  LINE_ITEMS: "asa.alphablocks.ai_line_items",
} as const;

export type CartAttributeContext = {
  assistantId: number | null;
  endUserId: string;
  sessionId?: string;
  /** When set, appends variant id(s) to `ai_line_items`. */
  variantIdsToAppend?: number[];
};

export function appendLineItems(existing: string, variantIds: number[]): string {
  if (variantIds.length === 0) return existing;

  const seen = new Set(
    existing
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );

  for (const variantId of variantIds) {
    seen.add(String(variantId));
  }

  return [...seen].join(", ");
}

/**
 * Merge ASA cart attributes onto existing Shopify cart attributes.
 * When the stored session differs from the current session, records
 * `ai_old_session_id` / `ai_new_session_id` and sets `ai_session_id` to the new value.
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
      result[CART_ATTR_KEYS.OLD_SESSION_ID] = storedSessionId;
      result[CART_ATTR_KEYS.NEW_SESSION_ID] = nextSessionId;
    }
    result[CART_ATTR_KEYS.SESSION_ID] = nextSessionId;
  }

  const variantIds = ctx.variantIdsToAppend ?? [];
  if (variantIds.length > 0) {
    const existingLineItems = result[CART_ATTR_KEYS.LINE_ITEMS] ?? "";
    result[CART_ATTR_KEYS.LINE_ITEMS] = appendLineItems(existingLineItems, variantIds);
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

/**
 * Persist cart attributes with one retry when Shopify does not echo them back.
 */
export async function persistCartAttributes(
  itemCount: number,
  attributes: Record<string, string>,
): Promise<void> {
  const payload = itemCount === 0 ? { note: "init_cart", attributes } : { attributes };

  await updateCartAttributes(payload);

  const cart = await getCart();
  const updatedAttrs = (cart.attributes ?? {}) as Record<string, string>;
  if (!attrsMatchExpected(updatedAttrs, attributes)) {
    await updateCartAttributes(payload);
  }
}

export async function syncCartAttributes(ctx: CartAttributeContext): Promise<void> {
  if (!ctx.assistantId || !ctx.endUserId) return;

  try {
    const cart = await getCart();
    const existingAttrs = (cart.attributes ?? {}) as Record<string, string>;
    const merged = buildAsaCartAttributes(existingAttrs, ctx);
    await persistCartAttributes(cart.item_count ?? 0, merged);
  } catch (err) {
    console.error("syncCartAttributes error:", err);
  }
}
