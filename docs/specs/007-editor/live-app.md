# Live app

The diagram editor — where users actually build diagrams and mindmaps.

- **Workspace:** `apps/live` (`@livediagram/live`).
- **Public URL:** `https://livediagram.app` — the app serves at **clean routes** (`/document/...`, `/explorer/...`, `/new`, ...); the [router app](../016-platform/router-app.md) selects it by route. There's no `/live` URL prefix.
- **Tech:** Next.js (static export), React, TypeScript, Tailwind. No `basePath` (pages serve at clean root paths). A prod-only `assetPrefix: '/live'` keeps the bundled `_next` assets from colliding with marketing's `/_next`; the router strips `/live` from those asset requests (see [08-router-app.md](../016-platform/router-app.md)). Dev runs standalone with clean asset paths.

## Always available without sign-in

A guest can open `/new`, create a document, and use the full canvas without an account. See [04-auth-and-guest-access.md](../014-identity/auth-and-guest-access.md).

## Routes

- `/new` — welcome / template-picker flow for creating a new document (the app's entry point). See [New document route](new-document-route.md).
- `/document/<id>` — the editor itself, scoped to one document id. Static-exports a single `/document/placeholder` page; the live worker rewrites all `/document/<id>` paths to it at the edge, and the client reads the real id from the path.
- `/explorer/*`, `/sign-in`, `/get-started`, `/sso-callback`, `/embed` — the library, auth, and read-only embed surfaces.

## Persistence

The editor talks to the Cloudflare Worker API documented in [11-api.md](../015-api/api.md). `apps/live/lib/api-client.ts` is the single boundary — the editor never reads or writes document state to `localStorage`. D1 holds the durable snapshot; per-tab content is split into its own rows (see [13-per-tab-storage.md](../006-document/per-tab-storage.md)) so autosave scope shrinks to the tab being edited.

`localStorage` is still used for **identity bootstrap only** — a `crypto.randomUUID()` participant id under `livediagram:v2:self-id`, plus a `livediagram:v2:name-confirmed` flag once the user has named themselves. Everything else flows through the API.

The document shape follows [Document structure](../006-document/document-structure.md) — a document has tabs, and elements can link across tabs.

## Layout

Three regions stacked vertically, filling the viewport:

```
┌────────────────────────────────────────────────────┐
│ Header — brand + document name + Share              │
├────────────────────────────────────────────────────┤
│                                                    │
│   Canvas area — viewport with zoom + pan + the     │
│   floating Palette, Explorer, Context,     │
│   Activity, and selection chrome on top.           │
│                                                    │
├────────────────────────────────────────────────────┤
│  [ Tab 1 ] [ Tab 2 ] [ + ]            Tab bar      │
└────────────────────────────────────────────────────┘
```

- **Header:** brand wordmark, document-name field (click to rename), and the Share button. The private/shared/team badge sits next to the title (Team when the document lives in a team library and has no share links, [Team shared documents](../013-workspace/team-shared-documents.md)), followed by the [role pill](#role-pill). (The full-page `/explorer` library is reached from the AuthControls menu, the mobile dock, and the **Explorer** link in the marketing site header — not from the editor header itself.)
- **Canvas:** owns most of the viewport. See [09-canvas-and-palette.md](../008-canvas/canvas-and-palette.md) for the full surface — shapes, arrows, marquee, multi-select, floating palettes, plus the activity / context panels.
- **Tab bar (status bar):** horizontal row of tabs with `+` to add. Click to switch, double-click to rename, drag to reorder. Its right-hand cluster (`ChromeControls`, shared with the Explorer's bottom bar) holds **Search**, **Settings**, and the appearance toggle. In the editor each shows a text label beside its icon from `sm` up ("Search", "Settings", and the appearance in force: "Light" / "Dark" / "System") and is icon-only on a phone; the Explorer's bar stays icon-only. There is no keyboard-shortcuts button: the shortcut reference and the per-device on/off switch live in Settings' **Keyboard** category ([User preferences](user-preferences.md)), which the "Keyboard shortcuts" search command opens directly.

## Role pill

The **role pill** says whether you are editing or viewing this document. Everyone sees it, owner included.

- **Where.** In the title bar, after the visibility badge. From `sm` up, like the visibility badge: a phone's title
  bar has no room. Under [Minimal chrome](power-user-mode.md#minimal-chrome) it becomes an icon at the start of the
  status bar instead.
- **What it reads.** "Editing" (emerald) or "Viewing" (amber).
- **Who owns the document** is disclosed progressively: a Tooltip on the pill reads "Owned by <name>" ("Owned by you"
  for the owner), and the pill's accessible name carries the same words after its role. There is no separate owner
  badge. With no known owner (the owner has never joined the room), the pill has no Tooltip.
- **A toggle when your role allows editing.** For the owner, and equally for a visitor whose link grants edit, the pill is a
  button: clicking it switches between Editing and **Viewing**, a read-only preview of the document as a view-link
  visitor sees it. The preview is local to this tab and this visit: it changes nothing on the server, nothing other
  participants see, and a reload returns to Editing. The pill's accessible description says what a click does
  ("Switch to viewing (read-only)" / "Switch to editing").
- **Not a toggle when your role is view.** A view-link visitor's pill is static text, focusable so its Tooltip
  can be read by keyboard.
- Zen mode and embeds hide it with the rest of the header.

## What the editor supports today

- Boxed elements (shape, text, sticky), arrows (straight / curved / angled, optional label, configurable line thickness + arrowhead size), groups, multi-select via marquee + plain-click + shift-click.
- Per-element format painter, lock, link-to-tab, comment threads.
- Real-time presence + selection + cursor broadcast via the per-document Durable Object room (see [11-api.md](../015-api/api.md)).
- Per-tab activity log + surgical revert (see [12-activity-and-audit.md](../012-collaboration/activity-and-audit.md)).
- Folders in the Explorer (see [15-folders.md](../013-workspace/folders.md)).
- Themed templates (chosen on the new-document route).

## Concurrent-selection lock

To cut down on two people fighting over the same element, an element another participant currently has selected is **locked** for everyone else: you can't select, drag, or edit it while they hold it.

- **Advisory, not authoritative.** The lock is driven entirely by the realtime presence layer (`remoteSelectionsByElement`, built from the room's `select` ops) and deliberately does no server-side enforcement. It is a UX guard that makes same-element collisions rare, **not** a mutual-exclusion guarantee: two clients can still race inside the presence-propagation window, the room relays an `el` update from any edit-role session whoever holds the selection, and REST writers (the MCP server, an API-token script) never see the lock at all. A collision that does happen is last-writer-wins over the whole element, in room order; only the multi-writer fields (answers, ideas, checklist ticks, comments, dots) merge, because they travel as deltas ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md), [Collaboration race hardening](../012-collaboration/collab-race-hardening.md)). A field-level CRDT that would have merged such collisions was scoped and deliberately dropped; that residual is the accepted cost.
- **Self is never locked out.** Only OTHER participants' selections lock an element; your own selection never blocks you.
- **Auto-releases.** The lock is purely a function of live presence, so it clears the moment the holder deselects, switches tabs, or leaves the room — there's no sticky server state to clean up.
- **Where it's enforced.** All local selection choke points respect it: single-click select, shift multi-select, and marquee (which filters locked ids out of its hit set), plus the element's own pointer-down / double-click-to-edit. A locked element shows a `not-allowed` cursor and the existing remote-selector badge's hover card reads "Locked to <name>".
- **The facilitator can free one.** "Auto-releases" covers the holder deselecting or leaving, but not the person still connected who wandered off with something selected — and a session can stop dead on an element nobody may touch. Right-clicking a locked element opens a one-item menu for whoever is running the session ([Facilitator](../012-collaboration/facilitator.md) "Freeing somebody's lock"); it still opens nothing for everybody else. The room tells the holder alone, the holder drops the selection, and the lock then clears everywhere through the ordinary `select` op — so this adds no server-side enforcement and leaves the lock exactly as advisory as it was.
- The user-set element **lock** (`element.locked`, the padlock badge) is a separate, persisted feature; this concurrent-selection lock is ephemeral and presence-only.

## SEO and indexing

The live app is the product, not a content surface. Every page the live app serves is one of:

- A signed-in workspace (`/explorer`, `/document/[id]`) carrying private user data that must not appear in search results.
- An auth flow (`/sign-in`, `/get-started`, `/sso-callback`) that's worthless to crawlers and pointless to index.
- The new-document welcome flow (`/new`) that needs the user's runtime identity to mean anything.

`apps/live/app/layout.tsx` declares `robots: { index: false, follow: false }` in the root metadata so every live-app route inherits the directive. Cascades correctly through the static-export pages: each rendered HTML head carries `<meta name="robots" content="noindex,nofollow">`.

This complements the marketing site's SEO policy (see [16-marketing-site.md](../019-marketing/marketing-site.md)): marketing is the indexable surface, the live app is explicitly off-limits to crawlers. The two policies meet at the router worker, which serves them on the same hostname but distinct paths.

## Appearance (light / dark / system)

The editor ships with an **Appearance** control, distinct from the per-tab **themes** (`apps/live/lib/themes.ts`, see [Canvas and palette](../008-canvas/canvas-and-palette.md)). A theme recolours CANVAS content (background, element fill / stroke / text) and is stored in the document, so every viewer sees it; Appearance recolours the editor CHROME (tab bar, editor header, panels, body backdrop) around it and lives only in this browser. A Pink-schemed document still sits on dark chrome when the control is flipped.

Two words, two owners, and the naming is deliberate: **Appearance** is yours, a **theme** is the document's. The stored names stay `theme` (`Tab.theme`, the MCP parameter, the `Theme` telemetry category, and the `livediagram:v2:ui-mode` localStorage key) because they are data on the wire — renaming them would need a migration and would break saved documents and existing MCP callers for no user-visible gain.

- **Three settings, one button.** The control lives on the right edge of the TabBar and CYCLES Light → Dark → System (`AppearanceToggle`). The glyph shows the CURRENT setting (sun / moon / monitor), not the next one: as a two-state toggle it could get away with showing the target, but with three states — one of them deferring to the OS — the only readable thing is where you are, so the hover card and `aria-label` carry where the next click goes.
- **System follows the OS, live.** `system` resolves through `matchMedia('(prefers-color-scheme: dark)')`, and that query is WATCHED: a machine that turns dark at sunset takes the editor with it without a reload. An explicit Light / Dark ignores the OS entirely and never even reads the query.
- **System is the default.** A first-time visitor gets the chrome their device asks for, and `DEFAULT_APPEARANCE_SETTING` is the one line that says so; an unreadable or older-build value falls back to it too. The editor was light-by-default for as long as the control was a two-state toggle, on the reasoning that going dark should be asked for — but that reasoning only held while there was no way to say "follow my device". Now there is, and a reader whose machine is dark has already said it. An explicit Light or Dark still outranks the device: System is where the choice STARTS, not a rule.
- **Dark is its own palette.** The dark chrome is the blue-slate **Steel** palette ([Colour scheme](../004-interface-design/color-scheme.md#dark-palette-steel)), and the Default scheme's dark half is the canvas of the same hue ([Canvas and palette](../008-canvas/canvas-and-palette.md#default-scheme-dark-half)). Light mode's colours are not touched by it.
- **The Default theme follows it** ([Canvas and palette](../008-canvas/canvas-and-palette.md)). Default is the only scheme with a light and a dark half, resolved per viewer at render time: nothing is written to the document when the appearance changes, so a colleague in light chrome reads the light half of the same tab. Every other scheme is stored colour and reads identically for everyone.
- **Unpainted elements take the canvas's ink.** An element carrying no colour of its own is drawn from `defaultStrokeColor` / `defaultFillColor` / `defaultTextColor`, which take a `CanvasSurface` (`'light' | 'dark'`, derived from the resolved backdrop by `canvasSurface`). That is what lets the Default scheme paint nothing onto elements and still read correctly on a charcoal canvas — and it fixes every dark scheme's unpainted elements as a side effect. The surface reaches the views through `CanvasSurfaceContext` rather than props, because the element views are `React.memo`'d and memo blocks a parent re-render but not a context update; the element MENUS read the same context, so a swatch can't show a light-canvas blue beside a grey shape. Exports derive it from the paper they are exporting onto, so what you export is what you see.
- **Match nudge.** When the active tab's theme doesn't match the appearance — a dark-backdrop scheme viewed in light chrome, or the reverse — a dismissible floating prompt (`ThemeModeBanner`) appears bottom-centre (above the tab bar, the same slot the sign-in banner uses, and it yields to that banner when both apply). "This tab uses a dark theme → Dark" sets the appearance to match. "Dark vs light" is decided by the resolved scheme's backdrop luminance (`isLightColor`), so it works for built-in and custom schemes alike. Default never triggers it — it already matches, by construction. Hidden in zen / embed. Dismissal is keyed to the specific scheme+appearance mismatch, so dismissing it on one tab still lets it re-offer on a differently styled tab. The colour-scheme picker's category drill-in offers the same switch inline ([Canvas and palette](../008-canvas/canvas-and-palette.md)).
- **One setting for the whole origin** ([Appearance](../004-interface-design/appearance.md)). Stored in `localStorage` under `livediagram:v2:ui-mode`. The value, its storage, the OS watch, the pre-paint script and the public-site toggle live in `@livediagram/ui` (`packages/ui/src/appearance/`), shared with marketing, help and the dashboard, so a pick made on any of them holds in the editor. The shared `useAppearance` returns both the `setting` (what the user picked, what a control renders) and the resolved `appearance` (what the chrome is painted as, what a colour decision reads). The editor wraps it in `hooks/ui/useAppearance.ts` only to add its `UI / Toggled` telemetry, and `AppearanceToggle` draws the shared `AppearanceIcon`.
- The choice is applied on **every** route by a tiny inline script in the root layout (`app/layout.tsx`) that runs before first paint. This matters for two reasons. React mounts after first paint, so ANY hook-based application flashes light before it lands. And the hook is not mounted everywhere anyway — the TabBar, the match nudge, the appearance toggle and the scheme browser render it, but the standalone `/new` route renders none of them, so without the layout script it would paint light over a dark body and stay that way. The snippet is the shared `APPEARANCE_BOOT_SCRIPT`, a string a test EXECUTES against stub globals: what matters about it is not its text but which stored value ends up dark before first paint, and a string assertion happily passed while `system` painted light on a dark machine.
- **Dark Reader stands down.** The root layout declares `<meta name="darkreader-lock">` (through `metadata.other`), the opt-out the Dark Reader extension honours. The editor already paints its own dark chrome, so a reader running the extension gets that instead of a filter over it: without the lock, Dark Reader re-darkens the already dark chrome, muddies the template preview art, and rewrites inline SVG attributes before React hydrates, which React reports as a hydration mismatch. Every app paints its own dark appearance, so every root layout carries the lock (`DARK_READER_LOCK` in `@livediagram/ui`). The meta carries a non-empty `content`, because Next drops a meta whose content is empty; Dark Reader keys on the name alone.
- The `@custom-variant dark (&:where(.dark, .dark *))` declaration in `packages/tailwind-config/theme.css` configures Tailwind v4's `dark:` variant to use the class selector rather than the media query.
- **Surfaces covered:** body backdrop, TabBar, EditorHeader, the TemplatePicker modal (the welcome / "New Document" / "Pick a template" flow) and the `/new` backdrop. Template **preview tiles** and the export-format glyphs are light-canvas art (white fills, slate rules, dark ink). They used to keep a LIGHT plate in dark chrome so they stayed legible, which left the New Document screen reading as a grid of bright white cards on a near-black dialog. They are now re-lit instead of redrawn: `.preview-art-tile` (shipped by `@livediagram/template-previews`) inverts lightness and spins the hue back under `.dark`, so the art lands on dark paper with its hues intact (a blue node stays blue, an amber sticky stays amber) and new previews inherit it for free. The paper it lands on is the dark canvas colour: the tile's plate and every white fill are clamped to `#f3faff` before the filter (`invert(0.95) hue-rotate(180deg)`, with a `mix-blend-mode: darken` veil), which the filter maps to `#0d1318`, the nearest it can reach to the canvas `#0d121a`. A thumbnail therefore previews the canvas you will get. The marketing template gallery uses the same rule. Colour-scheme swatches are deliberately EXCLUDED — those show a scheme's actual colours, so re-lighting them would be a lie. The **loading screen** (`DocumentLoading`) is dark-aware for the same reason: it is a whole screen between the click and the editor, and a white flash there is the appearance failing at the one moment the user is waiting. Panel chromes (`MovablePanel`) carry the effect on the outer frame; per-panel content (Palette, Context, Explorer, Activity) lights up incrementally as the `dark:` variants get added to each accordion / row. Until that's done, an open panel reads light over a dark backdrop — usable, not yet polished.

## Header actions

The right edge of the header holds Share (owner), Copy (visitor), and Sign in or the account control as full-height, edge-flush actions, each an icon stacked over a small label (`HEADER_ACTION_BTN` in `apps/live/components/chrome/header-action.tsx`); Share fills brand while the document is shared. Pill, gradient, bordered and ink-button restyles were tried and dropped in favour of this simpler look.

The account menu's **Account** item opens the host page's own Settings dialog on the Account category, in place (the editor via `openSettingsOn('account')`, the Explorer via its settings state); it navigates to `/explorer?settings=account` only when the host passes no handler.

## Share dialog

The "Share this document" modal (`apps/live/components/dialogs/ShareDialog.tsx`, opened from the header Share button, owner-only) follows the same dialog conventions as Settings / Export: a dimmed blurred backdrop (`bg-slate-900/40 backdrop-blur-sm`, click-to-close, Esc closes), a centred panel with dark-mode styling, and a scrollable body capped to the viewport.

### The pass metaphor

A share link is presented as a **pass**: a ticket that admits whoever holds it. The metaphor answers the three questions an owner actually has, in the order they have them: _who can get in_ (the list of passes), _what does a new one let them do_ (the role), and _how do I hand it over_ (copy). Every link-level fact reads as something printed on the ticket (the role on its stub, the tabs it admits, how long it is valid), so the owner scans cards rather than parsing rows of controls.

A pass is a card whose left edge is a solid role-coloured stub (a perforated edge with punched notches was tried and read as stray dots and circles at card size, so the stub's colour edge is the only divide):

- **Stub** (left): the role's glyph over its word, `EDITOR` or `VIEWER`, on a solid role colour: brand for edit, violet for view. The colour is the role at a glance across the whole list.
- **Body** (right), three lines:
  1. The link, in a monospaced read-only field (select-on-focus for a manual copy) with the pass's copy button **inside** its right edge: a quiet icon button, the grey copy glyph with no word or fill (brand on hover) (the field is the thing being copied, so the action lives in it), named and tooltipped "Copy link"; for a beat after copying it becomes an emerald check and reads "Copied".
  2. What it is printed with: **Opens** the tabs it admits (the rescope picker, [Tab-scoped share links](../013-workspace/tab-scoped-share-links.md), shown only on a multi-tab document; on a single-tab document every pass opens every tab, so the term is left off), **Valid** for how long ("Forever" or the countdown, [Share-link expiry](../013-workspace/share-link-expiry.md)), and a **Password** tag while the document has a share password.
  3. The other ways to hand it over, **Embed** ([Read-only embeds](../013-workspace/embeds.md)) and **Live image** ([Live image](../013-workspace/live-image-share.md), hidden while a password is set), with **Revoke** at the far edge.

Passes are listed newest first. Files: `ShareDialog.tsx` (orchestration), `ShareStatus.tsx`, `ShareComposer.tsx`, `SharePassTicket.tsx` (the ticket shell), `ActiveSharePass.tsx`, `ExpiredSharePass.tsx`, `SharePasswordSection.tsx`, `ShareIdentity.tsx`, with the role catalogue (`ROLE_PASS`) in `share-dialog-parts.tsx`.

An **expired** pass keeps the same card, greyed: a muted stub, the URL struck through, a rose `Expired` stamp, and **Extend** + **Delete** in place of the hand-over actions.

### Arrival and departure

Passes never appear or vanish in one frame. A **new pass opens its own space**: its row eases from zero height to its natural height while the card fades in and settles 6px (`animate-row-open`, 250ms, the long chrome token), so the passes below glide down rather than jump. It then wears a soft brand ring for `PASS_HIGHLIGHT_MS` (1.4s, a timer), which fades out over 250ms. A **revoked or deleted pass closes its space**: it fades, shrinks a touch and collapses (`animate-row-close`, 250ms), and only when that finishes is the revoke or delete sent (an exit hold, `usePassExit`), so the list below glides up. If the request fails, the pass opens back up. The gap between passes lives inside each collapsing row, so it closes with it. Reduced motion collapses both to an instant change, as everywhere ([Motion](../004-interface-design/motion.md)).

### Layout, top to bottom

1. **Header**: the title and a **status line** (`ShareStatus`, `role="status"`) that states the document's exposure in one phrase, with a dot: "Private: only you can open it." (slate) when no active pass exists, otherwise "Shared: anyone holding the pass / one of the N passes can get in" (a pinging emerald live dot, an ambient indicator per [Motion](../004-interface-design/motion.md)), ending ", with the password." when a password is set. This replaces the static explanation of roles, which the role cards below now carry.
2. **Issue a pass** (the primary action): two large **role cards** side by side (a radio group, arrow keys move between them; stacked below `sm`), **Editor** ("Draws with you in real time.") and **Viewer** ("Watches, pans and zooms. Can't change a thing."), each with its glyph and the stub colour it will print with; then the pass's **fine print** in a tinted panel, one labelled row per term with the labels in one column (stacked above their controls below `sm`): **Valid**, a four-way segmented control (a radio group, arrow keys wrap) reading Forever / 1 week / 1 month / 6 months, whose selected segment takes the chosen role's colour; and **Opens**, the tabs select, only on a multi-tab document. Then one full-width button, **Create Pass**. Creating copies the new link to the clipboard straight away (a toast confirms "Pass created and copied"; if the clipboard refuses, the toast says the pass was created and to copy it from the card), and the new pass arrives with its copy button showing "Copied".
3. **Passes** (active, newest first), set off from the composer by a hairline rule, its count in a `CountBadge` beside the caption (the Expired caption carries one too). Revoking a pass asks first in a `ConfirmPopover` beside the bin ("Revoke this pass? The link stops working at once for everyone holding it." / **Revoke**), per [Destructive actions](#destructive-actions). Empty state: a dashed ghost ticket reading "No passes yet. Only you can open this document." When every pass has expired it reads "Every pass has expired. Extend one below or issue a new one."
4. **Expired passes** ([Share-link expiry](../013-workspace/share-link-expiry.md)), only when non-empty.
5. **Password** ([Share password](../013-workspace/share-password.md)): a switch row (the shared `SettingsToggleRow`), "Password Protection", with the hint "Everyone opening a pass must enter it first, embeds included." Switching it on reveals the field (kept in the clear so the owner can always read it) with **Save**; with a password saved, **Remove** clears it, and switching it off removes it too. A password cannot be switched off without removing it, so the switch never disagrees with what the server enforces.
6. **Footer**: for guests only, **Sharing as**: the identity avatar, then under the caption the shuffle button hard against the left of an inline name field (next to the name it changes, not out by Done). This is the name peers see on cursors and comments. It sits in the footer so it is always visible without leading the dialog with a form; it is saved when a pass is created (as before) and whenever the dialog closes (Done, the close button, Esc, or the backdrop). Signed-in users' names come from their Clerk account, so the identity hides. **Done** closes.

## Destructive actions

Every irreversible flow (delete a document, a folder, a tab, or an image gallery row) is gated by a branded confirmation. Two forms:

- **Centre modal** — `apps/live/components/dialogs/ConfirmDialog.tsx`, wired in through the `useConfirm` hook (`apps/live/hooks/ui/useConfirm.tsx`). The provider mounts once at the live root layout so any descendant can `await confirm({ title, message, confirmLabel })` and receive a boolean. Used where the action has no tight on-screen anchor.
- **Anchored popover** — `apps/live/components/primitives/ConfirmPopover.tsx`: a small popover beside the trigger with an arrow pointing back at it, so you confirm right where you clicked rather than being yanked to the screen centre. Portal-rendered (its `position: fixed` must escape transformed ancestors like the tab menu) and tagged `data-confirm-popover` so a host menu's outside-click handler can ignore it. **First use:** the tab menu's Delete row (the menu's own confirm now lives here; `deleteTab` performs the delete directly). Esc cancels, Enter confirms.

We never fall back to `window.confirm()`: the OS-default chrome reads as a non-livediagram dialog and underplays the consequences.

Non-destructive everyday actions (delete an element, clear a comment, undo a stroke) stay unprompted: undo restores them, and adding a modal at every keystroke would shred the editing flow. The confirmation gate is reserved for actions where one of the following is true:

- The change is persisted to the server and not part of the undo stack.
- The change cascades (removes child rows, breaks cross-references, invalidates share links).
- The change is invisible to other participants in the same room.

The modal supports `danger` (rose-tinted confirm button) and `neutral` variants; default is `danger` because the current call sites are all destructive. Esc cancels, Enter confirms, backdrop click cancels, focus lands on the confirm button so keyboard-only users get the same muscle memory as `window.confirm`.

## Toasts

Asynchronous failures that previously fell through to silent `catch` blocks (link-tab, gallery delete, image upload from a background flow) now surface through a bottom-right toast stack: `apps/live/hooks/ui/useToast.tsx` (`ToastProvider` + `useToast`). Three tones: `error` (rose), `success` (emerald), `info` (slate). Each toast auto-dismisses after 4 seconds, can be closed early, and dedupes against an identical message already on-screen so a tight retry loop can't drown the surface.

Toasts are NOT used for:

- Autosave progress / failures: the EditorHeader already carries a dedicated save-status pill.
- In-context errors that have a sensible place to live near the action (the image picker's inline "Unsupported file type" surface, the gallery's "Could not load your gallery" banner).

They ARE used for actions that finish off-surface from the gesture: clicking "Add to another document", duplicating a document, or any future flow whose UI has already navigated away by the time the network call resolves.

## Mobile chrome

The editor's floating panels (Palette, Explorer, Editor/Context, Activity) were designed for desktop where they overlap a wide canvas comfortably. On a phone-sized viewport they crowd each other and the canvas. The first responsive pass tightens the chrome so a mobile visitor can at least read the canvas and tap through:

- **A compact mobile dock replaces the per-panel banners** in the Minimal
  layout. A phone's default layout is Toolbar ([Toolbar layout](toolbar-layout.md)), which has no dock;
  the dock is what a phone shows once its user picks Minimal. Below `sm:` the floating panels don't render at their desktop corners. A single button row pinned **top-right** of the canvas exposes **Explorer / Palette**, plus **AI** when the assistant is enabled and the session is editable, plus **Vote** / **Poll** while a dot-vote or live poll is running on the tab ([Session tools (timer + voting)](../012-collaboration/session-tools.md), [Live poll (ephemeral pulse-check)](../012-collaboration/live-poll.md)). The session buttons go **last** so the permanent ones keep their positions and a poll starting mid-session doesn't shuffle the row under a thumb, and neither is gated on edit access — a view-only participant answers polls and watches vote results.

  Those two panels used to be **unreachable on mobile entirely**, and not for want of a dock button: the non-docking render branch listed its panels by hand and simply never included them, so a live poll or vote had no panel at all below `sm:`. The docked (desktop) branch iterates `PANEL_IDS`, which is why it was only ever broken on the layouts taking the other path. (Per-element + tab formatting lives in the right-click context menus, so there is no Editor panel / dock button. The desktop-only [Quick style panel](../008-canvas/quick-style-panel.md) offers the few most-used choices beside a selection; it is not that panel, and the menus stay the complete home of every setting.) Tapping a button opens that panel as a popover anchored beneath it; tapping the active button again closes it (and adding a shape or tool from the Palette popover auto-closes it so the user can draw immediately). The Explorer is reachable here too, so it is no longer hidden on mobile; the `/explorer/` page and the AuthControls menu item are alternate routes, open to guests and signed-in users alike. Activity keeps its own minimise path. On desktop nothing changes by default: panels sit at their own corners and collapse to a banner via the header +/- button (see [Canvas and palette](../008-canvas/canvas-and-palette.md) "Collapse to banner"), unless the user opts into the minimal panel layout ([Canvas and palette](../008-canvas/canvas-and-palette.md)), which brings this same dock to desktop. **Layers, Activity and Collaborate are not in the row:** they are buttons in the bottom-right cluster in every layout (Collaborate right after Layers, only while the tab has a comment thread or an action, and a popover in every layout including Floating, [Assigned actions](../012-collaboration/assigned-actions.md) §5). Only desktop **Floating** docks them as corner panels that minimise into those buttons. Everywhere else (Minimal, Toolbar, and every phone layout) the button opens its panel as a **popover hanging above it** (`computeDockAnchor(..., 'above')`: from the button's left edge, kept on the canvas, arrow on the popover's bottom edge pointing at the button), and a second press closes it, as does a press anywhere outside it such as the canvas (`dismissOnOutside`; its own portalled menus and confirms count as inside). They share the dock's one-open-at-a-time slot, so opening one closes the other (and the Explorer). **A phone's zoom controls drop − and +** in every layout (`pinchOnly`): the cluster carries Activity and Layers, and pinch zooms. Fit stays. **A phone in the Toolbar layout ([Toolbar layout](toolbar-layout.md)) has no dock at all:** it keeps the desktop chrome (panels in their corners, Layers and Activity in the bottom row), with the Explorer behind the strip's menu button. `PhoneDockProvider` tells `MovablePanel` which it is.

- **EditorHeader** drops the `livediagram` wordmark on mobile via the Brand component's new `wordmarkClassName` prop (set to `hidden sm:inline`). The mark stays for orientation. The header's reserved width shrinks accordingly so the document title centres correctly.
- **TabBar** hides the leading `Tabs` label below `sm` and drops the right-hand cluster's text labels to icons only. Tabs themselves, the +-add, Search, Settings and the dark-mode toggle stay. (There is no shortcuts button to hide: the shortcut reference lives in Settings' Keyboard category, [User preferences](user-preferences.md).)

These don't change desktop layout. The mobile dock above is what resolves the old "panels overlap when all four open" case: at most one panel is open at a time, as a popover. The mobile picker ([Dedicated route for new-document creation](new-document-route.md) responsive section) covers the template / identity surface the same way.

The root layout (`apps/live/app/layout.tsx`) exports a `viewport` config that pins the page at `initialScale: 1` with `maximumScale: 1` + `userScalable: false`, so mobile browsers don't auto-zoom on top of the editor's own canvas zoom. The two paths this blocks: pinch-zoom on the whole page, and iOS Safari's automatic focus-zoom when a focused input's effective font-size is under 16px (every TabBar / Explorer / Palette field is well under). Without this, focusing a text input on iOS zooms the page in and leaves the chrome misaligned with the canvas-transform coordinate space the cursor / selection-ring math expects. The canvas zoom (pinch on the canvas surface, or the bottom-right zoom buttons) is the only zoom the editor wants users to drive.

## Out of scope (next iterations)

- **Comments inbox / mentions** — comment threads exist per-element but there's no aggregated view yet. A cross-document inbox is sketched for assigned actions in [Assigned actions](../012-collaboration/assigned-actions.md) and not built either.
- **Per-user grants** — a document is private, shared via a per-link role, or in a team's shared library. Teams shipped ([Teams](../013-workspace/teams.md) + [Team shared documents](../013-workspace/team-shared-documents.md)), but every member can edit every team document; there are no per-document per-user grants.

(Four earlier bullets here have shipped. Auth UI landed per [Auth + guest access](../014-identity/auth-and-guest-access.md); the active tab exports as JSON / Markdown / PNG / SVG / PDF via `ExportTabDialog`; transactional + lifecycle email ships through the api worker per [Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md); and realtime is no longer whole-tab LWW: [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) merges concurrent edits to different elements. A field-level CRDT for two people editing the SAME element was scoped and deliberately dropped; the advisory selection lock above makes that case rare, and when it happens it stays last-writer-wins.)

The image exports (PNG / SVG / PDF) honour the tab's theme: per-element colours, or the same `defaultFillColor` / `defaultStrokeColor` / `defaultTextColor` the canvas uses for elements that defer to the theme, plus the tab's background colour. Two iOS-style toggles in the dialog tune the image output: **Isometric view** (off by default; tilts the scene into the isometric projection, see [Isometric view](../008-canvas/isometric-view.md)) and **Background pattern** (on by default; paints the tab's backdrop pattern — grid / dots / … — via `backgroundPatternTile` in `canvas-backgrounds.ts`, shared by the SVG and the PNG/PDF rasteriser).
