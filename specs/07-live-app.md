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

- **Header:** brand wordmark, diagram-name field (click to rename), and the Share button. The private/shared badge sits next to the title.
- **Canvas:** owns most of the viewport. See [09-canvas-and-command-palette.md](09-canvas-and-command-palette.md) for the full surface — shapes, arrows, marquee, multi-select, floating palettes, plus the activity / context panels.
- **Tab bar:** horizontal row of tabs with `+` to add. Click to switch, double-click to rename, drag to reorder.

## What the editor supports today

- Boxed elements (shape, text, sticky), arrows (straight / curved / angled, optional label, configurable line thickness + arrowhead size), groups, multi-select via marquee + plain-click + shift-click.
- Per-element format painter, lock, link-to-tab, comment threads.
- Real-time presence + selection + cursor broadcast via the per-diagram Durable Object room (see [11-api.md](11-api.md)).
- Per-tab activity log + surgical revert (see [12-activity-and-audit.md](12-activity-and-audit.md)).
- Folders in the Explorer (see [15-folders.md](15-folders.md)).
- Themed templates (chosen on the new-diagram route).

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
- Preference persists in `localStorage` under `livediagram:v2:ui-mode` (values `'light'` / `'dark'`). Read on mount and re-applied as a `.dark` class on `documentElement` so the rest of the editor's `dark:` Tailwind variants light up.
- Default is light. There is no auto-prefers-color-scheme detection in v1 (the toggle is explicit so the choice is the user's, not the OS's).
- The `@custom-variant dark (&:where(.dark, .dark *))` declaration in `packages/tailwind-config/theme.css` configures Tailwind v4's `dark:` variant to use the class selector rather than the media query.
- **Phase 1 surfaces** (covered today): body backdrop, TabBar, EditorHeader. Panel chromes (`MovablePanel`) carry the toggle's effect on the outer frame; per-panel content (Palette, Context, Explorer, Activity) light up incrementally as the `dark:` variants get added to each accordion / row. Until that's done, an open panel reads light over a dark backdrop — usable, not yet polished.

## Destructive actions

Every irreversible flow (delete a diagram, a folder, a tab, or an image gallery row) is gated by a single branded confirmation modal: `apps/live/components/ConfirmDialog.tsx`, wired in through the `useConfirm` hook (`apps/live/hooks/useConfirm.tsx`). The provider mounts once at the live root layout so any descendant can `await confirm({ title, message, confirmLabel })` and receive a boolean. We never fall back to `window.confirm()`: the OS-default chrome reads as a non-livediagram dialog and underplays the consequences.

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

- **Palette + Editor (ContextPanel) collapse to a banner** rather than docking to a button. On mobile they start collapsed by default so the canvas isn't covered by chrome; tapping the banner expands the body, tapping anywhere outside collapses it again. Desktop users start expanded and use the header +/- button to collapse / expand. See spec/09 "Collapse to banner" for the shared `MovablePanel` mechanism. Activity still docks through the bottom cluster.
- **Explorer is hidden entirely on mobile**. The floating panel doesn't render and there is no bottom-dock entry point: signed-in mobile users reach the Explorer from the AuthControls dropdown's "Explorer" menu item, or navigate directly to `/live/explorer/` (which is also open to guests, see spec/04). On desktop the Explorer uses the same banner-collapse mechanism as the Palette / Editor.
- **EditorHeader** drops the `livediagram` wordmark on mobile via the Brand component's new `wordmarkClassName` prop (set to `hidden sm:inline`). The mark stays for orientation. The header's reserved width shrinks accordingly so the diagram title centres correctly.
- **TabBar** hides the leading `Tabs` label, the keyboard-shortcuts button, and the Settings button below `sm`. Tabs themselves, the +-add and the dark-mode toggle stay. The shortcuts dialog is keyboard-driven anyway; on a touch device its UI value is low.

These don't change desktop layout. The remaining "panels overlap when all four open" mobile case is tracked separately, the dock-button entry points + the mobile picker (spec/14 responsive section) give the user a path to anywhere they need to go.

## Out of scope (next iterations)

- **Operational transform / CRDT edits** — realtime is LWW broadcast; concurrent edits to the same element clobber.
- **Comments inbox / mentions** — comment threads exist per-element but there's no aggregated view yet.
- **Transactional email** (Resend) for share notifications and account flows. The api worker has no outbound email path today.
- **Multi-user team permissions beyond share links**: today a diagram is either private or shared via a per-link role. No teams, no per-user grants.

(The previous "Auth UI" and "Export" bullets are now shipped: Clerk auth landed per [spec/04](04-auth-and-guest-access.md), and the active tab can be exported as JSON / Markdown / PNG / PDF via the `ExportTabDialog`.)
