import { API_URL } from "../constants/index.ts";

export async function getEndUser(assistantId: number, endUserId: string) {
  try {
    const response = await fetch(
      `${API_URL}/chat/widget/get-user/?assistant_id=${assistantId}&end_user_id=${endUserId}`,
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching end user:", error);
    return null;
  }
}

export async function getSessionDetails(assistantId: number, token: string, sessionId: string) {
  try {
    const response = await fetch(
      `${API_URL}/chat/widget/session-details/?assistant_id=${assistantId}&session_id=${sessionId}`,
      {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistant_id: assistantId,
          session_id: sessionId,
        }),
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching session details:", error);
    return null;
  }
}

export async function getAssistantDetails(token: string) {
  const normalizedToken = token?.trim();
  if (!normalizedToken || normalizedToken === "undefined" || normalizedToken === "null") {
    return null;
  }

  try {
    const response = await fetch(
      `${API_URL}/assistant/widget/assistant-details/?token=${encodeURIComponent(normalizedToken)}&origin=sdk`,
      {
        headers: {
          Authorization: `Bearer ${normalizedToken}`,
          "Content-Type": "*",
        },
      },
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching assistant details:", error);
    return null;
  }
}

// 1️⃣ Get current cart (Shopify Cart Ajax)
export async function getCart() {
  const res = await fetch("/cart.js", { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`getCart failed: ${res.status}`);
  return res.json();
}

// 2️⃣ Update cart attributes
export async function updateCartAttributes(payload: {
  attributes: Record<string, string>;
  note?: string;
}) {
  const res = await fetch("/cart/update.js", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`updateCartAttributes failed: ${res.status}`);
  }

  return res.json();
}

// 3️⃣ Add product to cart
export async function addToCart(
  variantId: number,
  quantity: number = 1,
  properties: Record<string, string> = { source: "asa.alphablocks.ai" },
) {
  const res = await fetch("/cart/add.js", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ items: [{ id: variantId, quantity, properties }] }),
  });
  if (!res.ok) throw new Error(`addToCart failed: ${res.status}`);
  return res.json();
}

export async function getSearchProductsCount(query: string): Promise<{
  hasProducts: boolean;
  productCount: number;
}> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { hasProducts: false, productCount: 0 };
  }

  const params = new URLSearchParams({
    q: normalizedQuery,
    "resources[type]": "product",
    "resources[limit]": "1",
  });

  const res = await fetch(`/search/suggest.json?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`getSearchProductsCount failed: ${res.status}`);
  }

  const data = await res.json();
  const products = data?.resources?.results?.products;
  const productCount = Array.isArray(products) ? products.length : 0;
  return { hasProducts: productCount > 0, productCount };
}

export async function getProductByHandle(handle: string): Promise<{
  id?: number;
  title?: string;
  handle?: string;
  price?: number;
} | null> {
  const normalized = handle.trim();
  if (!normalized) return null;

  const res = await fetch(`/products/${encodeURIComponent(normalized)}.js`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

export type StorefrontRecommendationPreview = {
  id: string;
  title: string;
  imageUrl?: string | null;
  onlineStoreUrl?: string | null;
  priceDisplay?: string | null;
  variantId?: string | null;
};

function numericProductId(productId: string): string | null {
  const raw = productId.trim();
  if (!raw) return null;
  const fromGid = raw.match(/\/Product\/(\d+)/i);
  if (fromGid?.[1]) return fromGid[1];
  if (/^\d+$/.test(raw)) return raw;
  return null;
}

/** Shopify Ajax Product Recommendations — same source BE uses first. */
export async function getProductRecommendations(params: {
  productId: string;
  intent: "related" | "complementary";
  limit?: number;
}): Promise<StorefrontRecommendationPreview[]> {
  const productId = numericProductId(params.productId);
  if (!productId) return [];

  const root = (
    (window as Window & { Shopify?: { routes?: { root?: string } } }).Shopify?.routes?.root || "/"
  ).replace(/\/?$/, "/");

  const qs = new URLSearchParams({
    product_id: productId,
    intent: params.intent,
    limit: String(Math.min(Math.max(params.limit ?? 4, 1), 10)),
  });

  const res = await fetch(`${root}recommendations/products.json?${qs}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const products = Array.isArray(data?.products) ? data.products : [];

  return products
    .map((p: Record<string, unknown>): StorefrontRecommendationPreview | null => {
      const title = typeof p.title === "string" ? p.title.trim() : "";
      if (!title) return null;
      const id = p.id != null ? String(p.id) : "";
      if (!id) return null;

      const featured = p.featured_image;
      let imageUrl: string | null = null;
      if (typeof featured === "string") imageUrl = featured;
      else if (featured && typeof featured === "object") {
        const img = featured as { url?: string; src?: string };
        imageUrl = img.url || img.src || null;
      }

      const variants = Array.isArray(p.variants) ? p.variants : [];
      const firstVariant = variants[0] as { id?: number | string } | undefined;
      const variantId = firstVariant?.id != null ? String(firstVariant.id) : null;

      const priceRaw = p.price;
      let priceDisplay: string | null = null;
      if (typeof priceRaw === "number") {
        priceDisplay = `$${(priceRaw / 100).toFixed(2)}`;
      } else if (typeof priceRaw === "string" && priceRaw.trim()) {
        const n = Number(priceRaw);
        priceDisplay = Number.isFinite(n) ? `$${(n / 100).toFixed(2)}` : priceRaw;
      }

      const url =
        typeof p.url === "string"
          ? p.url
          : typeof p.handle === "string"
            ? `/products/${p.handle}`
            : null;

      return {
        id,
        title,
        imageUrl,
        onlineStoreUrl: url,
        priceDisplay,
        variantId,
      };
    })
    .filter(
      (row: StorefrontRecommendationPreview | null): row is StorefrontRecommendationPreview =>
        row != null,
    );
}
