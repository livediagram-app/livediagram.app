# The footer's Tools menu: blueprint

Derived from [footer-tools-menu.md](../footer-tools-menu.md). The spec decides; this file only adds engineering
precision. Paths are relative to the repository root.

| File                                                                        | Role                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/workbench/src/components/chrome/ChromeToolsMenu.tsx`              | `ChromeToolsMenu` (the button and its menu), `ChromeToolsItem`, `toolsDescription`          |
| `packages/suggestions/src/react/SuggestionsBar.tsx`                         | `useSuggestionsToolsItem(suggestions)`: the Suggest row and its panel                       |
| `packages/snapshots/src/ui/snapshots-tools-item.tsx`                        | `useSnapshotsToolsItem()`: the Snapshots row, null without a door                           |
| `liveplanner/apps/editor/components/automations/automations-tools-item.tsx` | `useAutomationsToolsItem()`: the Automations row, null without a door                       |
| `livedocuments/apps/editor/components/versions/history-tools-item.tsx`      | `historyToolsItem(onOpen)`: the History row                                                 |
| `packages/walkthrough/src/ui/WalkthroughsTools.tsx`                         | `WalkthroughsTools({ menu })`: the Walkthroughs row (door key `walkthroughs`) and its panel |
| `<product>/apps/<editor>/components/chrome/ChromeControls.tsx`              | builds the rows in the spec's order and draws `ChromeToolsMenu` left of Search              |

FM1. `ChromeToolsItem = { id, group, label, description, icon, onSelect(anchor), aside?, attention?, attentionLabel? }`.
`ChromeToolsMenu` takes `items` (nulls dropped) and `labelled`, and renders nothing with no items.

`group` is one of `TOOL_GROUPS` (`find`, `automate`, `collaborate`, `versions`, in that order), each rendered as a
`role="group"` under its heading (`data-tools-group`), empty groups left out.

FM2. The trigger: `CHROME_BTN` (+ `CHROME_BTN_LABELLED`), `ToolsGlyph`, label "Tools", `aria-label` "Tools" (with
", <attentionLabel>" for each item in attention), `aria-haspopup="dialog"`, `aria-expanded`, `data-tools-button`, no
HoverCard. An item in attention adds a dot (`data-tools-attention="amber" | "brand"`), amber when any item's is.

FM3. The popover: `AnchoredPopover` (`pointer`, `align="end"`, name "Tools", 480px), holding `HeroDialogHeader`
(`toolsHeroArt` from `@liveworkspace/ui/dialog-hero-art/tools`, its close) and the rows under `HERO_TOKEN_STYLE`, so
the plates paint in the band's tokens. Rows are buttons (`data-tools-item={id}`); a press closes the popover, then
calls `onSelect(toolsButton)`. Up and down move a row, Home and End to the ends.

FM4. The Automations card's aside is the on-count badge (`data-automations-count`), amber with a paused rule; a
paused rule sets `attention: 'amber'` with `attentionLabel` "a rule is paused".

FM5. The Walkthroughs row: `id: 'walkthroughs'`, `group: 'collaborate'`, published with `usePublishToolsItems('walkthroughs',
rows)` only while `menu.available`; its aside is a brand `CountBadge` of the list's length (none at 0), never in
attention. `onSelect(toolsButton)` opens `WalkthroughsPanel` in `PopoverOrSheet` (name "Walkthroughs", 360px, `align="end"`)
from that button. The rows array is memoised on `available`, `canRecord` and the count, so a recording's ticks never
republish it.
