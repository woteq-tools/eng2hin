# English → Hindi Translator (Woteq Tools)

Free, open-source English → Hindi translator that runs entirely in the browser.

Type English — or type Hindi in Roman script like `aap kaise ho` — and get back
proper **Devanagari**.

🔗 **Live:** <https://woteq-tools.github.io/eng2hin/>

---

## How it works

The tool combines **two engines**:

| Engine | Used for | Needs network? | Speed |
| --- | --- | --- | --- |
| **Offline transliterator** (`assets/js/translit.js`) | Hinglish → Devanagari | No | Instant |
| **Public translation endpoints** (Google / MyMemory) | Full English sentences | Yes | ~200 ms |

### Offline transliterator

A hand-written Roman → Devanagari engine that runs on your device:

* **Syllable-aware rules** — consonants are grouped into valid Hindi clusters
  (`ky`, `st`, `shr`…) and only split where Hindi would actually split them, so
  `kya` → `क्या` and `pyar` → `प्यर` come out right.
* **Schwa handling** — the implicit `a` of a Devanagari consonant is dropped
  only where Hindi drops it, so `man` → `मन` but `apna` → `अपना`.
* **A dictionary of ~600 common Hinglish words** and ~200 Indian names for the
  cases where spelling rules cannot tell right from wrong (`kaise`, `nahi`,
  `dhanyavaad`, `Rahul` → `राहुल`).
* **Multi-word phrases** (`thank you`, `good morning`, `how are you`).

It also converts **Devanagari → Roman**, which the UI shows as a pronunciation
guide under the translation.

### Online translation

Full English sentences need a real translation, not letter swapping. The app
posts them to a public, key-free endpoint with CORS enabled:

1. `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex`
2. `https://api.mymemory.translated.net/get` (fallback)

If both fail, the app falls back to the offline engine and offers a **Retry**
button. Nothing is sent anywhere else — there is no backend, no API key and no
analytics on this site.

## Modes

| Mode | Example | Result |
| --- | --- | --- |
| **Auto** | `aap kaise ho` | आप कैसे हो |
| **Auto** | `How are you?` | आप कैसे हैं? |
| **Auto** | `मेरा नाम राहुल है` | My name is Rahul |
| **Hinglish → देवनागरी** | `dhanyavaad` | धन्यवाद |
| **English → हिन्दी** | `I need water` | मुझे पानी चाहिए |
| **हिन्दी → English** | `आज मौसम अच्छा है` | The weather is nice today |

## Features

* Instant translation as you type (debounced), plus `Ctrl`/`Cmd` + `Enter`
* Copy button and Hindi text-to-speech (`hi-IN` voice)
* Romanised pronunciation line for Devanagari output
* Swaps input and output with one click
* Works offline once the page is loaded
* Light & dark theme, responsive, keyboard accessible
* No cookies, no tracking, no sign-up

## Local development

The tool is a static page — no build step, no dependencies.

```bash
git clone https://github.com/woteq-tools/eng2hin.git
cd eng2hin
python3 -m http.server 8000
# open http://localhost:8000
```

Run the transliterator tests with Node:

```bash
node test/translit.test.js
```

## Project layout

```
index.html               the page
assets/css/style.css     styles (light/dark via prefers-color-scheme)
assets/js/translit.js    offline Roman <-> Devanagari engine + dictionaries
assets/js/app.js         UI, engines, API calls
assets/favicon.svg       icon
test/translit.test.js    transliteration test suite
```

## License

MIT
