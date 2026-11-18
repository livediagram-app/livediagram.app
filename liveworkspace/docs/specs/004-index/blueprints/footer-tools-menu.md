# The footer's Tools menu: blueprint

Derived from [footer-tools-menu.md](../footer-tools-menu.md). The spec decides; this file only adds engineering
precision. Paths are relative to the repository root.

| File                                                                        | Role                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/workbench/src/components/chrome/ChromeToolsMenu.tsx`              | `ChromeToolsMenu` (the button and its menu), `ChromeToolsItem`, `toolsDescription`         |
| `packages/snapshots/src/ui/history-snapshots.tsx`                           | `useHistorySnapshotsHost()`: Snapshots for History (FM9), null without a door              |
| `packages/workbench/src/components/chrome/useItemToolsRows.tsx`             | the History and Webhooks rows, History's modes (FM9)                                       |
| `liveplanner/apps/editor/components/automations/automations-tools-item.tsx` | `useAutomationsToolsItem()`: the Automations row, null without a door                      |
| `livedocuments/apps/editor/components/versions/history-tools-item.tsx`      | `useVersionHistoryInTools(onOpen)`: Version History offered to History                     |
| `packages/walkthrough/src/ui/WalkthroughsTools.tsx`                         | `WalkthroughsTools({ menu })`: the Walkthroughs row (door key `walkthroughs`) and its view |
| `packages/workbench/src/components/chrome/ToolsView.tsx`                    | `ToolsView`: a tool's view inside Tools (the back bar, the slot, waiting, focus)           |
| `packages/workbench/src/components/chrome/tools-door.ts`                    | `usePublishToolsItems`, `requestToolsView(id)`, `usePublishItemVersions`                   |
| `packages/ui/src/dialog/dialog-slot.ts`                                     | the slot a tool's dialog renders into, in place of a modal                                 |
| `<product>/apps/<editor>/components/chrome/ChromeControls.tsx`              | builds the rows in the spec's order and draws `ChromeToolsMenu` left of Search             |

FM1. `ChromeToolsItem = { id, group, label, description, icon, onSelect(anchor), inPlace?, view?, aside?, attention?,
attentionLabel? }`. `inPlace: true`: `onSelect` opens a dialog, which renders inside Tools (FM6). `view(ctx)`: the
tool's own view, drawn inside Tools (`ctx = { back, close, sheet }`). Neither: a press closes Tools, then calls
`onSelect` (Search; History where it holds only Version History, FM9).
`ChromeToolsMenu` takes `items` (nulls dropped) and `labelled`, and renders nothing with no items.

`group` is one of `TOOL_GROUPS` (`find`, `automate`, `collaborate`, `versions`, `content`, in that order), each rendered as a
`role="group"` under its heading (`data-tools-group`), empty groups left out.

FM2. The trigger: `CHROME_BTN` (+ `CHROME_BTN_LABELLED`), `ToolsGlyph`, label "Tools", `aria-label` "Tools" (with
", <attentionLabel>" for each item in attention), `aria-haspopup="dialog"`, `aria-expanded`, `data-tools-button`, no
HoverCard. An item in attention adds a dot (`data-tools-attention="amber" | "brand"`), amber when any item's is.

FM3. The popover: `AnchoredPopover` (`pointer`, `align="end"`, name "Tools", 480px), holding `HeroDialogHeader`
(`toolsHeroArt` from `@liveworkspace/ui/dialog-hero-art/tools`, its close) and the rows under `HERO_TOKEN_STYLE`, so
the plates paint in the band's tokens. Rows are buttons (`data-tools-item={id}`); a press on an `inPlace` or `view` row opens
its view (FM6), any other closes the popover, then calls `onSelect(toolsButton)`. Up and down move a row, Home and End
to the ends.

FM4. The Automations card's aside is the on-count badge (`data-automations-count`), amber with a paused rule; a
paused rule sets `attention: 'amber'` with `attentionLabel` "a rule is paused".

FM5. The Walkthroughs row: `id: 'walkthroughs'`, `group: 'collaborate'`, published with `usePublishToolsItems('walkthroughs',
rows)` only while `menu.available`; its aside is a brand `CountBadge` of the list's length (none at 0), never in
attention. Its `view` draws `WalkthroughsPanel` (`bare`, no heading of its own) inside Tools; playing or recording closes Tools.
The rows array is memoised on `available`, `canRecord` and the count, so a recording's ticks never republish it: the
view reads the latest menu from a small store the row keeps (`useLatest`), not from the closure.

FM6. The drill-in. `ChromeToolsMenu` holds `view: id | null`. With a view, the popover body is `ToolsView`: `BackBar`
(`label="Tools"`, `current={label}`, `data-tools-back`) beside the compact close, then the tool. The popover's name reads
"Tools, <label>"; a polite live region (`data-tools-live`) says "<label>" on the way in and "Tools" on the way out.
Focus goes to the back bar unless the tool took it; going back focuses `[data-tools-item={id}]`.

- **Dialogs in place.** An `inPlace` press opens the dialog slot (`openDialogSlot()`, `@liveworkspace/ui`) before
  `onSelect`. The first `Dialog` that opens after it while it is unclaimed (it records the slot's `seq` the render it
  opens) claims it and renders into the slot's node (a portal), not as a modal: no backdrop, focus trap, Escape
  listener or phone sheet of its own, its `className` and `size` dropped. Inside it, `useDialogInline()` is true, so
  `DialogHeader` and `HeroDialogHeader` draw their title `sr-only` and their line and actions in a slim row, and
  `DialogCloseButton` draws nothing. Dialogs opened inside it are modals as ever (the context resets). The claim
  publishes `{ size, close(), escape() }`: the back bar and Escape go through the dialog's own dismissal (`beforeClose`,
  `closeOnEscape`, then its `onClose`), and the dialog closing itself releases the slot, which returns Tools to the list.
- **Width.** `TOOLS_WIDTH_PX` (480), or the claimed dialog's own width (`lg` 544, `xl` 576, `2xl` 640, `3xl` 760), or a
  `view` row's `wide` (760). A `3xl` dialog's slot is `h-[min(44rem,calc(100dvh-6rem))]`.
- **Layers.** While a view shows, the popover sits at `--z-modal` (`AnchoredPopover`/`PopoverOrSheet` `layer="modal"`),
  so a dialog the tool opens (also `--z-modal`, later in the page) and its menus (`--z-popover`) draw over it; a press in
  `[data-dialog-backdrop]`, `[data-anchored-popover]`, `[role="menu"]` or `[role="listbox"]` is not outside it
  (`keepOpenWithin`). Escape yields to an open modal dialog (`passEscape`: a `[data-dialog-panel]` in the page).
- **Waiting.** Until a dialog claims the slot, `LoadingSweep`; with nothing after 10s, back to the list.

FM7. `requestToolsView(id)` (tools-door.ts) holds one request for 20s: Tools, once it lists `id`, opens at it as if its
row were pressed. The liveplanner hosts ask it on a sign-in return (`useAskedOpen`) rather than opening a modal.

FM8. Retired (owner, 2026-11-17): Clear Example Content left Tools; the palette's example tray alone offers it.

FM9. History with Snapshots in it (owner, 2026-11-17). `useItemToolsRows({ app, history, signedIn, offline, onWebhooks,
snapshots })`, `snapshots` being the app's `useHistorySnapshotsHost()` (`{ useExtras, Alone }` or null; blueprint
SN22), and Version History read from `useItemVersions()` (published by livedocuments' `useVersionHistoryInTools`).
`historyMode({ timeline, snapshots, gated, versions })` picks, in order: `timeline` (a history host and not gated),
`snapshots` (a door), `gate` (signed out or This Browser), `versions`, else no row. The row: `id: 'item-history'`,
label History, line "Snapshots, and who changed what." with snapshots, else "Who changed what, and when."; `inPlace`
but in `versions` mode; badges only in `gate` mode.

- `timeline`: `ItemHistoryDialog extras={{ top, pins }}`: `top` is the snapshots' take form (and Open Version
  History), `pins` the snapshots (`{ key, at, render(last) }`), merged into the days by `pinHistory` (explorer
  history.ts: by `dateKey(at)`, a day made for a pin alone, a sort only on a day holding a pin). Pins show under All
  only. A day's count reads "N events · M snapshots".
- `snapshots`: `Alone` (`SnapshotsDialog`) with `after`: the account line signed out, Open Version History.
- `gate`: the sign-in or sync gate, with Open Version History under it.
- Open Version History calls `leaveToolsWithDialog()` (dialog-slot.ts) then closes its dialog and opens Version
  History: the slot's `leaving` flag tells Tools to close rather than go back.
- A row's in-place confirm carries `data-keeps-escape`; Tools leaves Escape to it while focus is inside one.

FM10. The item's gate for other tools (owner, 2026-11-17). While `useItemToolsRows` is gated (signed out, or the item in
This Browser) it publishes `{ badges, open(tool) }` through `usePublishToolGate` (tools-door.ts). `WalkthroughsTools`
reads `useToolGate()`: with no walkthroughs available and a gate set, it publishes its row badged with `gate.badges`,
`inPlace`, its press `gate.open('walkthroughs')`, which shows the item rows' `SignInDialog` for Walkthroughs. A sync
that passes asks `requestToolsView('walkthroughs')` (FM7), so Tools opens at the real row once it publishes.

FM11. History's avatars (owner, 2026-11-17). Every entry's disc (`PersonAvatar`, packages/explorer HistoryParts.tsx)
asks the people store for its actor's picture, the reader's own included, so your entries wear your avatar: your
picture, else your initials on the brand. Others keep their picture or initials on their colour; someone unnamed or a
closed account the grey person glyph.
