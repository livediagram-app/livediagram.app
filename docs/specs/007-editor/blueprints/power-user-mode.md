# Power user mode: blueprint

Derived from [Power user mode](../power-user-mode.md), the [role pill](../live-app.md#role-pill) in Live app, the
selection toolbar rules in [Canvas and palette](../../008-canvas/canvas-and-palette.md#selection-popover), and the
preference model in [User preferences](../user-preferences.md). Hints follow
[Tooltips, hover cards and popovers](../../004-interface-design/tooltips-hover-cards-popovers.md). The spec decides; this
file only adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                                         | Role                                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/live/lib/power-user-mode.ts`                                                           | Pure: the preset, switch on / off with baseline and restore, the flags           |
| `apps/live/lib/power-user-offer.ts`                                                          | Pure: offer counters, thresholds, eligibility; device-local storage              |
| `apps/live/hooks/ui/usePowerUserOffer.ts`                                                    | Records sessions and shortcuts, shows the offer, applies the answer              |
| `apps/live/components/providers/minimal-chrome.tsx`                                          | `MinimalChromeProvider`, `useMinimalChrome()`: the one flag                      |
| `packages/ui/src/appearance/appearance-cycle.ts`                                             | Pure: `oppositeAppearanceSetting`, `quickAppearanceToggleName`                   |
| `apps/live/components/chrome/AppearanceToggle.tsx`                                           | Quick appearance switch: click flips, right-click sets System                    |
| `apps/live/hooks/ui/useAppearance.ts`                                                        | Logs and tracks every explicit pick                                              |
| `apps/live/app/explorer/ExplorerShell.tsx`                                                   | Passes `powerUser` to its bottom bar                                             |
| `apps/live/components/chrome/ChromeControls.tsx`                                             | `TabBar` and the Explorer pass `powerUser` through to the toggle                 |
| `apps/live/components/chrome/RoleIndicator.tsx`                                              | `RolePill` (title bar) and `RoleStatusIcon` (status bar)                         |
| `apps/live/app/document/[id]/useViewPreview.ts`                                              | `viewPreview`, `canToggleRole`, `toggleViewPreview`                              |
| `apps/live/app/document/[id]/useRoleIndicator.ts`                                            | Role in force, owner name and toggle, for the pill and the icon                  |
| `apps/live/app/document/[id]/useEditorState.ts`                                              | `isReadOnly` includes the preview; wires the offer and the shortcut count        |
| `apps/live/hooks/persistence/useEditorPreferences.ts`                                        | `prefsSettled`: the server copy merged, or failed to arrive                      |
| `apps/live/app/document/[id]/EditorView.tsx`                                                 | Provides the flag; places the pill / icon; gates the notices                     |
| `apps/live/components/chrome/EditorHeader.tsx`                                               | `rolePill` slot after the visibility badge                                       |
| `apps/live/components/chrome/TopCenterChrome.tsx`                                            | The visitor owner / role badge is removed                                        |
| `apps/live/components/chrome/TabBar.tsx`                                                     | `roleIcon` slot first; "Tabs" label and control labels under the flag            |
| `apps/live/components/palette/PaletteIconButton.tsx`                                         | Icon-only tile with a Tooltip under the flag                                     |
| `apps/live/components/primitives/MovablePanelHeader.tsx`                                     | Title visually hidden, `?` removed under the flag                                |
| `apps/live/components/primitives/MovablePanel.tsx`                                           | Same, for the popover header                                                     |
| `apps/live/components/panels/ExplorerHeaderMenu.tsx`                                         | Help row under the flag                                                          |
| `apps/live/components/primitives/HelpArticleLink.tsx`                                        | `openHelpArticle`: the `?` link's telemetry, from a menu row                     |
| `apps/live/components/panels/Explorer.tsx`                                                   | Sign-in / "saved to this browser" notice gated on the flag                       |
| `apps/live/components/canvas/SelectionPopover.tsx`                                           | More on touch only; caption and desktop bin under the flag; toolbar name         |
| `apps/live/components/canvas/MultiSelectionToolbar.tsx`                                      | More on touch only; desktop bin under the flag                                   |
| `apps/live/components/chrome/FloatingToolbar.tsx`                                            | Caption under the flag; toolbar name                                             |
| `apps/live/components/dialogs/settings/settings-catalogue.ts`                                | The rows, `parent`, the `presetSummary` kind; `SettingsRowContext.powerUserMode` |
| `apps/live/components/dialogs/settings/SettingsCategoryPane.tsx`                             | Nests a row's children under it as a named group; `onGoToRow`                    |
| `apps/live/components/dialogs/settings/SettingsPresetSummaryRow.tsx`                         | The "Set By Power User Mode" readout                                             |
| `apps/live/components/dialogs/settings/power-user-preset-rows.ts`                            | Pure: preset lines, current value, changed or not, where each row lives          |
| `apps/live/components/dialogs/SettingsDialog.tsx`                                            | Computes `powerUserMode` for the row context                                     |
| `apps/live/hooks/canvas/useEditorKeyboardShortcuts.ts`                                       | `onShortcutUsed` after a key the handler claimed                                 |
| `apps/live/hooks/ui/useToast.tsx`                                                            | `toast.offer`: an info toast with two actions and no timeout                     |
| `apps/telemetry/app/catalogue/settings.ts`, `visitors.ts`, `features.ts`                     | Charts for the new events; the offer is a Visitors stack                         |
| `apps/telemetry/app/event-explanations.ts`                                                   | A sentence per new event                                                         |
| `apps/live/lib/telemetry-manifest.ts`                                                        | `UI·Declined` joins the emitted pairs                                            |
| `apps/help/lib/featureIcons.tsx`, `featureColours.ts`, `packages/help-registry/src/index.ts` | The article card and its registry entry                                          |
| `apps/help/app/user-interface/power-user-mode/page.mdx`                                      | The help article, registered per the instruction set                             |

## Domain and naming

One term, one identifier. The left column is the only spelling used in code, tests, copy and logs.

| Term             | Identifier                                               | Meaning                                                        |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Power user mode  | `powerUserMode` (preference), `isPowerUserMode`          | The preference; on / off                                       |
| Preset           | `POWER_USER_PRESET`                                      | Per preset setting, the values switching on writes             |
| Preset setting   | `PowerUserPresetSetting` (key of the preset)             | One setting, possibly several keys                             |
| Baseline         | `powerUserBaseline`, `PowerUserBaselineEntry`            | Per preset setting: `before` and `applied`                     |
| Switch on / off  | `setPowerUserMode(prefs, on)`                            | Pure; returns the next preferences and what it restored / kept |
| Untouched        | `isUntouched(prefs, entry)`                              | Every key in `applied` still equals its current value          |
| Minimal chrome   | `minimalChrome` (preference), `isMinimalChrome(prefs)`   | The flag in force: mode on and `minimalChrome !== false`       |
| The one flag     | `useMinimalChrome()`, `MinimalChromeProvider`            | How a surface reads it                                         |
| Offer            | `PowerUserOffer` (telemetry type), `powerUserOfferShown` | The once-ever toast                                            |
| Offer counters   | `OfferCounters` `{ days, lastDay, shortcuts }`           | Device-local usage counts                                      |
| Editing session  | `recordEditingSession(counters, day)`                    | An editable document opened; counts once per `day`             |
| Day              | `localDayKey(date)`                                      | `YYYY-MM-DD` in local time (D3)                                |
| Shortcut used    | `recordShortcut(counters)`, `onShortcutUsed`             | A key the editor shortcut handler claimed (D4)                 |
| Role pill        | `RolePill`                                               | Title-bar pill: Editing / Viewing, owner in its Tooltip        |
| Role status icon | `RoleStatusIcon`                                         | Minimal chrome's pencil / eye, first in the status bar         |
| View preview     | `viewPreview`, `setViewPreview`                          | Local read-only preview for someone who may edit               |
| Touch device     | `useCoarsePointer()` (`(hover: none)`)                   | Keeps More and the bin                                         |
| Quick switch     | `oppositeAppearanceSetting(appearance)`                  | The explicit setting opposite the painted appearance           |

Banned: "pro mode", "expert mode", "compact chrome", "clean mode"; "badge" for the role pill.

## Behaviour and state

### Preset

```ts
const POWER_USER_PRESET = {
  alignmentGuides: { alignmentGuides: true },
  autoRebindArrows: { autoRebindArrows: true },
  tourSeen: { tourSeen: true },
  planTourSeen: { planTourSeen: true },
  aiSuggestedPrompts: { aiSuggestedPrompts: false },
  minimalChrome: { minimalChrome: true },
} as const satisfies Record<string, Partial<UserPreferences>>;
```

### Switching

`setPowerUserMode(prefs, on): { prefs; restored: string[]; kept: string[] }`, pure. The lists name baseline entries, which may include a setting a newer client added, so they are strings.

| #   | From | Event | Guard                         | Effect                                                                                                          |
| --- | ---- | ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| P1  | off  | on    |                               | per setting: `before = pick(prefs, keys(applied))`; write `applied`; `powerUserMode: true`; store baseline      |
| P2  | on   | on    |                               | no change (same object back)                                                                                    |
| P3  | on   | off   | baseline entry untouched      | restore: each key in `applied` set to `before[key]`, or deleted when absent from `before`; listed in `restored` |
| P4  | on   | off   | baseline entry touched        | leave the current values; listed in `kept`                                                                      |
| P5  | on   | off   | after P3 / P4 for every entry | delete `powerUserBaseline`, delete `powerUserMode` (off is the default)                                         |
| P6  | off  | off   |                               | no change                                                                                                       |
| P7  | on   | off   | no baseline (another client)  | only P5: nothing to restore                                                                                     |

Value equality is `Object.is` per key (all preset values are primitives). `before` is built with only the keys present
in `prefs`, so JSON round-trips it faithfully: an absent key stays absent.

### Minimal chrome flag

`isMinimalChrome(prefs) = prefs.powerUserMode === true && prefs.minimalChrome !== false`. `EditorView` wraps its tree
in `MinimalChromeProvider value={isMinimalChrome(userPreferences)}`; `useMinimalChrome()` defaults to `false` outside a
provider, so the Explorer page and `/new` are unaffected.

- Panel help under the flag: `MovablePanelHeader` and the popover header in `MovablePanel` render no
  `HelpArticleLink`. Only a panel that already has a `⋯` menu gets a Help row (`ExplorerHeaderMenu`); no menu is created
  to hold one. The help centre stays in the header's ProductNav (**Editor**) menu.
- `EmptyCanvasBanner` does not read the flag: it holds actions, so it stays.

### Offer

`OfferCounters` in `localStorage` under `livediagram:power-user-offer:v1`.

| #   | Event                                  | Guard                                                                 | Effect                                                                     |
| --- | -------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| O1  | preferences settled, document editable | once per page load                                                    | `recordEditingSession(c, localDayKey(now))`; persist; evaluate             |
| O2  | `onShortcutUsed`                       |                                                                       | `recordShortcut(c)`; persist; evaluate                                     |
| O3  | evaluate                               | `offerDue(c)` and `offerEligible(prefs, ctx)` and not shown this page | show the toast; write `powerUserOfferShown: true` (synced); `Opened`       |
| O4  | "Try power user mode"                  |                                                                       | `setPowerUserMode(prefs, true)`; write; `Used` + `Toggled PowerUserModeOn` |
| O5  | "No thanks" or close                   |                                                                       | `Declined`; nothing else                                                   |

- `recordEditingSession`: if `day === lastDay`, unchanged; else `days + 1`, `lastDay = day`.
- `offerDue(c) = c.days >= POWER_USER_OFFER_DAYS || c.shortcuts >= POWER_USER_OFFER_SHORTCUTS`.
- `offerEligible(prefs, { editable, embed, zen })`: `!powerUserMode && !powerUserOfferShown && notificationsEnabled !==
false && editable && !embed && !zen`.
- Counting continues after the offer (cheap, harmless); it simply never shows again.
- Nothing is recorded or offered before `prefsSettled`: until the server copy has merged, a latch set on another
  device could still read as unset.
- The hook syncs its deps into a ref in an effect declared before the session effect, so that effect and later
  events read the committed render.

### View preview and the role pill

- `viewPreview: boolean` in `useEditorState`, initial `false`, never persisted (spec: a reload returns to Editing).
- `isReadOnly = sessionRole === 'view' || viewPreview`; everything downstream (`isStructureReadOnly`, `editsBlocked`,
  the palette, the toolbars) already follows `isReadOnly`.
- `canToggleRole = sessionRole === 'edit'`: true for the owner and for an edit-link visitor alike, false for a
  view-link visitor. `toggleViewPreview()` flips it and deselects (a selection toolbar for an
  edit session must not linger into view mode).
- `sessionRole` itself is untouched: presence still reports the real role, so peers see no change.

`RolePill` props: `{ role: 'edit' | 'view'; ownerName: string | null; isSelf: boolean; onToggle?: () => void }`,
where `role` is the role in force (`isReadOnly ? 'view' : 'edit'`).

- Tooltip label `ownerName ? (isSelf ? 'Owned by you' : \`Owned by ${ownerName}\`) : ''`.
- With `onToggle`: a `<button>` with visible text, `aria-label` = `${Editing|Viewing}. ${tooltip}` (or just the role
  word without an owner), `aria-describedby` a visually hidden hint "Switch to viewing (read-only)" / "Switch to
  editing".
- Without: a `<span tabIndex={0}>` with the visible role word and the owner phrase as visually hidden text.

`RoleStatusIcon` props: `{ role; onToggle? }`: a 28px square, the status bar's control box (`ICON_BOX`: `CHROME_BTN` without its slate colour), pencil or eye glyph,
`aria-label` "Editing" / "Viewing (read-only)", Tooltip the same words, a button when `onToggle` is given.

### Selection toolbars

- `touch = useCoarsePointer()`. More renders when its handler is given **and** `touch`.
- Delete renders when its handler is given **and** (`touch` or `!minimal`).
- The caption renders when `!minimal`. The toolbar root carries `role="toolbar"` and `aria-label={title}` always.

### Quick appearance switch

`EditorView` (via `TabBar`) and `ExplorerShell` pass `powerUser={isPowerUserMode(prefs)}` to `ChromeControls`, which
hands it to `AppearanceToggle` as `quick`; both default to `false`, so any other host keeps the cycle:

| Mode | Gesture      | Setting before | Result                                                             |
| ---- | ------------ | -------------- | ------------------------------------------------------------------ |
| off  | click        | any            | `cycle()` (Light → Dark → System)                                  |
| off  | context menu | any            | browser default (no handler)                                       |
| on   | click        | any            | `set(oppositeAppearanceSetting(appearance))`, `appearance` painted |
| on   | context menu | not `system`   | `preventDefault()`, `set('system')`                                |
| on   | context menu | `system`       | `preventDefault()`, no write, no event                             |

The context menu gesture is the `contextmenu` event, which browsers fire for right-click, the Menu key, Shift+F10 and a
mapped long press, so one handler covers every input.

### Settings: the mode's children

- `RowBase.parent?: string`, the key of a row in the same category. `SettingsCategoryPane` renders, right after a row,
  every row in its list whose `parent` is that row's key, inside
  `<div role="group" aria-label="{parent label} settings">`, indented (`ml-3 border-l-2 pl-4`). A child whose
  parent is not in the list (a search result) renders at top level. DOM order is visual order.
- Children of `powerUserMode`, both `available: ctx.powerUserMode`: `minimalChrome` (toggle), then
  `powerUserPreset` (`kind: 'presetSummary'`).
- `presetSummaryLines(prefs, offered)` (pure) returns, for each preset setting except `minimalChrome`, in preset order:
  `{ setting, rowKey, categoryId, categoryLabel, label, value, restorable, changed, reachable }`. `value` is the row's own
  `read` formatted (toggle: On / Off; choice: the option label). `restorable` is whether a baseline entry exists (no status line without one). `changed` is true when the baseline entry exists and
  is not untouched (the same test switch-off uses, `isUntouched`). `reachable` is whether that row is in the
  visible categories (`offered`).
- `SettingsPresetSummaryRow` renders a card: a `<ul>` of lines, each `label: value`, the category, the status
  ("Changed: kept when you switch off" / "Restored when you switch off") and, when reachable, a `Change` button
  (`aria-label` "Change {label} in {category}") calling `onGoToRow(categoryId, rowKey)`.
- `SettingsDialog` keeps a `goTo` target in state: going to a row selects its category and passes the row as
  `focusRowKey`, so the existing `FocusRing` scrolls to it and rings it. A targeted open (`focus` prop) seeds it.

### Keyboard shortcut counting

Inside the main keydown listener: `const claimed = e.defaultPrevented` before dispatch; after dispatch,
`if (!claimed && e.defaultPrevented) live.onShortcutUsed?.()`. Every handled branch already calls `preventDefault`, so
this counts exactly the keys the editor acted on (D4). The mind-map Tab / Enter growth counts too.

## Interfaces and contracts

```ts
// lib/power-user-mode.ts
export type PowerUserPresetSetting = keyof typeof POWER_USER_PRESET;
export type PowerUserBaselineEntry = { before: Partial<UserPreferences>; applied: Partial<UserPreferences> };
export function isPowerUserMode(prefs: UserPreferences): boolean;
export function isMinimalChrome(prefs: UserPreferences): boolean;
export function setPowerUserMode(
  prefs: UserPreferences,
  on: boolean,
): { prefs: UserPreferences; restored: string[]; kept: string[] };

// lib/power-user-offer.ts
export type OfferCounters = { days: number; lastDay: string | null; shortcuts: number };
export const POWER_USER_OFFER_DAYS = 20;
export const POWER_USER_OFFER_SHORTCUTS = 50;
export function localDayKey(date: Date): string;
export function recordEditingSession(c: OfferCounters, day: string): OfferCounters;
export function recordShortcut(c: OfferCounters): OfferCounters;
export function offerDue(c: OfferCounters): boolean;
export function offerEligible(prefs: UserPreferences, ctx: { editable: boolean; embed: boolean; zen: boolean }): boolean;
export function readOfferCounters(): OfferCounters;
export function writeOfferCounters(c: OfferCounters): void;

// hooks/ui/useToast.tsx
type ToastOffer = { message: string; confirmLabel: string; declineLabel: string; onConfirm: () => void; onDecline: () => void };
toast.offer(offer: ToastOffer): void;
```

- The settings row for the mode is a normal `toggle` whose `write` is `(p, v) => setPowerUserMode(p, v).prefs`; the
  pane already tracks `Toggled` with the row's tokens.
- The Minimal chrome row has `available: (ctx) => ctx.powerUserMode`. `SettingsRowContext` gains `powerUserMode:
boolean`, computed by `SettingsDialog` from `isPowerUserMode(settings)` (so the row appears without reopening).

```ts
// packages/ui/src/appearance/appearance-cycle.ts
export function oppositeAppearanceSetting(appearance: Appearance): AppearanceSetting; // 'light' <-> 'dark'
export function quickAppearanceToggleName(
  setting: AppearanceSetting,
  appearance: Appearance,
): string;
// "Appearance: <setting>. Switch to <opposite>. Right-click to follow your device."
// apps/live/components/chrome/AppearanceToggle.tsx
export function AppearanceToggle(props: { labelled?: boolean; quick?: boolean }): JSX.Element;
```

- Rejections: `readOfferCounters` rejects a non-object, or any field of the wrong type, as malformed (see Errors).

## Data and persistence

| Field                 | Store                   | Class         | Lifetime                            |
| --------------------- | ----------------------- | ------------- | ----------------------------------- |
| `powerUserMode`       | synced preferences blob | user choice   | until switched off                  |
| `powerUserBaseline`   | synced preferences blob | derived state | while the mode is on                |
| `minimalChrome`       | synced preferences blob | user choice   | kept; ignored while the mode is off |
| `powerUserOfferShown` | synced preferences blob | one-way latch | forever                             |
| `OfferCounters`       | `localStorage` (device) | usage count   | forever, per device                 |
| `viewPreview`         | React state             | session       | this page load                      |

- No migration: every field is optional, and absent means the default. Unknown keys are preserved as ever.
- Size: the baseline holds at most 7 keys twice; well under 300 bytes of the 4 KB blob.
- Sign-up migration moves the whole preferences row, so the latch and the mode follow the account; counters stay on
  the device.

## Errors and edge cases

| Case                                                  | Handling                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Counters unreadable / malformed                       | Treated as zero; `console.warn('[power-user-offer] counters reset', raw)`         |
| `localStorage` unavailable (private window, quota)    | `writeLocalStorageSafe` swallows; counts live for the page only                   |
| Baseline missing while the mode is on (older client)  | P7: switch off only clears the flag                                               |
| Baseline entry with an unknown setting (newer client) | Restored by the same rule: it carries its own `before` and `applied`              |
| Mode switched on from another device mid-session      | The server merge on mount brings it; the flag follows `userPreferences`           |
| Offer due while a dialog is open                      | Shown anyway: a toast never takes focus                                           |
| Offer due on a view-only share                        | Not eligible; counting continues                                                  |
| The owner in view preview                             | Not editable, so no session is recorded for that moment; already recorded on load |
| View preview while text is being edited               | Toggle deselects first, which commits / closes the editor                         |
| Owner name unknown                                    | Pill without Tooltip; icon unaffected                                             |
| Touch device with Minimal chrome                      | Bin and More stay; captions still hidden                                          |

## Security and trust

- View preview is presentation only: it narrows what this client offers and never widens anything. The api still
  enforces the real role on every write.
- The preferences blob is the user's own; a crafted baseline can only write preference keys back into that same blob.
- Counters are device-local and carry no user content; the telemetry types are fixed tokens.

## Performance and limits

- `isMinimalChrome` is O(1) per render; the provider value is a boolean, so consumers re-render only on a flip.
- Shortcut counting is one `localStorage` read-modify-write per claimed key: ~0.05 ms, off the pointer path.
- The offer check is O(1).

## Presentation and UX

- Role pill: `rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`, the visibility badge's
  shape; emerald for Editing, amber for Viewing (the colours the old badge used); a toggle pill adds a hover ring and
  `cursor-pointer`.
- Role status icon: the status bar control box, emerald 700 / 300 glyph for Editing, amber 700 / 300 for Viewing.
- Panel headers: the button cluster carries `ml-auto`, so it stays at the right when the title is hidden.
- Palette tiles under the flag: `h-9 w-full`, so the icon stays centred in the cell the captioned tile filled; the
  Toolbar strip's fixed tiles and its always-visible shortcut letters are unchanged.
- Offer copy: message "Power user mode: fewer labels and a few faster defaults.", actions "Try power
  user mode" (primary) and "No thanks".
- Settings copy:
  - **Power User Mode**: "Applies a set of recommended settings for people who know their way around: alignment guides and auto-attach arrows on, the welcome and Plan tours marked as seen, and AI suggested prompts off.
    Change any of them afterwards and the mode stays on. Switching it off puts back the settings you did not change."
  - **Minimal Chrome**: "Hides labels and hints you no longer need: palette captions, panel titles, the selection
    caption, status bar text and onboarding notices. Every control stays; its name shows when you hover or focus it."
- Help row in the Explorer menu: the help glyph, label "Help".
- Appearance hover card under the mode: title unchanged, description the setting's sentence followed by "Click for
  <opposite>; right-click to follow your device." (on System: "Click for <opposite>.").

## Accessibility

- Hidden labels: each control keeps its `aria-label` (tiles, status bar controls, help, bin); the hint shows the words
  (tiles switch to `Tooltip`; status bar controls keep their hover cards, whose title is the name).
- Panel titles: `sr-only` span in place of the visible one; the header keeps its height from its buttons.
- Selection toolbar: `role="toolbar"`, `aria-label` the caption text.
- Role pill: WCAG 2.5.3 label-in-name holds (the accessible name starts with the visible word); 4.1.2 via button
  semantics and `aria-describedby`. Contrast: emerald 800 on emerald 100 and amber 800 on amber 100 (both above 4.5:1),
  and their dark counterparts, as the old badge.
- Offer toast: `role="status"`, actions are buttons, no time limit (2.2.1).

## Web Experience

- CLS: the flag comes from the preferences read at editor mount, before the chrome renders past the loading screen,
  so nothing re-lays after paint. Flips re-lay only in response to input (excluded from CLS).
- INP: a flip re-renders chrome consumers only.
- LCP: unaffected.

## Observability

| Decision / failure   | Log                                                             |
| -------------------- | --------------------------------------------------------------- |
| Mode switched on     | `console.info('[power-user] on', { applied: settings })`        |
| Mode switched off    | `console.info('[power-user] off', { restored, kept })`          |
| Offer shown          | `console.info('[power-user-offer] shown', { days, shortcuts })` |
| Offer answered       | `console.info('[power-user-offer] accepted'                     | 'declined')` |
| Counters malformed   | `console.warn('[power-user-offer] counters reset', raw)`        |
| View preview flipped | `console.info('[role] view preview', on)`                       |
| Appearance picked    | `console.info('[appearance] set', next)`                        |

## Testing

| Rule                                                      | Test                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| P1 preset applied, baseline stored                        | `lib/power-user-mode.test.ts`                                  |
| P2 / P6 idempotent                                        | same                                                           |
| P3 untouched restored, absent keys deleted                | same                                                           |
| P4 touched kept (incl. via the tour's layout write)       | same                                                           |
| Multi-key setting compared and restored together          | same                                                           |
| P7 no baseline                                            | same                                                           |
| JSON round-trip preserves restore semantics               | same                                                           |
| `isMinimalChrome` only while the mode is on               | same                                                           |
| Offer: days count once per day, thresholds 20 / 50        | `lib/power-user-offer.test.ts`                                 |
| Offer eligibility gates                                   | same                                                           |
| Malformed counters reset                                  | same                                                           |
| Settings: Minimal chrome row absent while off             | `settings-catalogue.test.ts`                                   |
| Settings: mode row writes the preset                      | same                                                           |
| Delete and Backspace delete the selection; count shortcut | `hooks/canvas/useEditorKeyboardShortcuts.dom.test.tsx` (jsdom) |
| Toggle for owner and edit link, none for view link        | `app/document/[id]/useViewPreview.test.tsx` (jsdom)            |
| Role pill: toggle vs static, names, Tooltip label         | `components/chrome/RoleIndicator.test.tsx` (jsdom)             |
| Toolbars: More touch-only, bin rule, caption, name        | `components/canvas/SelectionPopover.test.tsx` (jsdom)          |
| Toast offer: actions, no timeout                          | `hooks/ui/useToast.test.tsx` (jsdom)                           |
| Panels without `⋯` drop `?`; empty-canvas banner stays    | `e2e/power-user-mode.spec.ts` (dark mode)                      |
| Minimal chrome hides + tooltips, role icon toggles        | `e2e/power-user-mode.spec.ts` (dark mode)                      |
| Role pill toggles view preview for the owner              | same                                                           |
| Mode on / off with a changed and an untouched setting     | same                                                           |
| Opposite setting and quick name                           | `packages/ui/src/appearance/appearance-cycle.test.ts`          |
| Quick switch table (mode off / on, click / context menu)  | `components/chrome/AppearanceToggle.test.tsx` (jsdom)          |
| Quick switch in the real status bar                       | `e2e/power-user-mode.spec.ts` (dark mode)                      |

## Constants and configuration

| Constant                     | Value                             | Provenance               | Safe range |
| ---------------------------- | --------------------------------- | ------------------------ | ---------- |
| `POWER_USER_OFFER_DAYS`      | 20                                | Operator decision (spec) | 5..60      |
| `POWER_USER_OFFER_SHORTCUTS` | 50                                | Operator decision (spec) | 20..500    |
| `OFFER_COUNTERS_KEY`         | `livediagram:power-user-offer:v1` | House key scheme         | fixed      |
| `POWER_USER_PRESET`          | see Behaviour                     | Operator decision (spec) | fixed      |

## Defaults ledger

D3 to D9 in [DEFAULTS.md](DEFAULTS.md).
