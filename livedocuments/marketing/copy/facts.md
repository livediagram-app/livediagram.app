# Fact sheet

The canonical facts all marketing copy is built from. If something
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

## What it does

- Articles: writing that flows onto pages, with headings, lists, quotes, code,
  pictures and charts. Paste from web pages, Google Docs or Word and the
  formatting comes with it; import Markdown into a tab.
- Slide decks: 16:9 or 4:3 slides from 61 slide layouts, presented full screen
  with presenter notes, a time budget, a laser pointer and a spotlight.
- Infographics and posters in print sizes (A4, US Letter, A3) and social sizes,
  from 92 infographic layouts.
- On every page: shapes, connectors, text, sticky notes, images, icons, tables,
  charts, Sankey diagrams and embeds.
- 23 templates and twenty-four themes that recolour every page in one click.
- Real-time collaboration: live cursors, selection rings, presence on each tab,
  comment threads and assigned actions.
- Undo and redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z), personal to each editor.
- Tabs per document, nested folders in the Explorer, and a 30-day Trash.
- Editor, Participant or Viewer share links, with expiry, passwords and revoke any time;
  live embeds and live images for wikis and READMEs.
- Export pages as PDF, PNG, SVG or an animated GIF, articles as Markdown, and
  any tab as JSON to import back.
- For AI agents and scripts: an MCP server, a CLI (`@livedocuments/cli`) and a
  REST API that read, write and share documents.
- Hybrid auth: guests get the full feature set keyed to a per-browser id;
  signed-in users (a liveworkspace account) add cross-device sync and account self-delete.
- Anonymous first-party telemetry with a public dashboard on liveworkspace.app
  (`/telemetry` opens it). No
  third-party analytics, no identifiers on the wire. Off by default in forks
  unless configured.

## Open source and price

- MIT-licensed and publicly viewable.
- Hosted free at livedocuments.app. No paid tier and no plan to introduce one.
- The open-source core never calls home and never gates features behind a
  license check. Sign-in through liveworkspace accounts is optional; guests
  get saving, sharing and real-time collaboration without it.

## Stack

Runs entirely on Cloudflare: Workers for the API and routing, a Durable Object
per document holding its content and its realtime room, and Workers Static
Assets for the Next.js frontends. No Node-hosted backend, no SSR. Realtime
merges edits by element; two edits to the same element are last-writer-wins.

## Out of scope (do not imply these exist)

- Operational transform or CRDT editing.
- Diagrams, whiteboards, mind maps, boards, sheets, forms, workshops (votes,
  timers) and an in-editor AI assistant are not part of livedocuments. AI works
  through your own assistant, over MCP, the CLI or the API.

## Links

- Hosted: https://livedocuments.app
- Editor: https://livedocuments.app/new
