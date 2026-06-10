# Live app

The diagram editor — where users actually build diagrams and mindmaps.

- **Workspace:** `apps/live` (`@livediagram/live`).
- **Public URL:** `https://livediagram.app/live` (via the [router app](08-router-app.md)).
- **Tech:** Next.js (static export), React, TypeScript, Tailwind. `basePath: '/live'` in `next.config.ts` so internal URLs and asset paths are correctly prefixed.

## Always available without sign-in

A guest can open `/live`, create a diagram, and use the full canvas without an account. See [04-auth-and-guest-access.md](04-auth-and-guest-access.md).

## Routes

- `/live/new` — welcome / template-picker flow for creating a new diagram. See [14-new-diagram-route.md](14-new-diagram-route.md).
- `/live/diagram/<id>` — the editor itself, scoped to one diagram id. Static-exports a single `/diagram/placeholder` page that the router rewrites all `/diagram/<id>` paths to at the edge.
- `/live/` — landing redirect into the welcome flow.

## Persistence

The editor talks to the Cloudflare Worker API documented in [11-api.md](11-api.md). `apps/live/lib/api-client.ts` is the single boundary — the editor never reads or writes diagram state to `localStorage`. D1 holds the durable snapshot; per-tab content is split into its own rows (see [13-per-tab-storage.md](13-per-tab-storage.md)) so autosave scope shrinks to the tab being edited.

`localStorage` is still used for **identity bootstrap only** — a `crypto.randomUUID()` participant id under `livediagram:v2:self-id`, plus a `livediagram:v2:name-confirmed` flag once the user has named themselves. Everything else flows through the API.

The diagram shape follows [05-diagram-structure.md](05-diagram-structure.md) — a diagram has tabs, and elements can link across tabs.

## Layout

Three regions stacked vertically, filling the viewport:

```
┌────────────────────────────────────────────────────┐
│ Header — brand + diagram name + Share              │
├────────────────────────────────────────────────────┤
│                                                    │
│   Canvas area — viewport with zoom + pan + the     │
│   floating Command Palette, Explorer, Context,     │
│   Activity, and selection chrome on top.           │
│                                                    │
├────────────────────────────────────────────────────┤
│  [ Tab 1 ] [ Tab 2 ] [ + ]            Tab bar      │
└────────────────────────────────────────────────────┘
```

- **Header:** brand wordmark, diagram-name field (click to rename), and the Share button. The private/shared badge sits next to the title. (The full-page `/explorer` library is reached from the AuthControls menu, the mobile dock, and the **Explorer** link in the marketing site header — not from the editor header itself.)
- **Canvas:** owns most of the viewport. See [09-canvas-and-command-palette.md](09-canvas-and-command-palette.md) for the full surface — shapes, arrows, marquee, multi-select, floating palettes, plus the activity / context panels.
- **Tab bar:** horizontal row of tabs with `+` to add. Click to switch, double-click to rename, drag to reorder.

## What the editor supports today

- Boxed elements (shape, text, sticky), arrows (straight / curved / angled, optional label, configurable line thickness + arrowhead size), groups, multi-select via marquee + plain-click + shift-click.
- Per-element format painter, lock, link-to-tab, comment threads.
- Real-time presence + selection + cursor broadcast via the per-diagram Durable Object room (see [11-api.md](11-api.md)).
- Per-tab activity log + surgical revert (see [12-activity-and-audit.md](12-activity-and-audit.md)).
- Folders in the Explorer (see [15-folders.md](15-folders.md)).
- Themed templates (chosen on the new-diagram route).

## Concurrent-selection lock

To cut down on two people fighting over the same element, an element another participant currently has selected is **locked** for everyone else: you can't select, drag, or edit it while they hold it.

