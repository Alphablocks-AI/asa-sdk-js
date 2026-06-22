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

## Markup contract

Every Asa storefront CTA button uses two data attributes:

| Attribute | Required | Purpose |
|-----------|----------|---------|
| `data-asa-action` | Yes | What happens on click (see table below) |
| `data-asa-message` | When `btn-ask` or `btn-assistant-append` | Text sent to chat |

The SDK only handles clicks on elements with `data-asa-action` — other buttons on the page are ignored.

No `id`, no `onclick`, no `href`, no `ask_asa` URL.

---

## Choose an action

| I want to… | `data-asa-action` | `data-asa-message` |
|------------|-------------------|--------------------|
| Open chat only | `btn-open` | omit |
| Open chat and send a user question | `btn-ask` | question text |
| Open chat with assistant message + question pills | `btn-assistant-append` | assistant intro text |

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

**Assistant intro + question pills**

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

On product pages, question pills use scenario-aware copy when nudge context is available; otherwise generic fallbacks are shown.

You can place multiple Asa CTA buttons on the same page — each only needs `data-asa-action` (and `data-asa-message` when required).

---

## How it works

```
[button data-asa-action="…"]
        ↓ click (scoped to [data-asa-action])
[SDK] postMessage alphablocks-storefront-action
        ↓
[Widget] switch (action)
  btn-open                  → resize + show chat
  btn-ask               → show chat + sendMessage(message)
  btn-assistant-append  → show chat + assistant message + question pills
```

## Local dev

`index.html` has test buttons for all three actions. Run widget on `localhost:3002`, `npm run build:local`, open `index.html`.
