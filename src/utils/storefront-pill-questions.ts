export type StorefrontPillQuestion = {
  label: string;
  userMessage: string;
};

/** Parse `data-asa-pill-questions` JSON for btn-assistant-append. Invalid input → undefined (use widget defaults). */
export function parseStorefrontPillQuestions(
  raw: string | null | undefined,
): StorefrontPillQuestion[] | undefined {
  const trimmed = (raw || "").trim();
  if (!trimmed) return undefined;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;

    const result: StorefrontPillQuestion[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        const text = item.trim();
        if (text) result.push({ label: text, userMessage: text });
        continue;
      }
      if (!item || typeof item !== "object") continue;

      const record = item as { label?: unknown; userMessage?: unknown };
      const label = String(record.label ?? "").trim();
      const userMessage = String(record.userMessage ?? "").trim();
      if (label && userMessage) {
        result.push({ label, userMessage });
      }
    }

    return result.length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}
