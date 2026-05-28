import { CHATBOT_URL, NUDGE_DEV_ENABLED } from "../constants/index.ts";

const CHIP_CLASS = "local-dev-chip";

// `HTMLElementTagNameMap` is a DOM lib type; ESLint's `no-undef` can false-positive on it in TS.
// Disable just for this file (it’s a DOM-only helper module).
/* eslint-disable no-undef */

const CHIP_STYLE: Partial<CSSStyleDeclaration> = {
  border: "1px solid rgba(255, 255, 255, 0.25)",
  borderRadius: "9999px",
  padding: "6px 12px",
  background: "rgba(23, 23, 23, 0.95)",
  color: "#fafafa",
  fontSize: "11px",
  fontWeight: "600",
  cursor: "pointer",
};

/** Keep ids + labels in sync with `apps/widget/dev/nudges/fixtures.ts` (Asa-MonoRepo). */
const FIXTURE_OPTIONS = [
  { id: "product_first_view", label: "Product viewed — first view (cart empty)" },
  {
    id: "product_first_view_cart_not_empty",
    label: "Product viewed — first view (cart not empty)",
  },
  {
    id: "product_revisited_cart_empty",
    label: "Product viewed — revisited (cart empty)",
  },
  {
    id: "product_revisited_cart_not_empty",
    label: "Product viewed — revisited (cart not empty)",
  },
  { id: "product_compare", label: "Product viewed — compare two products" },
  { id: "search_submitted", label: "Search — results nudge" },
  { id: "cart_added_discount", label: "Cart added — discount progress only" },
  { id: "cart_added_carousel", label: "Cart added — pairing carousel only" },
  {
    id: "cart_added_discount_and_carousel",
    label: "Cart added — discount + carousel (stacked)",
  },
  { id: "cart_added_similar_cta", label: "Cart added — similar CTA (no carousel rows)" },
  { id: "cart_removed_carousel", label: "Cart removed — carousel alternatives" },
  { id: "cart_removed_text", label: "Cart removed — text pill only" },
] as const;

const PANEL_ID = "alphablocks-nudge-dev-panel";
type NudgeDevFixtureId = (typeof FIXTURE_OPTIONS)[number]["id"];

