# Storefront CTA buttons (`data-asa-ask-btn`)

Add a button on the store that opens Asa chat and sends a question — no page reload, no URL parameters.

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

## Add a button in the theme

Custom liquid block (product page example):

```liquid
{% liquid
  assign asa_question = 'What are the ingredients of ' | append: product.title | append: '?'
%}

<button
  type="button"
  class="button button--primary"
  data-asa-ask-btn="{{ asa_question | escape }}"
>
  {{ asa_question }}
</button>
```

Use theme button classes (`button button--primary`, etc.) for automatic styling.

## Markup contract

| Attribute | Required | Purpose |
|-----------|----------|---------|
| `data-asa-ask-btn` | Yes | Question text sent to chat |
| `id="asa-ask-btn"` | Optional | For a single CTA; use only `data-asa-ask-btn` if you have multiple buttons |

No `onclick`, no `href`, no `ask_asa` URL.

## How it works

```
[button data-asa-ask-btn="..."]
        ↓ click
[SDK click listener on [data-asa-ask-btn]]
        ↓
openWithQuestion() → postMessage to iframe
        ↓
[Widget] open chat → sendMessage(question)
```

## Local dev

`index.html` has a test button with `id="asa-ask-btn"` and `data-asa-ask-btn`. Run widget on `localhost:3002`, `npm run build:local`, open `index.html`.
