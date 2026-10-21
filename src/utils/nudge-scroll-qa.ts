type ScrollQaAssistant = {
  syncParentUrlToWidget(): void;
};

const SCROLL_QA_PATH_KEY = "alphablocks-scroll-qa-path";
const SCROLL_QA_MAIN_ID = "alphablocks-scroll-qa-main";
const SCROLL_QA_METER_ID = "alphablocks-scroll-qa-meter";

/** PDP handles used in widget fixtures / local QA. */
export const SCROLL_QA_PDP_PATHS = [
  "/products/mint-mouthwash",
  "/products/hydrating-cream-cleanser",
] as const;

/** Run from index.html head before the SDK bundle (Live Server PDP stubs). */
export function restoreScrollQaPathFromRedirect(): void {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("scroll-qa-path");
  const stored = sessionStorage.getItem(SCROLL_QA_PATH_KEY);
  const target = fromQuery && fromQuery.charAt(0) === "/" ? fromQuery : stored;
  if (!target || target === "/") return;
  const path = location.pathname || "/";
  if (path !== "/" && path !== "/index.html") return;
  sessionStorage.removeItem(SCROLL_QA_PATH_KEY);
  history.replaceState(null, "", target);
}

export function readHostScrollDepthPercent(): number {
  const scrollRoot = document.scrollingElement ?? document.documentElement;
  const scrollY = Math.max(0, window.scrollY ?? scrollRoot.scrollTop ?? 0);
  const scrollHeight = scrollRoot.scrollHeight;
  const clientHeight = window.innerHeight;
  if (scrollHeight <= clientHeight + 1) return 100;
  const scrollable = Math.max(0, scrollHeight - clientHeight);
  if (scrollable <= 1) return 100;
  return Math.min(100, Math.round((scrollY / scrollable) * 100));
}

function ensureScrollableHostPage(): void {
  if (document.getElementById(SCROLL_QA_MAIN_ID)) return;

  const main = document.createElement("main");
  main.id = SCROLL_QA_MAIN_ID;
  Object.assign(main.style, {
    padding: "5rem 1.5rem 120vh",
    maxWidth: "720px",
    margin: "0 auto",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    color: "#171717",
    lineHeight: "1.5",
  });

  const intro = document.createElement("p");
  intro.style.color = "#525252";
  intro.textContent =
    "Host page for real nudge triggers. Open Nudges Dev Controls → Real triggers for PDP paths. Scroll for the 25% gate on first-view product nudges.";
  main.appendChild(intro);

  for (let i = 1; i <= 5; i++) {
    const block = document.createElement("div");
    Object.assign(block.style, {
      margin: "2rem 0",
      padding: "1.25rem",
      borderRadius: "8px",
      background: "#f5f5f5",
      border: "1px solid #e5e5e5",
    });
    block.textContent =
      i === 3
        ? "Block 3 — past ~25% host scroll on most viewports"
        : `Block ${i} — keep scrolling…`;
    main.appendChild(block);
  }

  document.body.insertBefore(main, document.body.firstChild);
}

function paintScrollMeter(meter: HTMLElement): void {
  const depth = readHostScrollDepthPercent();
  const path = window.location.pathname || "/";
  const gateOk = depth >= 25;
  meter.textContent = `Path: ${path} · Host scroll: ${depth}%${gateOk ? " · scroll gate OK" : " · need ≥25% (first view)"}`;
}

function navigateScrollQaPath(path: string, getAssistant: () => ScrollQaAssistant | null): void {
  if (!path.startsWith("/") || path.includes("..")) return;
  history.pushState(null, "", path);
  const assistant = getAssistant();
  assistant?.syncParentUrlToWidget();
  const meter = document.getElementById(SCROLL_QA_METER_ID);
  if (meter) paintScrollMeter(meter);
}

function appendRealTriggersSection(
  panel: HTMLElement,
  getAssistant: () => ScrollQaAssistant | null,
): void {
  if (document.getElementById("alphablocks-scroll-qa-section")) return;

  const section = document.createElement("div");
  section.id = "alphablocks-scroll-qa-section";
  Object.assign(section.style, {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingTop: "8px",
    marginTop: "8px",
    borderTop: "1px solid #404040",
  });

  const title = document.createElement("span");
  Object.assign(title.style, {
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#d4d4d4",
  });
  title.textContent = "Real triggers (dwell + scroll)";
  section.appendChild(title);

  const meter = document.createElement("p");
  meter.id = SCROLL_QA_METER_ID;
  Object.assign(meter.style, {
    margin: "0",
    fontSize: "10px",
    color: "#a3a3a3",
    lineHeight: "1.4",
    fontFamily: "ui-monospace, Menlo, monospace",
  });
  section.appendChild(meter);

  const note = document.createElement("p");
  Object.assign(note.style, {
    margin: "0",
    fontSize: "10px",
    color: "#737373",
    lineHeight: "1.4",
  });
  note.textContent =
    "Apply above = fixture UI only (skips dwell/scroll). Use paths below to test production gates (12s + 25% scroll on first PDP view).";
  section.appendChild(note);

  const nav = document.createElement("div");
  Object.assign(nav.style, { display: "flex", flexWrap: "wrap", gap: "6px" });

  const addNavBtn = (label: string, path: string) => {
    const btn = document.createElement("button");
    btn.type = "button";
    Object.assign(btn.style, {
      border: "1px solid #525252",
      borderRadius: "6px",
      padding: "4px 8px",
      background: "#262626",
      color: "#e5e5e5",
      fontSize: "10px",
      cursor: "pointer",
    });
    btn.textContent = label;
    btn.addEventListener("click", () => navigateScrollQaPath(path, getAssistant));
    nav.appendChild(btn);
  };

  addNavBtn("Home", "/");
  for (const pdpPath of SCROLL_QA_PDP_PATHS) {
    const handle = pdpPath.split("/").pop() ?? pdpPath;
    addNavBtn(handle, pdpPath);
  }
  section.appendChild(nav);
  panel.appendChild(section);

  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      paintScrollMeter(meter);
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  document.addEventListener("scroll", onScroll, { passive: true, capture: true });
  window.addEventListener("popstate", () => {
    getAssistant()?.syncParentUrlToWidget();
    paintScrollMeter(meter);
  });

  paintScrollMeter(meter);
}

type ScrollQaOptions = {
  getAssistant: () => ScrollQaAssistant | null;
  getNudgeDevPanel: () => HTMLElement | null;
  /** When false, skip injecting the scroll-QA host page (e.g. dashboard embed). */
  enabled?: boolean;
};

let scrollQaInstalled = false;

/**
 * Tall host page + real-trigger controls inside the nudge dev panel (nudge-dev builds only).
 * Skipped unless the host is the SDK local test page (see isLocalNudgeDevHostPage).
 */
export function installNudgeScrollQa(options: ScrollQaOptions): void {
  if (options.enabled === false || scrollQaInstalled) return;
  scrollQaInstalled = true;
  ensureScrollableHostPage();
  const panel = options.getNudgeDevPanel();
  if (panel) appendRealTriggersSection(panel, options.getAssistant);
}
