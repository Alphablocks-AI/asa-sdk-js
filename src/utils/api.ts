import { API_URL } from "../constants/index.ts";

export async function getEndUser(assistantId: number, endUserId: string, userId: string) {
  try {
    const response = await fetch(
      `${API_URL}/chat/widget/get-user/?assistant_id=${assistantId}&end_user_id=${endUserId}&user_id=${userId}`,
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching end user:", error);
    return null;
  }
}

export async function getAssistantDetails(token: string) {
  try {
    const response = await fetch(
      `${API_URL}/assistant/widget/assistant-details/?token=${token}&origin=sdk`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
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

// 1️⃣ Get current cart
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
