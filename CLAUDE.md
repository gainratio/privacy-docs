# CLAUDE.md — privacy-docs (`privacy.gainratio.com`)

Canonical agent instructions for the `privacy-core` documentation site (`gainratio/privacy-docs`).

## Status & Portfolio Pointers

- **Live URL:** `https://privacy.gainratio.com/` (Cloudflare Pages project `privacy-docs`)
- **Upstream library repo:** `https://github.com/gainratio/privacy-core` (npm `@gainratio/privacy-core`, current published version `0.3.2`)
- **Portfolio hub:** `https://open-source.gainratio.com/privacy-core/`
- **Portfolio engineering standard §8 (WASM):** Not applicable — pure static HTML/CSS with zero client-side JavaScript or WASM assets.
- **Portfolio engineering standard §3.1–§3.4:** §3.1 enforced via strict `default-src 'none'` CSP and executable-script ban in `scripts/check.mjs`; §3.2–§3.4 N/A.

## Stack & Layout

- **Runtime:** Node 22+ (build and gate scripts only; zero npm dependencies).
- **Pages:** `index.html`, `docs/index.html`, `examples/index.html`, `security/index.html`, `404.html`.
- **Public root artifacts:** `_headers`, `robots.txt`, `sitemap.xml`, `llms.txt`, `favicon.svg`.
- **Scripts:**
  - `scripts/build.mjs` — copies explicit `ROOT_FILES` + `DIRS` allowlist into `dist/`.
  - `scripts/check.mjs` — validates HTML structure, metadata, JSON-LD, anchors, sitemap, `llms.txt`, and strict `_headers` CSP.
  - `scripts/live-probe.mjs` — secret-free production probe (`live-probe.yml`).

## Core Invariants

1. **Zero executable scripts or external resources.** `scripts/check.mjs` rejects any `<script>` tag whose `type` is not `application/ld+json`, any inline style or event handler, any `<img>` / `<iframe>`, and any external URL in CSS/HTML assets.
2. **Product claim parity.** Entity counts (`11`), input limits (`512 KiB`), and npm version (`0.3.2`) must match `gainratio/privacy-core`.
3. **Explicit `dist/` allowlist.** New public root files must be listed in `scripts/build.mjs` `ROOT_FILES`; repo files (`package.json`, `CLAUDE.md`, `README.md`, `scripts/`) must never enter `dist/`.

## Quality Gates (Non-Negotiable)

Run `npm run gate` before every commit:

- **Scar (allowlist drift):** Root files omitted from `scripts/build.mjs` `ROOT_FILES` 404 on Cloudflare Pages; `scripts/check.mjs` verifies `dist/llms.txt` exists and repo files are absent.
- **Scar (CSP relaxation):** Never add `'unsafe-inline'` or external hosts to `_headers`; `scripts/check.mjs` enforces `default-src 'none'` across every route.

## Commands

```sh
npm run build          # build dist/ from explicit allowlist
npm run check          # run full HTML/SEO/link/CSP deployment gate
npm run gate           # build + check
npm run probe:live     # probe live https://privacy.gainratio.com
```
