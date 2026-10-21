# asa-sdk-js

Asa SDK for JS

## Local host page (nudges / embed)

1. Widget: `apps/widget` → `npm run dev` (port `3002`)
2. SDK: `npm run build:local`
3. Host page — pick one:

| Host | Command / action | Live reload |
|------|------------------|-------------|
| Recommended | `npm run serve:local` → open `http://localhost:5500` | Off (stable with widget HMR) |
| VS Code Live Server | Go Live on `index.html` | On — must ignore `.next` / `node_modules` (see `.vscode/settings.json` and `Asa-Bundle.code-workspace`) |

**Why Chrome reloads every ~1–2s but Cursor’s IDE browser does not:** Live Server injects a WebSocket reload client. In the multi-root `Asa-Bundle` workspace, Next’s `.next` (and similar) churn while `npm run dev` runs, so Chrome keeps hard-reloading the host. Cursor’s Simple Browser often never attaches that client, so it looks fine.

After changing Live Server ignore settings: **stop and restart** Live Server (status-bar port toggle).
