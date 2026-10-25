# Fact sheet

The canonical, true-today facts all marketing copy is built from. If something
below stops being true, fix it here first, then propagate to the taglines and
descriptions. Mirrors [Purpose](../../docs/specs/001-project-vision/purpose.md)
and the site-wide pitch in `packages/ui/src/site.ts` (`SITE_PITCH`: "a real-time
editor for logos and wireframes").

## One line

A real-time editor for logos, wireframes and photos that works without signing
in. Open a link, design together, show it.

## What it is

A multiplayer page editor in the browser. A design holds tabs, and every tab is
a run of pages of one kind: a logo artboard, a wireframe of a screen, or a photo
edited in layers. The editor never sits behind a sign-in wall, so the friction
to start is "open the link, start designing."

## Who it's for

Teams who design and show their work together:

- Founders, marketers and designers making a logo and the kit of files that
  goes with it.
- Product teams sketching the screens of an app or a site as wireframes, and
  walking through them.
- Anyone touching up a photo, a banner or a social image in layers, without a
  desktop image editor.

The unit of value is the team, not the individual.

## Shipped today

- Real-time multiplayer: live cursors, selection awareness, per-element merge,
  comments with mentions, Follow Me, one realtime room per design.
- Logo pages: artboards with guides, mirroring and shape combining, exported as
  a Logo Kit.
- Wireframe pages: a screen per page, sized to its device, with ready-made
  layouts and web components that lay themselves out.
- Photo pages: a layered pixel editor with adjustments and filters, exported as
  PNG, JPEG, WebP or PSD.
- On any page: text, shapes, images, charts, tables, icons, stickers and
  embeds.
- Templates for logos, wireframes and photos; themes that restyle a whole tab.
- Present: the Slides view steps through a tab's pages full screen, with a
  laser pointer and a spotlight.
- Export pages as PDF, PNG or SVG; import and export a design as JSON.
- Tabs, tab folders and layers; nested folders in the Explorer.
- Editor or view-only share links, revocable any time; read-only embeds.
- Teams with a shared library of designs.
- Undo and redo, personal to each editor; every change saves on its own.
- Offline Mode: a design can be kept in this browser only.
- Machine access: a public REST API, an MCP server and a CLI.
- Guests get the full editor keyed to their browser; signing in (a
  liveworkspace account) adds sync across devices.
- Anonymous first-party telemetry with a public dashboard at `/telemetry`.

## What it is not

- Not a diagramming tool or a whiteboard (that is livediagram).
- Not a deck builder or a word processor (that is livedocuments).
- Not a desktop app, and not a paid product.

## Open source and price

- MIT-licensed and publicly viewable.
- Hosted free at livedesign.app. No paid tier and no plan to introduce one.
- The open-source core never calls home and never gates features behind a
  license check. Sign-in through liveworkspace accounts is the one optional
  dependency; without it the app runs in full-featured guest mode.

## Stack

Runs entirely on Cloudflare: Workers for the API and routing, Durable Objects
for each design and its realtime room, Static Assets for the Next.js frontends.
No Node-hosted backend, no SSR.

## Links

- Hosted: https://livedesign.app
- Editor: https://livedesign.app/live
