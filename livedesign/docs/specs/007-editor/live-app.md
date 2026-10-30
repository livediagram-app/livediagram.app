# Live app

The Pages editor: where people design logos and wireframes and edit photos on pages, and export them.

- **Workspace:** `apps/live` (`@livedesign/live`).
- **Public URL:** `https://www.livedesign.app`: the app serves at **clean routes** (`/design/...`, `/explorer/...`, `/new`, ...); the [router app](../016-platform/router-app.md) selects it by route. There's no `/live` URL prefix.
- **Tech:** Next.js (static export), React, TypeScript, Tailwind. No `basePath` (pages serve at clean root paths). A prod-only `assetPrefix: '/live'` keeps the bundled `_next` assets from colliding with marketing's `/_next`; the router strips `/live` from those asset requests (see [08-router-app.md](../016-platform/router-app.md)). Dev runs standalone with clean asset paths.

## Always available without sign-in

A guest can open `/new`, create a design, and use the full canvas without an account. See [04-auth-and-guest-access.md](../014-identity/auth-and-guest-access.md).

## Routes

- `/new`: creates a design and opens it, asking nothing (the app's entry point). See [New design route](new-design-route.md).
- `/design/<id>`: the editor itself, scoped to one design id. Static-exports a single `/design/placeholder` page; the live worker rewrites all `/design/<id>` paths to it at the edge, and the client reads the real id from the path.
- `/explorer/*`, `/sign-in`, `/get-started`, `/embed`: the library, auth, and read-only embed surfaces. `/sign-in` and `/get-started` hand off to the liveworkspace accounts site ([Auth + guest access → Signing in](../014-identity/auth-and-guest-access.md#signing-in)).

## Persistence

The editor talks to the Cloudflare Worker API documented in [11-api.md](../015-api/api.md). `apps/live/lib/api-client.ts` is the single boundary: the editor never reads or writes design state to `localStorage`. The design's Durable Object holds the durable copy; per-tab content is split into its own rows (see [13-per-tab-storage.md](../006-design/per-tab-storage.md)) so autosave scope shrinks to the tab being edited.

`localStorage` is still used for **identity bootstrap only**: the liveworkspace guest token under `livedesign:v2:guest-token` ([Auth + guest access](../014-identity/auth-and-guest-access.md) "Guests"), plus a `livedesign:v2:name-confirmed` flag once the user has named themselves. Everything else flows through the API.

The design shape follows [Design structure](../006-design/design-structure.md): a design has tabs, and elements can link across tabs.

## Layout

Three regions stacked vertically, filling the viewport:

```
┌────────────────────────────────────────────────────┐
│ Header: brand + design name + Share               │
├────────────────────────────────────────────────────┤
│                                                    │
│   Canvas area: viewport with zoom + pan + the      │
│   Palette strip, corner panels, popovers   │
│   and selection chrome on top.                     │
│                                                    │
├────────────────────────────────────────────────────┤
│  [ Tab 1 ] [ Tab 2 ] [ + ]            Tab bar      │
└────────────────────────────────────────────────────┘
```

- **Header:** brand wordmark (a link to the Explorer home, [Brand mark](../004-interface-design/brand-mark.md#links)), design-name field (click to rename), and the Share button. The private/shared/team badge sits next to the title (Team when the design lives in a team library and has no share links, [Team shared designs](../013-workspace/team-shared-designs.md)), followed by the [role pill](#role-pill). (The full-page `/explorer` library is reached from the AuthControls menu and the **Explorer** link in the marketing site header, and the header logo opens its Home.) The editor header carries no product menu: the product's surfaces (Home, Explorer, Help) are links in the Explorer panel's footer ([The editor's Explorer](../013-workspace/explorer-structure.md#the-editors-explorer)); the other apps' headers keep the menu.
- **Canvas:** owns most of the viewport. See [09-canvas-and-palette.md](../008-canvas/canvas-and-palette.md) for the full surface: shapes, arrows, marquee, multi-select, the Palette strip, plus the context panels.
- **Tab bar (status bar):** horizontal row of tabs with `+` to add. Click to switch, double-click to rename, drag to reorder. When the tabs run past the bar it scrolls sideways, the edge with more tabs beyond it fading out (`scroll-edge-fade`, as the strip's rails do) rather than clipping a label mid-word, and **the active tab is always in view**: switching to a tab, or adding one, scrolls the row the least distance that shows all of it (the whole tab, its menu button and avatars included, clear of the edge fade), and so does a tap on the tab already open, and **Add tab** with it when it is the last tab (smoothly, or at once under reduced motion). Its right-hand cluster (`ChromeControls`) holds the **Start Tour** button, **Search**, **Settings**, and the appearance toggle. The Start Tour button, immediately left of Search, is the one way into a tour: a contained chip with a play glyph in a small accent disc reading **Start Pages Tour**, **Start Sankey Tour** and so on, the most specific tour on offer ([Pages tour](pages-tour.md), [Element tours](element-tours.md); [Pages tour](pages-tour.md) "Where it appears"), glyph-only on a phone with its words kept as its accessible name, and not drawn while no tour is on offer. In the editor each shows a text label beside its icon from `sm` up ("Search", "Settings", and the appearance in force: "Light" / "Dark" / "System") and is icon-only on a phone. **Button Labels** in Settings › Appearance (`dockButtonNames`, on by default) turns those labels off on a desktop too, as Minimal chrome does; a phone never shows them, whatever it says. There is no keyboard-shortcuts button: the shortcut reference and the per-device on/off switch live in Settings' **Keyboard** category ([User preferences](user-preferences.md)), which the "Keyboard shortcuts" search command opens directly.

### How a tab looks

The tabs read as tabs, not buttons, and every editor draws them alike from `packages/workbench/src/components/chrome/` (`tab-shape.ts` for the classes, `TabFrame.tsx` for one tab, `TabStrip.tsx` for the strip):

- **They stand on the screen's bottom edge**, like sheet tabs in a spreadsheet: 40 px tall (a 44 px tap area on touch), their upper corners rounded at 10 px and their foot square, at the foot of the bar. The bar is slate-100 (slate-900 in dark), a shade below the open tab, so the open tab lifts off it.
- **The open tab is a card that joins the bottom edge.** It is white (slate-800 in dark) with a hairline ring and a soft shadow cast upward, its foot running into the screen's edge, and its name is semibold in the tab theme's accent, made legible (AA) on the card. Nothing runs along its top: no accent line or bar. Becoming open, its surface eases in over 150 ms (at once under reduced motion).
- **The others are quiet.** No fill, no dividers between them, medium-weight slate ink readable whatever the tab's theme. Hovering one fills a soft rounded wash inset inside it and darkens its ink.
- **Long names truncate** with an ellipsis past 14rem; a truncated name shows in full in a Tooltip.
- **Focus** draws a 2 px brand ring inside the tab's name.
- **Locked** tabs carry a small padlock before the name, in the tab's own ink. **Renaming** swaps the name for a field the same height, inside the tab's own shape.
- **Dragging** dims the dragged tab, and a 2 px brand caret, rounded, stands in the gap where it will land.
- **Add tab** is a quiet `+` after the last tab, with the same inset wash on hover.
- A tab outside a tab-scoped share stands the same way, outlined dashed. Folders open in place in the strip: [Tab folders](../006-design/tab-folders.md#tab-bar-rendering).
- **No `Tabs` label** before the tabs: the row is plainly tabs, and the room goes to them.
- **No type icon.** A tab shows its name alone, at every width: no mode or kind icon before it. A lock still marks a locked tab, and the open tab keeps its menu button.

## Role pill

The **role pill** says whether you are editing, participating in or viewing this design. Everyone sees it, owner included.

- **Where.** In the title bar, after the visibility badge. From `sm` up, like the visibility badge: a phone's title
  bar has no room. Under [Minimal chrome](power-user-mode.md#minimal-chrome) it becomes an icon at the start of the
  status bar instead.
- **What it reads.** "Editing" (emerald), "Participating" (teal) or "Viewing" (amber).
- **Level with the visibility badge.** Both are 19 px pills centred on the title's line: neither sits higher or lower.
- **Who owns the design** is disclosed progressively: a Tooltip on the pill reads "Owned by <name>" ("Owned by you"
  for the owner), and the pill's accessible name carries the same words after its role. There is no separate owner
  badge. With no known owner (the owner has never joined the room), the pill has no Tooltip.
- **A toggle when your role allows editing.** For the owner, and equally for a visitor whose link grants edit, the pill is a
  button: each click steps **Editing**, then **Participating**, a preview of the design as a Participant sees and
  works it ([Share roles](../013-workspace/share-roles.md)), then **Viewing**, a read-only preview as a view-link
  visitor sees it, then back to Editing. The preview is local to this tab and this visit: it changes no one's role on
  the server, nothing other participants see of you, and a reload returns to Editing. Participating works as a
  Participant does: the Participate palette and its limits, adding stickies and text, and moving, rewriting and
  deleting only what you added while previewing. An Editor has no adder key from the room, so the preview stamps
  what it adds with its own (`preview-<participant id>`); what you add stays in the design, and no real
  Participant's key matches it. The pill's accessible description says what a click does ("Switch to participating
  (as a Participant sees it)" / "Switch to viewing (read-only)" / "Switch to editing").
- **Not a toggle when your role is view.** A view-link visitor's pill is static text, focusable so its Tooltip
  can be read by keyboard.
- Zen mode and embeds hide it with the rest of the header.

## What the editor supports

- Boxed elements (shape, text, sticky), arrows (straight / curved / angled, optional label, configurable line thickness + arrowhead size), web components ([Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md)), multi-select via marquee + plain-click + shift-click.
- Per-element format painter, lock, link-to-tab, comment threads.
- Real-time presence + selection + cursor broadcast via the per-design Durable Object room (see [11-api.md](../015-api/api.md)).
- Undo and redo (snapshot-based, personal to each editor).
- Folders in the Explorer (see [15-folders.md](../013-workspace/folders.md)).
- Themed Pages templates (chosen on the tab's start, [Template start](start-diagramming.md)).

## Concurrent-selection lock

To cut down on two people fighting over the same element, an element another participant currently has selected is **locked** for everyone else: you can't select, drag, or edit it while they hold it.

- **Advisory, not authoritative.** The lock is driven entirely by the realtime presence layer (`remoteSelectionsByElement`, built from the room's `select` ops) and deliberately does no server-side enforcement. It is a UX guard that makes same-element collisions rare, **not** a mutual-exclusion guarantee: two clients can still race inside the presence-propagation window, the room relays an `el` update from any edit-role session whoever holds the selection, and REST writers (the MCP server, an API-token script) never see the lock at all. A collision that does happen is last-writer-wins over the whole element, in room order; only the multi-writer fields (checklist ticks, comments) merge, because they travel as deltas ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md), [Collaboration race hardening](../012-collaboration/collab-race-hardening.md)). A field-level CRDT that would have merged such collisions was scoped and deliberately dropped; that residual is the accepted cost.
- **Shown as an outline, never a recolour.** A held element wears the holder's colour as its border (and their disc); a
  face that paints its content from the element's accent (a Card's header band and media, a banner's bar) keeps
  its own colours.
- **Self is never locked out.** Only OTHER participants' selections lock an element; your own selection never blocks you.
- **Auto-releases.** The lock is purely a function of live presence, so it clears the moment the holder deselects, switches tabs, or leaves the room; there's no sticky server state to clean up.
- **Where it's enforced.** All local selection choke points respect it: single-click select, shift multi-select, and marquee (which filters locked ids out of its hit set), plus the element's own pointer-down / double-click-to-edit. A locked element shows a `not-allowed` cursor and the existing remote-selector badge's hover card reads "Locked to <name>" (each disc takes the pointer so the card opens; presses still reach the element).
- **A Viewer's selection holds nothing.** A Viewer only looks, so their selection shows its disc and border but locks nothing: the element stays selectable and editable, and the disc's hover card reads "Selected by <name>" with "They're only viewing, so you can still edit it." Every lock check reads the selector's `holds` flag (false for a Viewer).
- The user-set element **lock** (`element.locked`, the padlock badge) is a separate, persisted feature; this concurrent-selection lock is ephemeral and presence-only.

## SEO and indexing

The live app is the product, not a content surface. Every page the live app serves is one of:

- A signed-in workspace (`/explorer`, `/design/[id]`) carrying private user data that must not appear in search results.
- An auth flow (`/sign-in`, `/get-started`) that's worthless to crawlers and pointless to index.
- The new-design welcome flow (`/new`) that needs the user's runtime identity to mean anything.

`apps/live/app/layout.tsx` declares `robots: { index: false, follow: false }` in the root metadata so every live-app route inherits the directive. Cascades correctly through the static-export pages: each rendered HTML head carries `<meta name="robots" content="noindex,nofollow">`.

This complements the marketing site's SEO policy (see [16-marketing-site.md](../019-marketing/marketing-site.md)): marketing is the indexable surface, the live app is explicitly off-limits to crawlers. The two policies meet at the router worker, which serves them on the same hostname but distinct paths.

## Appearance (light / dark / system)

The editor ships with an **Appearance** control, distinct from the per-tab **themes** (`apps/live/lib/themes.ts`, see [Canvas and palette](../008-canvas/canvas-and-palette.md)). A theme recolours CANVAS content (background, element fill / stroke / text) and is stored in the design, so every viewer sees it; Appearance recolours the editor CHROME (tab bar, editor header, panels, body backdrop) around it and lives only in this browser. A Pink-schemed design still sits on dark chrome when the control is flipped.

Two words, two owners, and the naming is deliberate: **Appearance** is yours, a **theme** is the design's. The stored names stay `theme` (`Tab.theme`, the MCP parameter, the `Theme` telemetry category, and the `livedesign:v2:ui-mode` localStorage key) because they are data on the wire, and renaming them would need a migration and would break saved designs and existing MCP callers for no user-visible gain.

- **Three settings, one button.** The control lives on the right edge of the TabBar and CYCLES Light → Dark → System (`AppearanceToggle`). The glyph shows the CURRENT setting (sun / moon / monitor), not the next one: as a two-state toggle it could get away with showing the target, but with three states (one of them deferring to the OS), the only readable thing is where you are, so the hover card and `aria-label` carry where the next click goes.
- **System follows the OS, live.** `system` resolves through `matchMedia('(prefers-color-scheme: dark)')`, and that query is WATCHED: a machine that turns dark at sunset takes the editor with it without a reload. An explicit Light / Dark ignores the OS entirely and never even reads the query.
- **System is the default.** A first-time visitor gets the chrome their device asks for, and `DEFAULT_APPEARANCE_SETTING` is the one line that says so; an unreadable or older-build value falls back to it too. A reader whose machine is dark has already said so. An explicit Light or Dark still outranks the device: System is where the choice STARTS, not a rule.
- **Dark is its own palette.** The dark chrome is the blue-slate **Steel** palette ([Colour scheme](../004-interface-design/color-scheme.md#dark-palette-steel)), and the Default scheme's dark half is the canvas of the same hue ([Canvas and palette](../008-canvas/canvas-and-palette.md#default-scheme-dark-half)). Light mode's colours are not touched by it.
- **The Default theme follows it** ([Canvas and palette](../008-canvas/canvas-and-palette.md)). Default has hand-made light and dark halves, resolved per viewer at render time: nothing is written to the design when the appearance changes, so a colleague in light chrome reads the light half of the same tab. Every other theme derives its other half the same way ([Light and dark halves](../011-theme/light-and-dark.md)).
- **Unpainted elements take the canvas's ink.** An element carrying no colour of its own is drawn from `defaultStrokeColor` / `defaultFillColor` / `defaultTextColor`, which take a `CanvasSurface` (`'light' | 'dark'`, derived from the resolved backdrop by `canvasSurface`). That is what lets the Default scheme paint nothing onto elements and still read correctly on a charcoal canvas, and it fixes every dark scheme's unpainted elements as a side effect. The surface reaches the views through `CanvasSurfaceContext` rather than props, because the element views are `React.memo`'d and memo blocks a parent re-render but not a context update; the element MENUS read the same context, so a swatch can't show a light-canvas blue beside a grey shape. Exports derive it from the paper they are exporting onto, so what you export is what you see.
- **No match nudge.** Every theme has a light and a dark half ([Light and dark halves](../011-theme/light-and-dark.md)), so a tab never needs the viewer to switch appearance, and nothing prompts them to.
- **One setting for the whole origin** ([Appearance](../004-interface-design/appearance.md)). Stored in `localStorage` under `livedesign:v2:ui-mode`. The value, its storage, the OS watch, the pre-paint script and the public-site toggle live in `@livedesign/ui` (`packages/ui/src/appearance/`), shared with marketing and help, so a pick made on any of them holds in the editor. The shared `useAppearance` returns both the `setting` (what the user picked, what a control renders) and the resolved `appearance` (what the chrome is painted as, what a colour decision reads). The editor wraps it in `hooks/ui/useAppearance.ts` only to add its `UI / Toggled` telemetry, and `AppearanceToggle` draws the shared `AppearanceIcon`.
- The choice is applied on **every** route by a tiny inline script in the root layout (`app/layout.tsx`) that runs before first paint. This matters for two reasons. React mounts after first paint, so ANY hook-based application flashes light before it lands. And the hook is not mounted everywhere anyway: the TabBar, the appearance toggle and the scheme browser render it, but the standalone `/new` route renders none of them, so without the layout script it would paint light over a dark body and stay that way. The snippet is the shared `APPEARANCE_BOOT_SCRIPT`, a string a test EXECUTES against stub globals: what matters about it is not its text but which stored value ends up dark before first paint, and a string assertion happily passed while `system` painted light on a dark machine.
- **Dark Reader stands down.** The root layout declares `<meta name="darkreader-lock">` (through `metadata.other`), the opt-out the Dark Reader extension honours. The editor already paints its own dark chrome, so a reader running the extension gets that instead of a filter over it: without the lock, Dark Reader re-darkens the already dark chrome, muddies the template preview art, and rewrites inline SVG attributes before React hydrates, which React reports as a hydration mismatch. Every app paints its own dark appearance, so every root layout carries the lock (`DARK_READER_LOCK` in `@livedesign/ui`). The meta carries a non-empty `content`, because Next drops a meta whose content is empty; Dark Reader keys on the name alone.
- The `@custom-variant dark (&:where(.dark, .dark *))` declaration in `../packages/tailwind-config/theme.css` configures Tailwind v4's `dark:` variant to use the class selector rather than the media query.
- **Surfaces covered:** body backdrop, TabBar, EditorHeader, the template start ([Template start](start-diagramming.md)) and the `/new` backdrop. Template **preview tiles** and the export-format glyphs are light-canvas art (white fills, slate rules, dark ink), re-lit in dark chrome rather than redrawn: `.preview-art-tile` (shipped by `@livedesign/template-previews`) inverts lightness and spins the hue back under `.dark`, so the art lands on dark paper with its hues intact (a blue node stays blue, an amber sticky stays amber) and new previews inherit it for free. The paper it lands on is the dark canvas colour: the tile's plate and every white fill are clamped to `#f3faff` before the filter (`invert(0.95) hue-rotate(180deg)`, with a `mix-blend-mode: darken` veil), which the filter maps to `#0d1318`, the nearest it can reach to the canvas `#0d121a`. A thumbnail therefore previews the canvas you will get. The marketing template gallery uses the same rule. Colour-scheme swatches are deliberately EXCLUDED, since those show a scheme's actual colours, so re-lighting them would be a lie. The **loading screen** (`DesignLoading`) is dark-aware for the same reason: it is a whole screen between the click and the editor, and a white flash there is the appearance failing at the one moment the user is waiting. Panel chromes (`MovablePanel`) carry the effect on the outer frame, and each panel's content carries its own `dark:` variants.

## Header actions

A long design name truncates with an ellipsis; it never pushes the actions: they keep their full width at every screen size, a phone included, and the name takes what is left.

The right edge of the header holds Share (owner), Copy (visitor), and Sign in or the account control as full-height, edge-flush actions, each an icon stacked over a small label (`HEADER_ACTION_BTN` in `../packages/workbench/src/components/chrome/header-action.tsx`); Share fills brand while the design is shared.

The account menu's **Account** item opens the host page's own Settings dialog on the Account category, in place (the editor via `openSettingsOn('account')`, the Explorer via its settings state); it navigates to `/explorer?settings=account` only when the host passes no handler.

## Share dialog

The Share dialog is a platform component: the shared `@liveworkspace/explorer` `ShareDialog` ([`packages/explorer/README.md`](../../../../packages/explorer/README.md) "`<ShareDialog>`"; share links, passwords and expiry are liveworkspace's index's, [one-explorer.md](../../../../liveworkspace/docs/specs/004-index/one-explorer.md)). Its passes, role picker, lifetimes, password section, guest identity row, Show Me tour and motion are specified there and are the same in every app. The editor lazy-loads it (`apps/live/components/dialogs/EditorTabDialogs.tsx`) from the header Share button, for the owner and, on a team design, every joined member ([Team shared designs](../013-workspace/team-shared-designs.md)); the Explorer opens the same dialog from an item's menu.

What livedesign gives it is its `ShareHost` (`apps/live/lib/explorer-share-host.ts`, the editor's and the Explorer's alike):

- `loadTabs`: the design's tabs, for a link that opens one ([Tab-scoped share links](../013-workspace/tab-scoped-share-links.md)).
- `handOver` (`designHandOver`): the **Embed** address, `/embed?s=<code>` ([Read-only embeds](../013-workspace/embeds.md)), and the **Live image**, `/api/share/<code>/image.svg` ([Live image share link](../013-workspace/live-image-share.md)), for livedesign's own items only.
- `helpHref` (`shareHelpHref`): the Sharing, Share-Link Expiry and Share Passwords help articles.
- `onTelemetry` (`trackShare`): `Document·Shared` / `Document·Removed` for a pass made or revoked, and `UI·Copied` / `Selected` / `Started` / `Ended` for copies, picks and the Show Me tour ([Telemetry](../017-telemetry/telemetry.md)).

## Destructive actions

Every irreversible flow (delete a folder or an image gallery row) is gated by a branded confirmation. Deleting a design is not one: it goes to the Trash with an Undo ([Trash](../013-workspace/trash.md)). Nor is deleting a tab: one commit, so undo brings it back, and the tab menu asks first only when deleting does what an undo cannot take back (a Form tab's link, the forms sending their responses to a board or sheet; `deleteTabWarning`). Two forms:

- **Centre modal**: `../packages/ui/src/dialog/ConfirmDialog.tsx` (the Explorer's too; the editor's copy in `../packages/workbench/src/components/dialogs/ConfirmDialog.tsx` only adds the modal guard), wired in through the `useConfirm` hook (`../packages/workbench/src/hooks/ui/useConfirm.tsx`). The provider mounts once at the live root layout so any descendant can `await confirm({ title, message, confirmLabel })` and receive a boolean. Used where the action has no tight on-screen anchor.
- **Anchored popover**: `../packages/ui/src/ConfirmPopover.tsx` (the Explorer's too): a small popover beside the trigger with an arrow pointing back at it, so you confirm right where you clicked rather than being yanked to the screen centre. Portal-rendered (its `position: fixed` must escape transformed ancestors like the tab menu) and tagged `data-confirm-popover` so a host menu's outside-click handler can ignore it. Used by the tab menu's Delete row when it warns (`deleteTab` performs the delete directly). Esc cancels and hands focus back to the trigger, Enter confirms (Enter on a focused button presses that button, so Enter on Cancel cancels), and a press anywhere but the popover, its trigger or a popover opened above it cancels.

We never fall back to `window.confirm()`: the OS-default chrome reads as a non-livedesign dialog and underplays the consequences.

Non-destructive everyday actions (delete an element, clear a comment, undo a stroke) stay unprompted: undo restores them, and adding a modal at every keystroke would shred the editing flow. The confirmation gate is reserved for actions where one of the following is true:

- The change is persisted to the server and not part of the undo stack.
- The change cascades (removes child rows, breaks cross-references, invalidates share links).
- The change is invisible to other participants in the same room.

Its confirm button is the brand primary button for every action, a delete included ([Destructive actions](../004-interface-design/destructive-actions.md): never red or yellow). Esc cancels, Enter confirms, backdrop click cancels, focus lands on the confirm button so keyboard-only users get the same muscle memory as `window.confirm`.

## Element dialogs and popovers

A dialog or popover opened for one element (its link, a table cell's link, line data, code, Sankey Flows, a
picture's image picker, comments, an action, a note) shows only while it can be shown for that element:
the element is on the active tab, of the kind the dialog edits, and the session may still use it. The moment that
stops being true (a collaborator deletes the element, an undo takes it away, the tab changes, the element locks, the
session turns read-only), the dialog **closes**, rather than hiding with its element still named, so it never
reopens by itself when the element, the lock or the role comes back (`useCloseVanishedDialogs`, with each dialog's own
check).

## Toasts

Asynchronous failures (link-tab, gallery delete, image upload from a background flow) surface through a bottom-right toast stack, never a silent `catch`: `apps/live/hooks/ui/useToast.tsx` (`ToastProvider` + `useToast`). Three tones: `error` (rose), `success` (emerald), `info` (slate). Each toast auto-dismisses after 4 seconds, can be closed early, and dedupes against an identical message already on-screen so a tight retry loop can't drown the surface.

Toasts are NOT used for:

- Autosave progress / failures: the EditorHeader already carries a dedicated save-status pill.
- In-context errors that have a sensible place to live near the action (the image picker's inline "Unsupported file type" surface, the gallery's "Could not load your gallery" banner).

They ARE used for actions that finish off-surface from the gesture: clicking "Add to another design", duplicating a design, or any future flow whose UI has already navigated away by the time the network call resolves.

## Mobile chrome

On a phone-sized viewport the editor's chrome would crowd the canvas. It tightens so a mobile visitor can read the canvas and tap through:

- **A phone has the same layout as a desktop** ([Toolbar layout](toolbar-layout.md)), fitted to its width. A phone is below `sm:`, or a touch screen under 500px tall (landscape; `PHONE_MEDIA_QUERY`, the `phone:` variant). There the Palette is the strip across the top, the Explorer opens from the strip's menu button, and every other panel behaves as on a desktop: tool panels dock in their corners. (Per-element + tab formatting lives in the right-click context menus, so there is no Editor panel. The desktop-only [Quick style panel](../008-canvas/quick-style-panel.md) offers the few most-used choices beside a selection; it is not that panel, and the menus stay the complete home of every setting.) The `/explorer/` page and the AuthControls menu item are alternate routes to the library, open to guests and signed-in users alike.

  **Collaborate and the page buttons are in the bottom-right cluster**, beside Undo and Redo. Left to right: Undo / Redo, the pages strip (Contents, [Pages](pages-mode.md) "Chrome"), Collaborate, then the Theme & Canvas brush, then Zoom (Collaborate only while the tab has a comment thread or an action, [Assigned actions](../012-collaboration/assigned-actions.md) §5). Each button opens its panel as a **popover hanging above it** (`computeDockAnchor(..., 'above')`: from the button's left edge, kept on the canvas, arrow on the popover's bottom edge pointing at the button), and a second press closes it, as does a press anywhere outside it such as the canvas (`dismissOnOutside`; its own portalled menus and confirms count as inside). The popovers share one open-at-a-time slot with the Explorer popover, so opening one closes the others. **Named on a wide desktop** (1440 px and up, `useDockNames`): Contents and Slides show their name beside their icon, and the Theme & Canvas brush is named **Style**, unless **Button Labels** in Settings › Appearance is off (`dockButtonNames`; `DockNamesProvider` in the editor, on outside one); narrower (a laptop at 1280 px, a tablet, a phone) they are icons alone, since the named strips would take the canvas's lower middle (at 1280 px they reach x 446). **A phone's zoom controls drop − and +** (`pinchOnly`): the cluster carries Undo and Redo, and pinch zooms. Fit stays.

- **EditorHeader** drops the `livedesign` wordmark on mobile via the Brand component's new `wordmarkClassName` prop (set to `hidden sm:inline`). The mark stays for orientation. The header's reserved width shrinks accordingly so the design title centres correctly.
- **TabBar** has no leading `Tabs` label, and drops the right-hand cluster's text labels to icons only. Tabs themselves, the +-add, Search, Settings and the dark-mode toggle stay. (There is no shortcuts button to hide: the shortcut reference lives in Settings' Keyboard category, [User preferences](user-preferences.md).)

### A phone held sideways

**The header and the tab bar fold away on a phone held sideways**, so the canvas fills the screen.
Held sideways, a phone is short: the header (56px) and the tab bar (48px) took 104px of an iPhone
15's 393px, leaving the canvas 289px, and 256px of a small Android's 360px (measured 2026-10-17).
Folded, the canvas gets all of it (393px, 360px). Sideways means a touch screen in landscape under
500px tall: `LANDSCAPE_PHONE_MEDIA_QUERY` in `../packages/workbench/src/lib/responsive.ts`,
`(pointer: coarse) and (orientation: landscape) and (max-height: 499px)`, with the CSS twin the
`landscape-phone:` variant (`app/globals.css`). The height is `PHONE_MAX_HEIGHT_PX`, the same 500px
that makes a sideways phone a phone at all (above): the tallest phone held sideways is about 440px
(a 6.9" iPhone Pro Max), and the shortest tablet held sideways is 744px (an iPad mini). A phone held upright, a tablet
and a desktop window however short (a fine pointer) never fold. `orientation: landscape` keeps an
upright phone whose layout shrinks for its keyboard (an older Android) from folding mid-typing.

- **What stays.** Everything else on the canvas stays where it is: the strip across the top (the
  palette, its Search), the bottom-right cluster (Undo, Redo, the pages strip, the Theme
  & Canvas brush, Fit), the menus and the dialogs.
- **What goes for good: the menu button and the Explorer.** At this height the Explorer has no
  room to be useful, so the menu button is not drawn (in the strip's row or, without a strip, the
  corner) and the strip starts at the left gutter in its place. Unlike the bars, nothing brings
  it back while the phone is sideways: not the handle, not a tour. An Explorer open when the
  phone turns closes. Turning the phone upright brings the button back. `EditorCanvasHost` sets
  `explorerHidden` from `useIsLandscapePhone` (`../packages/workbench/src/hooks/ui/useIsMobileViewport.ts`, the
  `LANDSCAPE_PHONE_MEDIA_QUERY` above), the same gate the workbench frame uses; the palette keeps
  the phone's swiping row without the menu card (`leading` of `null`).
- **The bars handle.** A small card at the canvas's top-right corner (12px in, and past a landscape
  notch's side inset and below the top inset; a 36px button with a 44px tap area) holds a chevron:
  **Show Header and Tabs**. Pressing it brings both bars back where they always are: the canvas
  shrinks to make room again, so nothing covers it or the chrome on it. The button, now under the
  header, turns into **Hide Header and Tabs** (`aria-expanded` says which) and folds them again. So
  what lives in the bars stays one press away: Share or Make a Copy, the design's name and
  badges, the role pill, the tabs and their menus, Add Tab, Search, Settings and the appearance
  toggle. The strip's row keeps the handle's 54px clear on its right (`LANDSCAPE_HANDLE_ROOM`: the
  46px card and the row's 8px gap), so a long strip scrolls short of it rather than under it. The
  choice lasts while the design is open in that window: not saved, not synced, and a
  fresh load starts folded.
- **The bars come back on their own** when something needs them: a rename asked for elsewhere (the
  Rename Design and Rename Tab search commands) shows them first, so the name field takes the
  focus; a tour on screen keeps them shown; and a bar never folds while focus is inside it, so a layout that changes while a
  name is typed there (the on-screen keyboard resizing it) cannot fold the field away. Pressing
  Hide takes the focus to the handle, which ends a rename as any press outside it does.
- **Turning the phone** upright shows the bars at once and sideways folds them again (unless shown
  with the handle). The fold is CSS alone: a media query hides the two bars' wrappers
  (`display: contents` otherwise, so the column lays out as before), with no resize or orientation
  listener and no script on the hot path; a press of the handle re-lays the column out once.
- **Not drawn** where the bars are not there to fold: zen mode (it hides them already and keeps its
  own way out, [Zen mode](zen-mode.md)), embeds and the workbench frame, and the welcome flow.
- **Every share role** gets the fold and the handle alike, Editor, Participant and Viewer: it is a
  view of the editor, never of the design, and what is inside each bar keeps its own role gates.
- **Telemetry:** the handle sends `UI / Toggled / LandscapeBarsOn` when it shows the bars and
  `LandscapeBarsOff` when it folds them ([Telemetry](../017-telemetry/telemetry.md)); the automatic
  fold and unfold send nothing.

Implementation: `useLandscapeBars` (the shown flag, the rename and tour reveals, the telemetry),
`LandscapeBarFold` (the wrapper round each bar) and `LandscapeBarsHandle`
(`components/chrome/LandscapeBars.tsx`), wired in `EditorView`.

These don't change desktop layout. The strip and the popovers are what resolve the old "panels overlap when all four open" case on a phone: the Palette is one strip and the Explorer and the bottom-row panels are one-at-a-time popovers. The mobile picker ([Dedicated route for new-design creation](new-design-route.md) responsive section) covers the template / identity surface the same way.

The routes that draw the canvas (`/design/<id>`, `/new`, which opens the editor in place, `/embed` and `/embed/workbench`) export `EDITOR_VIEWPORT` (`../packages/workbench/src/lib/page-viewport.ts`), which pins the page at `initialScale: 1` with `maximumScale: 1` + `userScalable: false`, so mobile browsers don't auto-zoom on top of the editor's own canvas zoom. The two paths this blocks: pinch-zoom on the whole page, and iOS Safari's automatic focus-zoom when a focused input's effective font-size is under 16px (every TabBar / Explorer / Palette field is well under). Without this, focusing a text input on iOS zooms the page in and leaves the chrome misaligned with the canvas-transform coordinate space the cursor / selection-ring math expects. The canvas zoom (pinch on the canvas surface, or the bottom-right zoom buttons) is the only zoom the editor wants users to drive.

That lock stays. Lifting it was tested (2026-10-03): with page zoom allowed, a pinch on the canvas
zoomed the whole page (Chromium, 1.5x) instead of the canvas, which breaks the editor's core
gesture. Readability on a phone comes from the UI scale ([UI scale](ui-scale.md)) and the canvas
zoom instead.

The lock is the canvas's, so it covers only the canvas routes. Every other page of the live app (the
Explorer, sign-in, get-started, join and the rest) keeps the root layout's zoomable viewport
(`width: device-width`, `initialScale: 1`), so a phone can pinch to read it (WCAG 1.4.4 Resize Text). They have no
focus-zoom to do: `globals.css` already holds every field at 16px on a phone.

**Menus are bottom sheets on a phone.** Every context menu (an element's, a selection's: the
shared `ContextMenu`; and the tab menu, from a tab's `⋯` or a long-press on the canvas:
`TabPortalMenu`) opens as a sheet (`BottomSheet`) docked to the bottom edge instead of a
card hung off the long-press point, which covered the element it was about and ran under the tab
bar. Full width (up to 32rem), at most 60% of the screen tall with its own scroll, clear of the
home indicator, rising in (`animate-sheet-up`). A grab handle across its top moves it, the sheet
following the finger: dragged up past 48px (or flicked up) it fills the screen below the top bar, its handle
still across its top; dragged down from there past 48px it returns to its own height; dragged down from its
own height past 80px (or flicked down) it closes; anything less springs back (`useSheetDrag`).
Outside taps and Escape close it as before. A section's flyout opens in place inside it.

**A dialog closes from the backdrop only on a press that starts there.** Clicking the dim
backdrop closes a dialog, but only when the press began on the backdrop: selecting text and
releasing the drag past the panel's edge lands the click on the backdrop too, and must never throw
away what was being edited (`Dialog`).

**Working dialogs rise as sheets on a phone.** A dialog you work in rather than answer, where
the thing being edited sits behind it, opens on a phone as a sheet docked to the
bottom edge instead of filling the screen: full width, rounded at the top, at most 85% of the
screen tall with its own scroll, clear of the home indicator, rising in (`animate-sheet-up`), with
the same grab handle, which fills the screen, returns or closes it as a menu's sheet does (`useSheetDrag`). It stays a modal
dialog: the dim behind it, the focus trap, Escape and the backdrop tap all behave as on a
desktop, where it is the usual centred card (`Dialog`'s `phoneSheet`).

**A dialog stays above the on-screen keyboard.** A touch screen's keyboard shrinks the visual
viewport, not the window a fixed layer and `vh` measure against, so a dialog centred in the window
(on an iPad) sat half under the keyboard, and moving the page or dragging the sheet put
it further under. While the visible area is smaller than the window (`visualViewport` height or
offset differs by more than 1 px), the dialog's dim layer covers just that visible band, following
its every resize and scroll, so the card centres in it and a phone sheet docks on top of the
keyboard. The panel is capped to the band (a card 1rem clear of each edge, a full-width phone panel
all of it) and scrolls inside the cap, over its own `max-h`; a sheet dragged taller stops at the
cap. The field being typed in is scrolled back into view inside the panel as the band changes.
When the keyboard goes the dialog returns to its own placement. With the whole window visible
(any desktop) nothing changes (`useVisualViewportBand`, `Dialog`).

**A dialog opened by touch takes focus on itself, not its first control.** With a keyboard or
mouse, an opening dialog focuses its first control so typing and Tab work at once. On a touch
screen (a coarse primary pointer: phones and tablets) that same focus highlighted the first control
(the card panel's type picker) and could raise the keyboard for a text field nobody tapped, so the
dialog panel itself takes focus instead: screen readers still land inside the dialog, and Tab still
moves into it. A field a dialog deliberately focuses (`autoFocus`, a rename box) keeps its focus on
every device (`useFocusTrap`).

**The keyboard never hides the caret.** The on-screen keyboard shrinks the visual viewport, not
the page, and the canvas never scrolls, so a label edited low on a phone was typed behind the
keyboard. While a text field inside the canvas has focus, each visual-viewport change re-checks
the caret: below the visible area (less a 24px margin) the canvas pans up by just the overlap
(`useKeyboardAvoidance`). Any touch screen, a tablet as a phone (`hover: none`, or a phone's width). The pan stays when the keyboard closes. A field in a popover, menu or floating panel stays in view too, by moving its surface ([On-screen keyboard](../004-interface-design/tooltips-hover-cards-popovers.md#on-screen-keyboard)).

**Haptics.** On a touch screen with a Vibration API (Android; Safari has none, so iOS stays silent)
the editor gives a short buzz for what a finger cannot see land (`../packages/workbench/src/lib/haptics.ts`): **press** (15ms)
when a long-press opens its menu or holds a path node, **snap** (8ms) once as a move catches an
alignment guide (not again while it stays on it), **delete** (a double pulse) when a selection is
deleted. Never with a mouse.

**Safe areas.** The edge chrome clears the device's safe-area insets (`../packages/ui/src/safe-area.ts`): the
header below the top inset and past the side insets, the tab bar above the home indicator and past
the side insets, the strip's row and the bottom-right cluster past a landscape notch. Inline
`env(safe-area-inset-*)` styles, at least the chrome's own gutters. The editor does not set
`viewport-fit=cover`, so the insets are 0 today and nothing moves; the rules keep the chrome clear
the day it goes edge to edge.

## Per-user grants

A design is private, shared through a per-link role, or in a team's space, where every member can edit it ([Teams](../013-workspace/teams.md), [Team shared designs](../013-workspace/team-shared-designs.md)); there are no per-design per-user grants. Two people editing the same element at once is last-writer-wins: [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md) merges concurrent edits to different elements, and the selection lock above makes the same-element case rare.

## Image exports

The image exports (PNG / SVG / PDF) honour the tab's theme: per-element colours, or the same `defaultFillColor` / `defaultStrokeColor` / `defaultTextColor` the canvas uses for elements that defer to the theme, plus the tab's background colour. An iOS-style toggle in the dialog tunes the image output: **Background pattern** (on by default; paints the tab's backdrop pattern (grid, dots, …) via `backgroundPatternTile` in `canvas-backgrounds.ts`, shared by the SVG and the PNG/PDF rasteriser). A single-page PDF prints at the size the tab shows: its page is the rendered image's CSS size at 0.75 pt per px (`singlePageMedia` in `export-tab-pdf.ts`), not its 2x pixel count, and a page past the PDF limit of 14400 pt (`MAX_PDF_PAGE_PT`) shrinks uniformly to fit it while the image keeps every pixel.
