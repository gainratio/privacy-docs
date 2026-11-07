# privacy.gainratio.com

Source for the privacy-core documentation site: landing page, docs, examples, and security.

The source of truth for every product claim is the [privacy-core repository](https://github.com/gainratio/privacy-core): README, `package.json`, `SECURITY.md`, and `docs/`. No external fonts, scripts, trackers, or images are used; the only image is the local SVG favicon.

## Check

```sh
node scripts/check.mjs
# or
npm run check
```

The check fails on missing metadata, JSON-LD, HTML structure, broken internal links or anchors, missing sitemap entries, missing assets, executable inline code, external resources, or a weakened CSP. The 404 is intentionally `noindex`, has no canonical or JSON-LD, and is not in the sitemap.

## Deploy

The site is plain static files. Serve the repository root — or upload it to any static host — and apply `_headers` at the edge. The `_headers` file uses Cloudflare Pages syntax. One deployment path, if your Pages project is named `privacy-docs`:

```sh
npx wrangler pages deploy . --project-name privacy-docs --branch main
```

Attach `privacy.gainratio.com` in the host's dashboard, then verify the response headers and the canonical URLs after the deploy. `_headers` is only honored by hosts that support that file format.
