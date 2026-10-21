# asa-sdk-js

Asa SDK for JS

## Local host page (nudges / embed)

1. Widget: `apps/widget` → `npm run dev` (port `3002`)
2. SDK: `npm run build:local`
3. Open `index.html` with Live Server
4. View the host page in **Cursor Simple Browser** (Command Palette → “Simple Browser: Show”), not Chrome — Live Server’s reload client thrashes external browsers while the widget’s `.next` folder updates
