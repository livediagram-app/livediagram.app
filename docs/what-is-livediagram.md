# What is livediagram?

A multiplayer canvas in the browser. Teams build diagrams and mindmaps together in real time: shared cursors, live selections, per-tab activity log with surgical revert. The canvas always works without signing in, so the friction to start is "open the link, start drawing."

The hosted product is at **[livediagram.app](https://livediagram.app)**. The entire codebase is [MIT-licensed](../LICENSE) and self-hostable end-to-end.

## Who it's for

Teams that think visually together:

- Engineering teams sketching architecture, sequence flows, system designs.
- Product and design teams mapping user journeys, information architecture, brainstorms.
- Cross-functional groups in workshops, planning sessions, retrospectives.

The unit of value is the team, not the individual. See [spec/00](../specs/00-purpose.md) for the full positioning.

## What's built today

- **Canvas primitives**: shapes (fourteen geometric primitives plus frames, device mockups for wireframing, progress bars / rings, star ratings, timeline rails, and pie / bar / line charts, plus a curated single-colour icon catalogue), tables, sticky notes, text, images, arrows (straight / curved / angled with draggable curve / elbow handles, configurable thickness + arrowhead size, optional labels), freehand sketches via the Pencil tool (smooth SVG paths with optional shape-recognition mode that auto-converts rectangles / circles / diamonds / lines), comment threads, per-element links + locks.
- **Multi-select**: marquee drag, shift-click, format painter, groups.
- **Layers**: per-tab Photoshop-style layers with a dockable Layers panel (per-layer previews, hide, lock, rename, drag-to-restack); Bring to Front / Send to Back move elements between layers, and hidden layers stay out of exports. See [spec/74](../specs/74-layers.md).
- **Rotation**: tilt any boxed element about its centre to a preset 45° angle from the right-click Rotation menu or the search palette's Rotate actions; the angle round-trips through copy / paste / duplicate / save (spec/09).
- **Templates**: forty-five starters across eight categories (mind maps, flowcharts, hierarchies, agile, project management, strategy, design, technical), from Blank, Flowchart, Kanban, and SWOT to Gantt, ER diagram, sequence diagram, system architecture, and three UI wireframes.
- **Themes**: twenty-seven presets (including the multi-colour palettes from spec/29) that recolour the canvas, every shape, every arrow in one click, plus a custom-theme builder that saves owner-scoped themes to the database (spec/44).
- **Multiplayer**: live presence, cursors, selection rings, comments, laser-pointer broadcast via per-diagram Durable Object rooms.
- **Audit log**: every change recorded per-tab; one-click revert on any entry, even after later edits.
- **Tabs**: every diagram is a stack of tabs (link across them; copy a tab into another diagram).
- **Folders**: nested folders in the Explorer; full-page `/explorer` for signed-in users.
- **Sharing**: editor or view-only share links per diagram, with an optional password gate that applies to every link on the diagram; revoke individually or in bulk at any time.
- **Embeds**: a read-only `/embed` view of any share link, iframe-able into wikis, Notion, and docs (copy the snippet from the Share dialog); live-updates as the diagram is edited. See [spec/33](../specs/33-embeds.md).
- **Hybrid auth**: guests get everything (full persistence keyed to a per-browser id); signed-in users (Clerk) get cross-device sync and account self-delete.
- **Offline Mode** (optional, per diagram): create a diagram saved only in this browser (IndexedDB), never on the server. Opt in from the New Diagram wizard's Settings step; convert either way later (Sync Diagram uploads it to your account, Take Offline pulls a cloud diagram down and deletes the server copy). See [spec/76](../specs/76-offline-mode.md).
- **Export / import**: active tab to Markdown / PDF / PNG / JSON file; import the JSON envelope back as a new tab.
- **"Shared with you" Explorer accordion**: visitors can make their own copy of a shared diagram.
- **Teams**: create teams with Admin / Member roles and email invites in the Explorer, plus a per-team shared library of diagrams. See [spec/32](../specs/32-teams.md) and [spec/35](../specs/35-team-shared-diagrams.md).
- **AI assistance** (optional): an in-editor panel with two modes — Ask answers questions about the active tab, Clean fixes label typos and normalises sizes, positions, and styles. Off by default; needs an `OPENAI_API_KEY` on the api worker plus per-user opt-in in Settings, and is hidden entirely on forks that don't configure a key. See [spec/25](../specs/25-ai-assistance.md).
- **Telemetry**: anonymous first-party product events stored in D1; public dashboard at `/telemetry`. No third-party analytics; no identifiers crossing the wire. Off in OSS forks unless the worker is configured for it. See [spec/22](../specs/22-telemetry.md).
- **Transactional + lifecycle email** (optional): welcome on first sign-in, week-1 / week-2 onboarding tips off the daily cron, and transactional team-invite + account-deleted messages, sent via Resend. Off until a `RESEND_API_KEY` is set; guests never receive email (it's authenticated-only). See [spec/64](../specs/64-transactional-email.md).

## What's still ahead

- **Finer-grained team permissions** (today every member can edit every team diagram).

Realtime collaboration is in good shape: concurrent edits to _different_ elements merge, the room orders mutations so everyone converges, and a dropped connection catches up on reconnect (see [spec/75](../specs/75-realtime-conflict-resolution.md)). Two people editing the _same_ element at once is headed off by the selection lock (spec/07), so a full field-level CRDT isn't needed.

## Open source

- The codebase is **[MIT-licensed](../LICENSE)** and publicly viewable. Anyone can self-host.
- The hosted version at [livediagram.app](https://livediagram.app) runs alongside. **Free for everyone, no paid tier, no plan to introduce one.**
- The OSS core never calls home and never gates features behind a license check. Its SaaS integrations are all optional, each gated on its own key — Clerk (auth), Resend (email), and OpenAI (the AI assistant): with `CLERK_JWKS_URL` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` unset the api worker and live frontend degrade to pure-guest mode and the editor is fully usable. A self-hoster who wants zero outbound runtime traffic (besides Cloudflare) can leave all three unset.

See [spec/03](../specs/03-open-source-and-business-model.md) for the distribution model, and [spec/04](../specs/04-auth-and-guest-access.md) for the hybrid auth contract.
