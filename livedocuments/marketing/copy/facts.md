# Fact sheet

The canonical, true-today facts all marketing copy is built from. If something
below stops being true, fix it here first, then propagate to the taglines and
descriptions. Mirrors the site's own words (`SITE_DESCRIPTION` and `SITE_PITCH`
in `packages/ui/src/site.ts`) and the marketing FAQ (`apps/marketing/lib/faq-content.tsx`).

## One line

A free, real-time editor for documents made of pages: articles, slide decks and
infographics, made together.

## What it is

A real-time editor in the browser for documents made of pages. Write an article
that flows onto as many pages as it needs, build a slide deck and present it,
or lay out an infographic or poster for print or social. Every document is a
stack of tabs, each holding its pages, and people work on them together live.
There is no sign-up wall: open the editor and start.

## Who it's for

Teams who write and present together: briefs, reports and proposals, launch
decks and quarterly reviews, posters, one-pagers and social posts. The unit of
value is the team, not the individual.

## Shipped today

- Articles: writing that flows onto pages, with headings, lists, quotes, code,
  pictures and charts. Paste from web pages, Google Docs or Word and the
  formatting comes with it; import Markdown into a tab.
- Slide decks: 16:9 or 4:3 slides from 61 slide layouts, presented full screen
  with presenter notes, a time budget, a laser pointer and a spotlight.
- Infographics and posters in print sizes (A4, US Letter, A3) and social sizes,
  from 92 infographic layouts.
- On every page: shapes, connectors, text, sticky notes, images, icons, tables,
  charts, Sankey diagrams and embeds.
- 35 templates, including logo and wireframe templates, and twenty-four themes
  that recolour every page in one click.
- Real-time collaboration: live cursors, selection rings, presence on each tab,
  comment threads and assigned actions.
- Undo and redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z), personal to each editor.
- Tabs per document, nested folders in the Explorer, and a 30-day Trash.
- Editor or view-only share links, with expiry, passwords and revoke any time;
  live embeds and live images for wikis and READMEs.
- Export pages as PDF, PNG, SVG or an animated GIF, articles as Markdown, and
  any tab as JSON to import back.
- For AI agents and scripts: an MCP server, a CLI (`@livedocuments/cli`) and a
  REST API that read, write and share documents.
- Anonymous first-party telemetry with a public dashboard at `/telemetry`. No
  third-party analytics, no identifiers on the wire. Off in self-hosted forks
  unless configured.

## Open source and price

- MIT-licensed, publicly viewable, self-hostable end to end.
- Hosted free at livedocuments.app. No paid tier and no plan to introduce one.
- The open-source core never calls home and never gates features behind a
  license check. Without sign-in configured, a self-hosted copy runs in guest
  mode with saving, sharing and real-time collaboration all working.

## Stack

Runs entirely on Cloudflare: Workers for the API and routing, D1 for storage,
Durable Objects for realtime, Static Assets for the Next.js frontends. No
Node-hosted backend, no SSR.

## Not yet shipped (do not imply these exist)

- Operational transform / CRDT (realtime is last-writer-wins per element today).
- Diagrams, whiteboards, mind maps, boards, sheets, forms, workshops (votes,
  timers) and an in-editor AI assistant are not part of livedocuments. AI works
  through your own assistant, over MCP, the CLI or the API.

## Links

- Hosted: https://livedocuments.app
- Editor: https://livedocuments.app/live