- **Advisory, not authoritative.** The lock is driven entirely by the realtime presence layer (`remoteSelectionsByElement`, built from the room's `select` ops). It is a UX guard that prevents the common accidental clash, **not** a hard mutual-exclusion guarantee — two clients can still race inside the presence-propagation window. True conflict-free concurrent editing waits on the OT / CRDT work that's still ahead (see [CLAUDE.md](../CLAUDE.md)). It deliberately does no server-side enforcement.
- **Self is never locked out.** Only OTHER participants' selections lock an element; your own selection never blocks you.
- **Auto-releases.** The lock is purely a function of live presence, so it clears the moment the holder deselects, switches tabs, or leaves the room — there's no sticky server state to clean up.
- **Where it's enforced.** All local selection choke points respect it: single-click select, shift multi-select, and marquee (which filters locked ids out of its hit set), plus the element's own pointer-down / double-click-to-edit. A locked element shows a `not-allowed` cursor and the existing remote-selector badge's hover tooltip reads "Locked to <name>".
- The user-set element **lock** (`element.locked`, the padlock badge) is a separate, persisted feature; this concurrent-selection lock is ephemeral and presence-only.

## SEO and indexing

The live app is the product, not a content surface. Every page under `/live/*` is one of:

- A signed-in workspace (`/explorer`, `/diagram/[id]`) carrying private user data that must not appear in search results.
- An auth flow (`/sign-in`, `/get-started`, `/sso-callback`) that's worthless to crawlers and pointless to index.
- The new-diagram welcome flow (`/new`) that needs the user's runtime identity to mean anything.

`apps/live/app/layout.tsx` declares `robots: { index: false, follow: false }` in the root metadata so every route under `/live/*` inherits the directive. Cascades correctly through the static-export pages: each rendered HTML head carries `<meta name="robots" content="noindex,nofollow">`.

This complements the marketing site's SEO policy (see [16-marketing-site.md](16-marketing-site.md)): marketing is the indexable surface, the live app is explicitly off-limits to crawlers. The two policies meet at the router worker, which serves them on the same hostname but distinct paths.

## UI light / dark mode

The editor ships with a UI **light / dark mode** toggle, distinct from the per-tab diagram themes (`apps/live/lib/themes.ts`, see [spec/09](09-canvas-and-command-palette.md)). Diagram themes recolour CANVAS content (background, element fill / stroke / text); the UI mode recolours the editor CHROME (tab bar, editor header, panels, body backdrop) around it. The two are independent: a Slate-themed diagram still sits on a dark UI when the toggle is flipped.

- The toggle lives on the right edge of the TabBar (sun / moon icon button). Hover tooltips ("Switch to dark mode" / "Switch to light mode") spell out the next state.
- Preference persists in `localStorage` under `livediagram:v2:ui-mode` (values `'light'` / `'dark'`). `hooks/useUiMode.ts` owns the toggle + the `.dark` class on `documentElement`.
- The choice is applied on **every** route by a tiny inline script in the root layout (`app/layout.tsx`) that runs before first paint. This matters because `useUiMode` is only mounted by the TabBar — the welcome / template-picker flow and the standalone `/live/new` route never render it, so without the layout script they'd render light over the dark body. The script reads the same localStorage key and adds `.dark` synchronously, so there's no light-mode flash on any surface.
- Default is light. There is no auto-prefers-color-scheme detection in v1 (the toggle is explicit so the choice is the user's, not the OS's) — the layout script likewise only honours the stored value, it never reads the OS preference.
- The `@custom-variant dark (&:where(.dark, .dark *))` declaration in `packages/tailwind-config/theme.css` configures Tailwind v4's `dark:` variant to use the class selector rather than the media query.
- **Surfaces covered:** body backdrop, TabBar, EditorHeader, the TemplatePicker modal (the welcome / "Quick Start" / "Pick a template" flow) and the `/live/new` backdrop. Template **preview tiles** keep a light backdrop in dark mode on purpose — they're illustrative mini-canvases whose SVG content is light, so a light tile keeps them legible. Panel chromes (`MovablePanel`) carry the toggle's effect on the outer frame; per-panel content (Palette, Context, Explorer, Activity) lights up incrementally as the `dark:` variants get added to each accordion / row. Until that's done, an open panel reads light over a dark backdrop — usable, not yet polished.

## Share dialog

The "Share this diagram" modal (`apps/live/components/ShareDialog.tsx`, opened from the header Share button, owner-only) follows the same dialog conventions as Settings / Shortcuts / Export: a dimmed blurred backdrop (`bg-slate-900/40 backdrop-blur-sm`, click-to-close, Esc closes), a centred panel with dark-mode styling, and a scrollable body capped to the viewport.

Its sections are ordered by frequency of use, top to bottom:

1. **New link** — role toggle (Edit / View-only) + lifetime dropdown (spec/34) + Create. First because creating a link is the dialog's primary action; the first-run empty state points up at it.
2. **Active links** — one card per live link: a first line with the role badge, the countdown chip for expiring links (spec/34), and the URL; a second line with the actions (Copy link, Embed per spec/33, revoke). Two lines so the URL keeps its space as badges and actions accumulate.
3. **Inactive links** (spec/34) — only when non-empty: Expired badge, struck-through URL, Extend + Delete.
4. **Options band** — the quieter, less-frequently-touched settings: the share **password** (spec/24; applies to every link, with a hint that covers the embed prompt too) and **your name** (the identity peers see on cursors and comments; locked to the Clerk display name when signed in).

## Destructive actions

Every irreversible flow (delete a diagram, a folder, a tab, or an image gallery row) is gated by a branded confirmation. Two forms:

- **Centre modal** — `apps/live/components/ConfirmDialog.tsx`, wired in through the `useConfirm` hook (`apps/live/hooks/useConfirm.tsx`). The provider mounts once at the live root layout so any descendant can `await confirm({ title, message, confirmLabel })` and receive a boolean. Used where the action has no tight on-screen anchor.
- **Anchored popover** — `apps/live/components/ConfirmPopover.tsx`: a small popover beside the trigger with an arrow pointing back at it, so you confirm right where you clicked rather than being yanked to the screen centre. Portal-rendered (its `position: fixed` must escape transformed ancestors like the tab menu) and tagged `data-confirm-popover` so a host menu's outside-click handler can ignore it. **First use:** the tab menu's Delete row (the menu's own confirm now lives here; `deleteTab` performs the delete directly). Esc cancels, Enter confirms.

We never fall back to `window.confirm()`: the OS-default chrome reads as a non-livediagram dialog and underplays the consequences.

Non-destructive everyday actions (delete an element, clear a comment, undo a stroke) stay unprompted: undo restores them, and adding a modal at every keystroke would shred the editing flow. The confirmation gate is reserved for actions where one of the following is true:

- The change is persisted to the server and not part of the undo stack.
- The change cascades (removes child rows, breaks cross-references, invalidates share links).
- The change is invisible to other participants in the same room.

The modal supports `danger` (rose-tinted confirm button) and `neutral` variants; default is `danger` because the current call sites are all destructive. Esc cancels, Enter confirms, backdrop click cancels, focus lands on the confirm button so keyboard-only users get the same muscle memory as `window.confirm`.

## Toasts

Asynchronous failures that previously fell through to silent `catch` blocks (link-tab, gallery delete, image upload from a background flow) now surface through a bottom-right toast stack: `apps/live/hooks/useToast.tsx` (`ToastProvider` + `useToast`). Three tones: `error` (rose), `success` (emerald), `info` (slate). Each toast auto-dismisses after 4 seconds, can be closed early, and dedupes against an identical message already on-screen so a tight retry loop can't drown the surface.

Toasts are NOT used for:

- Autosave progress / failures: the EditorHeader already carries a dedicated save-status pill.
- In-context errors that have a sensible place to live near the action (the image picker's inline "Unsupported file type" surface, the gallery's "Could not load your gallery" banner).

They ARE used for actions that finish off-surface from the gesture: clicking "Add to another diagram", duplicating a diagram, or any future flow whose UI has already navigated away by the time the network call resolves.

## Mobile chrome

The editor's floating panels (Palette, Explorer, Editor/Context, Activity) were designed for desktop where they overlap a wide canvas comfortably. On a phone-sized viewport they crowd each other and the canvas. The first responsive pass tightens the chrome so a mobile visitor can at least read the canvas and tap through:

- **A compact mobile dock replaces the per-panel banners.** Below `sm:` the floating panels don't render at their desktop corners. A single button row pinned **top-right** of the canvas exposes **Explorer / Palette / Editor** (ContextPanel), plus **AI** when the assistant is enabled and the session is editable. Tapping a button opens that panel as a popover anchored beneath it; tapping the active button again closes it (and adding a shape or tool from the Palette popover auto-closes it so the user can draw immediately). The Explorer is reachable here too, so it is no longer hidden on mobile; the `/live/explorer/` page and the AuthControls menu item are alternate routes, open to guests and signed-in users alike. Activity keeps its own minimise path. On desktop nothing changes by default: panels sit at their own corners and collapse to a banner via the header +/- button (see spec/09 "Collapse to banner"), unless the user opts into the minimal panel layout (spec/09), which brings this same dock to desktop.
- **EditorHeader** drops the `livediagram` wordmark on mobile via the Brand component's new `wordmarkClassName` prop (set to `hidden sm:inline`). The mark stays for orientation. The header's reserved width shrinks accordingly so the diagram title centres correctly.
- **TabBar** hides the leading `Tabs` label, the keyboard-shortcuts button, and the Settings button below `sm`. Tabs themselves, the +-add and the dark-mode toggle stay. The shortcuts dialog is keyboard-driven anyway; on a touch device its UI value is low.

These don't change desktop layout. The mobile dock above is what resolves the old "panels overlap when all four open" case: at most one panel is open at a time, as a popover. The mobile picker (spec/14 responsive section) covers the template / identity surface the same way.

The root layout (`apps/live/app/layout.tsx`) exports a `viewport` config that pins the page at `initialScale: 1` with `maximumScale: 1` + `userScalable: false`, so mobile browsers don't auto-zoom on top of the editor's own canvas zoom. The two paths this blocks: pinch-zoom on the whole page, and iOS Safari's automatic focus-zoom when a focused input's effective font-size is under 16px (every TabBar / Explorer / Palette field is well under). Without this, focusing a text input on iOS zooms the page in and leaves the chrome misaligned with the canvas-transform coordinate space the cursor / selection-ring math expects. The canvas zoom (pinch on the canvas surface, or the bottom-right zoom buttons) is the only zoom the editor wants users to drive.

## Out of scope (next iterations)

- **Operational transform / CRDT edits** — realtime is LWW broadcast; concurrent edits to the same element clobber.
- **Comments inbox / mentions** — comment threads exist per-element but there's no aggregated view yet.
- **Transactional email** (Resend) for share notifications and account flows. The api worker has no outbound email path today.
- **Multi-user team permissions beyond share links**: today a diagram is either private or shared via a per-link role. No teams, no per-user grants.

(The previous "Auth UI" and "Export" bullets are now shipped: Clerk auth landed per [spec/04](04-auth-and-guest-access.md), and the active tab can be exported as JSON / Markdown / PNG / PDF via the `ExportTabDialog`.)
