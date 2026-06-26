# Storefront CTA buttons

Add buttons on the store that open Asa chat — no page reload, no URL parameters.

## Prerequisites

1. Asa embed script on the page:

```html
<script
  defer
  src="https://unpkg.com/asa-sdk@latest/embed.js"
  data-token="pk_your_token_here"
></script>
```

2. Embed calls `renderWrapper()` + `showAssistant()` (iframe already mounted).

Use theme button classes (`button button--primary`, etc.) for automatic styling.

---

## Four button variants

| # | I want to… | `data-asa-action` | `data-asa-message` | `data-asa-pill-questions` |
|---|------------|-------------------|--------------------|----------------------------|
| 1 | Open chat only | `btn-open` | omit | omit |
| 2 | Open chat and send a user question | `btn-ask` | question text | omit |
| 3 | Open chat with assistant intro + default interior pills | `btn-assistant-append` | assistant intro text (optional — see fallback) | omit |
| 4 | Open chat with assistant intro + custom interior pills | `btn-assistant-append` | assistant intro text (optional — see fallback) | JSON array (see below) |

The SDK only handles clicks on elements with `data-asa-action` — other buttons on the page are ignored.

No `id`, no `onclick`, no `href`, no `ask_asa` URL.

---

## Markup contract

| Attribute | Required | Purpose |
|-----------|----------|---------|
| `data-asa-action` | Yes | What happens on click (see table above) |
| `data-asa-message` | Required for `btn-ask`; optional for `btn-assistant-append` | User question (`btn-ask`) or assistant intro (`btn-assistant-append`) |
| `data-asa-pill-questions` | Optional, `btn-assistant-append` only | JSON array overriding interior question pills |

**Interior pills** are the question chips shown in the chat footer (same flow as after a product-page nudge tap). They are **not** the floating outside nudge bubble.

When `data-asa-pill-questions` is omitted, invalid, or empty, the widget uses scenario-aware pills from product-page nudge context when available, otherwise generic fallbacks.

When `data-asa-message` is omitted on `btn-assistant-append`, the widget appends this default assistant intro:

> Happy to help you decide. Tap below or ask me anything.

Each pill entry is either a string (label and sent message are the same) or an object:

```json
{ "label": "Short pill text", "userMessage": "Full question sent to chat when tapped" }
```

---

## Examples

**Open chat only**

```html
<button type="button" class="button button--primary" data-asa-action="btn-open">
  Chat with us
</button>
```

**Ask a question**

```liquid
{% liquid
  assign asa_question = 'What are the ingredients of ' | append: product.title | append: '?'
%}

<button
  type="button"
  class="button button--primary"
  data-asa-action="btn-ask"
  data-asa-message="{{ asa_question | escape }}"
>
  {{ asa_question }}
</button>
```

**Assistant intro + default interior pills**

```liquid
{% liquid
  assign asa_intro = 'Happy to help you figure out if ' | append: product.title | append: ' is right for you. Tap below or ask me anything.'
%}

<button
  type="button"
  class="button button--primary"
  data-asa-action="btn-assistant-append"
  data-asa-message="{{ asa_intro | escape }}"
>
  Need help deciding?
</button>
```

**Nudge intro + default interior pills (no custom intro — widget fallback message)**

```html
<button type="button" class="button button--primary" data-asa-action="btn-assistant-append">
  Need help deciding?
</button>
```

**Assistant intro + custom interior pills**

```liquid
{% liquid
  assign asa_intro = 'Happy to help you figure out if ' | append: product.title | append: ' is right for you. Tap below or ask me anything.'
%}

<button
  type="button"
  class="button button--primary"
  data-asa-action="btn-assistant-append"
  data-asa-message="{{ asa_intro | escape }}"
  data-asa-pill-questions='[
    {"label":"Ingredients?","userMessage":"What are the ingredients of {{ product.title | escape }}?"},
    {"label":"Sizing","userMessage":"How does sizing run for {{ product.title | escape }}?"}
  ]'
>
  Need help deciding?
</button>
```

You can place multiple Asa CTA buttons on the same page — each only needs the attributes for its variant.

---

## How it works

```
[button data-asa-action="…"]
        ↓ click (scoped to [data-asa-action])
[SDK] postMessage alphablocks-storefront-action
        ↓
[Widget] switch (action)
  btn-open                  → resize + show chat
  btn-ask                   → show chat + sendMessage(message)
  btn-assistant-append      → show chat + assistant message + interior question pills
                              (pillQuestions override defaults when provided)
```

## Local dev

`index.html` has test buttons for all variants. Run widget on `localhost:3002`, `npm run build:local`, open `index.html`.
