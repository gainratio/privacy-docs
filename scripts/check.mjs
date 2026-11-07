/**
 * Deployment gate for the privacy-core docs site.
 *
 * Adapted from the Avow docs site check. Fails on missing metadata, JSON-LD,
 * broken internal links or anchors, missing sitemap entries, missing assets,
 * executable inline code, external resources, or a weakened CSP.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://privacy.gainratio.com";
const PAGES = [
  { path: "", schema: "SoftwareSourceCode" },
  { path: "docs/", schema: "TechArticle" },
  { path: "examples/", schema: "TechArticle" },
  { path: "security/", schema: "TechArticle" },
];

const issues = [];
const fail = (message) => issues.push(message);
const read = (relative) => readFileSync(join(ROOT, relative), "utf8");
const route = (path) => (path === "" ? "/" : `/${path}`);
const canonicalFor = (path) => `${ORIGIN}${route(path)}`;

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1];
}

function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function textOf(fragment) {
  return decodeEntities(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);
const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);

function checkStructure(html, label) {
  const source = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!doctype[^>]*>/gi, "");
  const stack = [];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(source)) !== null) {
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    const rest = match[3];
    if (closing) {
      if (VOID_ELEMENTS.has(name)) {
        fail(`${label}: closing tag for void element </${name}>`);
        continue;
      }
      const top = stack.pop();
      if (top !== name) {
        fail(`${label}: mismatched </${name}>${top ? `; expected </${top}>` : ""}`);
        if (top) stack.push(top);
      }
      continue;
    }
    if (VOID_ELEMENTS.has(name) || /\/\s*$/.test(rest)) continue;
    stack.push(name);
    if (RAW_TEXT_ELEMENTS.has(name)) {
      const closeRe = new RegExp(`</${name}\\s*>`, "i");
      const remainder = source.slice(tagRe.lastIndex);
      const close = remainder.match(closeRe);
      if (!close) {
        fail(`${label}: unclosed <${name}>`);
        stack.pop();
        break;
      }
      tagRe.lastIndex += close.index + close[0].length;
      stack.pop();
    }
  }
  if (stack.length > 0) fail(`${label}: unclosed tags ${stack.join(", ")}`);
}

function idsIn(html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
}

function localTarget(pathname) {
  if (pathname === "/" || pathname === "") return "index.html";
  const withoutSlash = pathname.replace(/^\/+/, "");
  if (withoutSlash.includes("..")) return null;
  const asFile = join(ROOT, withoutSlash);
  if (existsSync(asFile) && statSync(asFile).isFile()) return withoutSlash;
  const asPage = join(ROOT, withoutSlash, "index.html");
  if (existsSync(asPage) && statSync(asPage).isFile()) return `${withoutSlash}/index.html`;
  return null;
}

function checkLocalHref(href, currentIds, label) {
  if (href.startsWith("mailto:")) return;
  if (href.startsWith("http://") || href.startsWith("https://")) return;
  if (href.startsWith("//")) {
    fail(`${label}: protocol-relative link ${href}`);
    return;
  }
  if (href.startsWith("#")) {
    const id = href.slice(1);
    if (id && !currentIds.has(id)) fail(`${label}: missing anchor #${id}`);
    return;
  }
  if (!href.startsWith("/")) {
    fail(`${label}: relative link ${href} (use a root-relative path)`);
    return;
  }
  const [pathAndQuery, hash = ""] = href.split("#");
  const pathname = pathAndQuery.split("?")[0];
  const target = localTarget(pathname);
  if (!target) {
    fail(`${label}: broken internal link ${href}`);
    return;
  }
  if (hash) {
    const targetHtml = read(target);
    if (!idsIn(targetHtml).has(hash)) {
      fail(`${label}: link ${href} targets missing anchor #${hash}`);
    }
  }
}

const titles = new Map();
const descriptions = new Map();

for (const page of PAGES) {
  const label = route(page.path);
  const file = join(page.path, "index.html");
  if (!existsSync(join(ROOT, file))) {
    fail(`missing page ${file}`);
    continue;
  }
  const html = read(file);
  const expected = canonicalFor(page.path);

  const titleMatches = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
  const title = titleMatches.length === 1 ? textOf(titleMatches[0][1]) : "";
  if (titleMatches.length !== 1) fail(`${label}: expected exactly one <title>`);
  if (title.length < 20 || title.length > 75) fail(`${label}: title length ${title.length}`);
  if (titles.has(title)) fail(`${label}: duplicate title with ${titles.get(title)}`);
  titles.set(title, label);

  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const descriptionTag = metaTags.find((tag) => attr(tag, "name") === "description");
  const description = descriptionTag ? decodeEntities(attr(descriptionTag, "content") ?? "").trim() : "";
  if (!description) fail(`${label}: missing meta description`);
  if (description.length < 50 || description.length > 170) {
    fail(`${label}: description length ${description.length}`);
  }
  if (descriptions.has(description)) {
    fail(`${label}: duplicate description with ${descriptions.get(description)}`);
  }
  descriptions.set(description, label);

  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const canonicalTags = linkTags.filter((tag) => attr(tag, "rel") === "canonical");
  const canonical = canonicalTags.length === 1 ? attr(canonicalTags[0], "href") : "";
  if (canonicalTags.length !== 1) fail(`${label}: expected exactly one canonical link`);
  if (canonical !== expected) fail(`${label}: canonical ${canonical || "(missing)"} (expected ${expected})`);

  const robotsTag = metaTags.find((tag) => attr(tag, "name") === "robots");
  const robots = (attr(robotsTag ?? "", "content") ?? "").replace(/\s+/g, "");
  if (robots !== "index,follow") fail(`${label}: robots meta is ${robots || "(missing)"}`);

  const viewportTag = metaTags.find((tag) => attr(tag, "name") === "viewport");
  const viewport = attr(viewportTag ?? "", "content") ?? "";
  if (!viewport.includes("width=device-width")) fail(`${label}: missing mobile viewport`);

  if (!/<html\b[^>]*\blang="en"/i.test(html)) fail(`${label}: missing html lang="en"`);
  if (!/<meta\b[^>]*charset="utf-8"/i.test(html)) fail(`${label}: missing utf-8 charset`);
  if (!/<meta\b[^>]*name="theme-color"/i.test(html)) fail(`${label}: missing theme-color`);

  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  if (h1s.length !== 1) fail(`${label}: h1 count ${h1s.length}`);
  if (h1s.length === 1 && textOf(h1s[0][1]).length === 0) fail(`${label}: empty h1`);
  const mainCount = [...html.matchAll(/<main\b/gi)].length;
  if (mainCount !== 1) fail(`${label}: main count ${mainCount}`);

  const jsonLdBlocks = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (jsonLdBlocks.length === 0) fail(`${label}: missing JSON-LD`);
  let matchingSchema = false;
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      if (data["@context"] !== "https://schema.org") fail(`${label}: JSON-LD @context is not schema.org`);
      const types = Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]];
      if (types.includes(page.schema)) matchingSchema = true;
      if (typeof data.url === "string" && data.url !== expected) {
        fail(`${label}: JSON-LD url ${data.url} does not match canonical`);
      }
    } catch (error) {
      fail(`${label}: invalid JSON-LD (${error.message})`);
    }
  }
  if (!matchingSchema) fail(`${label}: JSON-LD missing @type ${page.schema}`);

  for (const script of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/type="application\/ld\+json"/i.test(script[0])) {
      fail(`${label}: executable script found (${script[0].slice(0, 70)})`);
    }
  }
  if (/\sstyle\s*=/i.test(html)) fail(`${label}: inline style attribute`);
  if (/<style\b/i.test(html)) fail(`${label}: inline style element`);
  if (/\son[a-z]+\s*=/i.test(html)) fail(`${label}: inline event handler`);
  if (/<(img|iframe|object|embed|video|audio|canvas)\b/i.test(html)) {
    fail(`${label}: embedded media or image element`);
  }
  if (/\ssrc="https?:/i.test(html)) fail(`${label}: remote script or media source`);

  for (const tag of linkTags) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href") ?? "";
    if (["preconnect", "dns-prefetch", "preload", "modulepreload", "prefetch"].includes(rel)) {
      fail(`${label}: disallowed resource hint ${rel}`);
    }
    if (rel === "stylesheet" || rel === "icon") {
      if (!href.startsWith("/")) fail(`${label}: ${rel} is not local (${href})`);
      const target = localTarget(href.split("?")[0]);
      if (!target) fail(`${label}: missing ${rel} asset ${href}`);
    }
  }

  const ogTags = new Map(
    metaTags
      .filter((tag) => (attr(tag, "property") ?? "").startsWith("og:"))
      .map((tag) => [attr(tag, "property"), attr(tag, "content") ?? ""]),
  );
  for (const property of ["og:type", "og:title", "og:description", "og:url"]) {
    if (!ogTags.get(property)) fail(`${label}: missing ${property}`);
  }
  if (ogTags.get("og:url") !== expected) fail(`${label}: og:url is ${ogTags.get("og:url") || "(missing)"}`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) fail(`${label}: duplicate ids ${[...new Set(duplicateIds)].join(", ")}`);

  for (const anchor of html.matchAll(/href="([^"]*)"/g)) {
    checkLocalHref(decodeEntities(anchor[1]), new Set(ids), label);
  }

  for (const required of ["/docs/", "/examples/", "/security/"]) {
    if (!html.includes(`href="${required}"`)) fail(`${label}: missing internal link to ${required}`);
  }

  const sitemap = read("sitemap.xml");
  if (!sitemap.includes(`<loc>${expected}</loc>`)) fail(`${label}: missing from sitemap`);

  checkStructure(html, label);
}

// The 404 is intentionally noindex, without canonical or JSON-LD: it must never
// compete with a real page in an index, and it is not part of the sitemap.
if (!existsSync(join(ROOT, "404.html"))) {
  fail("missing 404.html");
} else {
  const html = read("404.html");
  const title = textOf(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const descriptionTag = metaTags.find((tag) => attr(tag, "name") === "description");
  const description = descriptionTag ? decodeEntities(attr(descriptionTag, "content") ?? "").trim() : "";
  const robots = (attr(metaTags.find((tag) => attr(tag, "name") === "robots") ?? "", "content") ?? "")
    .replace(/\s+/g, "");
  if (title.length < 20 || title.length > 75) fail(`/404.html: title length ${title.length}`);
  if (description.length < 50 || description.length > 170) fail(`/404.html: description length ${description.length}`);
  if (robots !== "noindex,follow") fail(`/404.html: robots meta is ${robots || "(missing)"}`);
  if ([...html.matchAll(/<h1\b/gi)].length !== 1) fail("/404.html: expected exactly one h1");
  if (html.includes('rel="canonical"')) fail("/404.html: 404 must not declare a canonical URL");
  for (const script of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/type="application\/ld\+json"/i.test(script[0])) fail("/404.html: executable script found");
  }
  if (/\sstyle\s*=/i.test(html) || /<style\b/i.test(html)) fail("/404.html: inline style found");
  for (const anchor of html.matchAll(/href="([^"]*)"/g)) {
    checkLocalHref(decodeEntities(anchor[1]), idsIn(html), "/404.html");
  }
  if (!html.includes('href="/docs/"') || !html.includes('href="/examples/"') || !html.includes('href="/security/"')) {
    fail("/404.html: missing recovery links");
  }
  if (read("sitemap.xml").includes("404.html")) fail("sitemap.xml: 404 must not be listed");
  checkStructure(html, "/404.html");
}

const sitemap = read("sitemap.xml");
if (!sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) fail("sitemap.xml: missing XML declaration");
if (!sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
  fail("sitemap.xml: missing urlset namespace");
}
if (!/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap)) fail("sitemap.xml: missing lastmod");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const expectedLocs = PAGES.map((page) => canonicalFor(page.path));
for (const loc of locs) {
  if (!expectedLocs.includes(loc)) fail(`sitemap.xml: unexpected URL ${loc}`);
}
for (const loc of expectedLocs) {
  if (!locs.includes(loc)) fail(`sitemap.xml: missing URL ${loc}`);
}

const robotsTxt = read("robots.txt");
if (!/^User-agent:\s*\*$/m.test(robotsTxt)) fail("robots.txt: missing User-agent: *");
if (!/^Allow:\s*\/$/m.test(robotsTxt)) fail("robots.txt: missing Allow: /");
if (!robotsTxt.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) fail("robots.txt: missing sitemap URL");

const headers = read("_headers");
for (const required of [
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Permissions-Policy:",
  "Cross-Origin-Opener-Policy: same-origin",
  "Cross-Origin-Resource-Policy: same-origin",
  "Strict-Transport-Security: max-age=31536000; includeSubDomains",
  "Content-Security-Policy:",
]) {
  if (!headers.includes(required)) fail(`_headers: missing ${required}`);
}
const csp = headers.match(/Content-Security-Policy:\s*(.+)/i)?.[1] ?? "";
for (const directive of [
  "default-src 'none'",
  "base-uri 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "object-src 'none'",
]) {
  if (!csp.includes(directive)) fail(`_headers: CSP missing ${directive}`);
}
if (/unsafe-inline|unsafe-eval|https?:/i.test(csp)) fail("_headers: CSP is not strict");
if (!headers.includes("/assets/*") || !/Cache-Control:\s*public/.test(headers)) {
  fail("_headers: missing immutable asset cache policy");
}

const css = read("assets/site.css");
if (/@import/i.test(css)) fail("assets/site.css: @import is not allowed");
if (/@font-face/i.test(css)) fail("assets/site.css: @font-face is not allowed");
if (/url\(\s*['"]?(https?:|\/\/)/i.test(css)) fail("assets/site.css: remote url() is not allowed");
if (!/@media\s*\(max-width:/.test(css)) fail("assets/site.css: missing responsive breakpoints");
if (!/overflow-x:\s*auto/.test(css)) fail("assets/site.css: code or tables are not scrollable");

for (const asset of [
  "assets/site.css",
  "favicon.svg",
  "robots.txt",
  "sitemap.xml",
  "_headers",
  "scripts/check.mjs",
]) {
  if (!existsSync(join(ROOT, asset))) fail(`missing ${asset}`);
}

const distDir = join(ROOT, "dist");
if (existsSync(distDir)) {
  for (const forbidden of ["package.json", "README.md", "SECURITY.md", "LICENSE", "scripts"]) {
    if (readdirSync(distDir).includes(forbidden)) fail(`dist/: leaked non-public file ${forbidden}`);
  }
}

if (issues.length > 0) {
  console.error(`privacy-core site contract failed (${issues.length}):`);
  for (const problem of issues) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(
  `privacy-core site contract passed: ${PAGES.length} pages, metadata, JSON-LD, HTML structure, anchors, sitemap, links, assets, strict CSP.`,
);