export function isLocalWidgetTarget(): boolean {
  try {
    const host = new URL(CHATBOT_URL).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

function postToWidget(
  iframe: HTMLIFrameElement,
  type: string,
  data: Record<string, unknown>,
): void {
  if (!iframe.contentWindow) return;
  let targetOrigin = "*";
  try {
    targetOrigin = new URL(iframe.src).origin;
  } catch {
    /* keep * for malformed src during load */
  }
  iframe.contentWindow.postMessage({ type, data }, targetOrigin);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Host-page nudge dev panel (outside the widget iframe). Only mounts for local SDK builds.
 */
export function mountNudgeDevPanelIfLocal(getIframe: () => HTMLIFrameElement | null): void {
  if (!NUDGE_DEV_ENABLED || document.getElementById(PANEL_ID)) return;

  let open = false;
  let fixtureId: NudgeDevFixtureId = FIXTURE_OPTIONS[0].id;
  let planTier: "free" | "starter" | "growth" = "growth";

  const chipRow = document.getElementById("alphablocks-local-dev-chip-row");
  const panelsHost = document.getElementById("alphablocks-local-dev-panels");

  const chip = chipRow
    ? el("button", {}, "Nudges Dev Controls")
    : el("button", CHIP_STYLE, "Nudges Dev Controls");
  chip.type = "button";
  if (chipRow) {
    chip.className = CHIP_CLASS;
  }

  const panel = el("div", {
    display: "none",
    flexDirection: "column",
    gap: "8px",
    width: "min(calc(100vw - 24px), 320px)",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    background: "rgba(23, 23, 23, 0.97)",
    color: "#fafafa",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  });
  panel.id = PANEL_ID;

  const header = el("div", {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  });
  header.appendChild(
    el(
      "span",
      {
        fontSize: "11px",
        fontWeight: "700",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#d4d4d4",
      },
      "Nudges Dev Controls",
    ),
  );

  const closeBtn = el(
    "button",
    {
      border: "none",
      background: "transparent",
      color: "#a3a3a3",
      cursor: "pointer",
      fontSize: "14px",
      padding: "2px 6px",
    },
    "✕",
  );
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const labelStyle: Partial<CSSStyleDeclaration> = {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "10px",
    color: "#a3a3a3",
  };

  const fieldStyle: Partial<CSSStyleDeclaration> = {
    borderRadius: "6px",
    border: "1px solid #525252",
    background: "#262626",
    color: "#fafafa",
    padding: "6px 8px",
    fontSize: "11px",
  };

  const scenarioLabel = el("label", labelStyle);
  scenarioLabel.appendChild(el("span", {}, "Scenario"));
  const scenarioSelect = document.createElement("select");
  Object.assign(scenarioSelect.style, fieldStyle);
  for (const opt of FIXTURE_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    scenarioSelect.appendChild(o);
  }
  scenarioLabel.appendChild(scenarioSelect);
  panel.appendChild(scenarioLabel);

  const planLabel = el("label", labelStyle);
  planLabel.appendChild(el("span", {}, "Plan tier (gates)"));
  const planSelect = document.createElement("select");
  Object.assign(planSelect.style, fieldStyle);
  for (const tier of ["free", "starter", "growth"] as const) {
    const o = document.createElement("option");
    o.value = tier;
    o.textContent = tier;
    planSelect.appendChild(o);
  }
  planSelect.value = planTier;
  planLabel.appendChild(planSelect);
  panel.appendChild(planLabel);

  const actions = el("div", { display: "flex", gap: "8px", paddingTop: "4px" });
  const applyBtn = el(
    "button",
    {
      flex: "1",
      border: "none",
      borderRadius: "6px",
      padding: "8px",
      background: "#fafafa",
      color: "#171717",
      fontSize: "11px",
      fontWeight: "600",
      cursor: "pointer",
    },
    "Apply",
  );
  const dismissBtn = el(
    "button",
    {
      flex: "1",
      border: "1px solid #525252",
      borderRadius: "6px",
      padding: "8px",
      background: "transparent",
      color: "#e5e5e5",
      fontSize: "11px",
      fontWeight: "600",
      cursor: "pointer",
    },
    "Dismiss",
  );
  actions.appendChild(applyBtn);
  actions.appendChild(dismissBtn);
  panel.appendChild(actions);

  const hint = el(
    "p",
    {
      margin: "0",
      fontSize: "10px",
      color: "#737373",
      lineHeight: "1.4",
    },
    "Controls the widget iframe. Resize to ≤500px width for mobile, then Apply.",
  );
  panel.appendChild(hint);

  const setOpen = (next: boolean) => {
    open = next;
    chip.style.display = open ? "none" : "inline-flex";
    panel.style.display = open ? "flex" : "none";
  };

  chip.addEventListener("click", () => setOpen(true));
  closeBtn.addEventListener("click", () => setOpen(false));

  scenarioSelect.addEventListener("change", () => {
    fixtureId = scenarioSelect.value as NudgeDevFixtureId;
  });
  planSelect.addEventListener("change", () => {
    planTier = planSelect.value as typeof planTier;
  });

  applyBtn.addEventListener("click", () => {
    const iframe = getIframe();
    if (!iframe) {
      window.alert("Widget iframe not ready — open the assistant first.");
      return;
    }
    postToWidget(iframe, "alphablocks-nudge-dev-apply", {
      fixtureId,
      planTier,
    });
  });

  dismissBtn.addEventListener("click", () => {
    const iframe = getIframe();
    if (!iframe) return;
    postToWidget(iframe, "alphablocks-nudge-dev-dismiss", {});
  });

  if (chipRow && panelsHost) {
    chipRow.prepend(chip);
    panelsHost.prepend(panel);
    return;
  }

  const root = el("div", {
    position: "fixed",
    top: "12px",
    left: "12px",
    zIndex: "2147483646",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontSize: "12px",
    lineHeight: "1.35",
    pointerEvents: "auto",
  });
  root.appendChild(chip);
  root.appendChild(panel);
  document.body.appendChild(root);
}
