# privacy.gainratio.com — Documentation for `privacy-core`

Static documentation site for [**`@gainratio/privacy-core`**](https://www.npmjs.com/package/@gainratio/privacy-core) (`gainratio/privacy-core`), the on-device redaction and outgoing-text guard library.

**What problem this solves.** When users paste messages into an AI feature, they routinely include credit card numbers, emails, phone numbers, or government IDs without realizing those details are about to leave their device. `privacy-core` finds those sensitive fields locally, swaps each one for a placeholder label (`[CARD_1]`, `[EMAIL_1]`), shows your app the exact outgoing text for review, and sends nothing until your code explicitly calls `approve()` — then puts the real values back into the AI's reply locally.

**What this repo is.** The plain HTML and CSS documentation site served at [privacy.gainratio.com](https://privacy.gainratio.com/) — zero client-side JavaScript, zero external fonts, and zero trackers.

## Run locally in one command

```sh
npm run gate
```

That builds the clean `dist/` directory and verifies every page's HTML structure, links, anchors, JSON-LD metadata, `llms.txt`, and strict Content-Security-Policy headers.

---

## Under the hood (for developers)

### Site map & architecture

| Path | Purpose |
|---|---|
| `index.html` | Landing page, before/after redaction walkthrough, quickstart, and boundaries |
| `docs/index.html` | Install (`@gainratio/privacy-core` `0.3.2`), 11 entity detectors, `EgressGuard`, `rehydrate()`, limits |
| `examples/index.html` | Copyable redaction + approval + rehydration examples for Node and browsers |
| `security/index.html` | Threat model, free-text residual risk, memory lifecycle, OIDC provenance, private reporting |
| `404.html` | Not-found recovery page (`noindex,follow`, excluded from `sitemap.xml`) |
| `llms.txt` | Structured plain-text index for AI coding assistants and crawlers |
| `_headers` | Strict CSP (`default-src 'none'`), HSTS, COOP/CORP, and immutable `/assets/*` caching |
| `scripts/build.mjs` | Explicit allowlist copier into `dist/` |
| `scripts/check.mjs` | Zero-dependency HTML structure, SEO, link/anchor, and CSP contract gate |
| `scripts/live-probe.mjs` | Secret-free production probe (`https://privacy.gainratio.com`) |

### Deploy

```sh
npm run gate
npx wrangler pages deploy dist --project-name privacy-docs --branch main
```

- **Library source:** [github.com/gainratio/privacy-core](https://github.com/gainratio/privacy-core)
- **Open-source hub:** [open-source.gainratio.com/privacy-core/](https://open-source.gainratio.com/privacy-core/)
- **License:** [MIT](./LICENSE)
