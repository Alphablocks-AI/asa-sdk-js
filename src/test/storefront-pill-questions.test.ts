import { parseStorefrontPillQuestions } from "../utils/storefront-pill-questions.ts";

describe("parseStorefrontPillQuestions", () => {
  test("returns undefined for empty input", () => {
    expect(parseStorefrontPillQuestions(null)).toBeUndefined();
    expect(parseStorefrontPillQuestions("")).toBeUndefined();
    expect(parseStorefrontPillQuestions("   ")).toBeUndefined();
  });

  test("parses object entries", () => {
    expect(
      parseStorefrontPillQuestions(
        '[{"label":"Ingredients?","userMessage":"What are the ingredients?"}]',
      ),
    ).toEqual([{ label: "Ingredients?", userMessage: "What are the ingredients?" }]);
  });

  test("parses string shorthand entries", () => {
    expect(parseStorefrontPillQuestions('["Sizing help"]')).toEqual([
      { label: "Sizing help", userMessage: "Sizing help" },
    ]);
  });

  test("returns undefined for invalid JSON or empty array", () => {
    expect(parseStorefrontPillQuestions("{not json")).toBeUndefined();
    expect(parseStorefrontPillQuestions("[]")).toBeUndefined();
    expect(parseStorefrontPillQuestions('[{"label":"only label"}]')).toBeUndefined();
  });
});
