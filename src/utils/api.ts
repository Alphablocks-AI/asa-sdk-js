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
