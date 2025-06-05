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
