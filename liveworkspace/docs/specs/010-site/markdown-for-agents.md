# Markdown for agents

The public content pages of every site answer a clean Markdown copy of themselves to a request that prefers
Markdown, so an AI agent reading a page pays for its words, not its navigation, scripts and styles. One shared
helper, `@liveworkspace/agent-markdown` (`packages/agent-markdown`), does it for the liveworkspace site, the help
centre (every scope) and every product's marketing site.

## Why

AI crawlers and agents are a real share of the traffic (a day of liveworkspace.app in November 2026: GoogleOther
913 requests, ElevenLabs 436, OAI-SearchBot 387). Cloudflare's own Markdown for Agents needs the Pro plan; this does
the same on the Free plan, from the pages' own build.

## Which pages answer Markdown

The pages each site lists in its sitemap, the public content it wants found:

| Site                                   | Pages                                                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| liveworkspace.app ([site.md](site.md)) | `/`, `/compare`, `/pricing` (where Pro is on), `/privacy`, `/terms`, `/licences`. Not `/community`, `/status` or `/telemetry`: their content is drawn in the browser |
| The help centre, every scope           | every page in the scope's sitemap: the home, each category and each article ([help-centre.md](../017-help/help-centre.md) "Markdown for agents")                     |
| Each product's marketing site          | every page in its sitemap: the home, the FAQ, Build with AI, each feature page, the comparisons, the licences                                                        |

Editors, the Explorer, account and sign-in pages, the APIs and every other app page are unchanged: they never
answer Markdown, and their responses are exactly what they were.

## How it is negotiated

- **Markdown** when the request is a GET or HEAD for a page whose Accept header names `text/markdown` with a q above
  0 and at least the q HTML gets from the header's most specific range for it (`text/html`, else `text/*`, else
  `*/*`). `Accept: text/markdown`, `text/markdown, text/html` and `text/markdown, */*;q=0.8` are Markdown.
- **HTML** for everything else: a browser's Accept (which never names `text/markdown`), `*/*`, no Accept at all,
  `text/html, text/markdown;q=0.5`, `text/markdown;q=0`, and a range whose q is not a q-value (that range is
  ignored). `text/*` and `*/*` never select Markdown.
- Only the first 2,048 characters of the header are read. A header without the word "markdown" is HTML at once,
  with no parsing: the browser's path is one header test.
- A page with no Markdown file (a page outside the list, or a site built without it) answers its HTML, never a 406.

## The answer

- Markdown: `200`, `Content-Type: text/markdown; charset=utf-8`, `Vary: Accept`, and the rest of the file's headers
  (security headers, caching). A revalidation the file answers `304` passes as a `304`.
- HTML, for the same pages: as before, plus `Vary: Accept`.
- So no cache, the browser's or one in between, hands Markdown to a browser or HTML to an agent. Pages are never
  cached at the edge (they are `no-store` through a router, `max-age=0, must-revalidate` on the site), so the two
  forms never meet in Cloudflare's cache either.
- The Markdown file is also at its own address, beside the page: `/index.md` for `/`, `/pricing.md` for `/pricing`,
  and in the help centre `/help/<category>/<article>/index.md`.

## What the Markdown holds

Written at build time, from the page as its source renders it (MDX and article data in the help centre, the pages'
own components on the sites), never by scraping a page at request time. After `next build`, the build reads each
sitemap page's exported HTML and writes the Markdown beside it:

- a front matter block: `title`, `description` and `url` (the page's canonical address), from the page's own head;
- the page's `<main>`, as GitHub-flavoured Markdown: headings, paragraphs, lists, tables, code, quotes, links and
  pictures, with `# <title>` first when the page has no heading of its own;
- without what only a browser needs: scripts, styles, inline SVG, buttons, forms, navigation, dialogs, anything
  hidden or `aria-hidden`, pictures inlined as `data:` addresses, and any element marked `data-agent-skip` (page
  chrome inside `<main>`: breadcrumbs, a table of contents, feedback controls).

A page whose content is Suspense-streamed in the export has the streamed content put back in place first, so the
Markdown holds what a reader sees, not a loading placeholder.

## /llms.txt

Each build also writes an `/llms.txt` ([llmstxt.org](https://llmstxt.org)): the site's name, its front page's
description, a line saying any page answers Markdown to `Accept: text/markdown`, and a list of every Markdown page,
`- [Title](<address of its .md>): description`. The liveworkspace site and every marketing site link the help
centre's list too (`/help/llms.txt`), which lists the scope's own articles.

## Where it runs

| Site                | Who negotiates                                                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| liveworkspace.app   | the site's Worker, `liveworkspace-site` (`src/worker.ts`), which runs first only on the Markdown pages (`run_worker_first` names them); every other path, the build's assets and the app pages included, is served from the static assets as before |
| The help centre     | its Worker (`src/worker.ts`), which already runs first on every request                                                                                                                                                                             |
| Each marketing site | the product's router, which already runs on every request: a page it forwards to the marketing Worker is negotiated there (`createAppRouter` in `@liveworkspace/sites/app-router`)                                                                  |

No new Worker, route, binding to another Worker, or zone setting. The site's Worker gains a script and an `ASSETS`
binding to its own files, nothing that must exist first.

## Cost

- A request that does not ask for Markdown takes the fast path: one header test and one `Vary` header on a page's
  response. Measured in `negotiate.test.ts` (CPU time, least of five runs).
- The help centre and the marketing sites already run a Worker on every request, so they cost nothing new.
- The liveworkspace site now runs its Worker on a load of one of its six Markdown pages (`run_worker_first`), where
  those were static before: one Worker invocation per such page load. The build's assets and every other page stay
  static.
- The build writes one `.md` file per Markdown page and one `llms.txt` per build.

## Tests

`packages/agent-markdown`: the negotiation (Markdown, HTML, `*/*`, q-values, malformed and long headers), the
`Vary` header on both forms, the fallback, the conversion and the build's plan and `llms.txt`. Each site holds one
Markdown snapshot of a real page, and the liveworkspace site's `agent-markdown.test.ts` pins `run_worker_first` to its
sitemap's Markdown pages.

## Out of scope

Editors, the Explorer, the APIs, the MCP and the CLIs; content negotiation for any type but Markdown and HTML; the
`x-markdown-tokens` count Cloudflare's version sends.
