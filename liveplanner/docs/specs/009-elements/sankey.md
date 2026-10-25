# Sankey diagram

A Sankey diagram shows **how much moves where**. Nodes stand in columns, and a band joins two nodes for
every flow between them, **as wide as the amount it carries**. Where a quantity splits, merges, or leaks
away, a reader sees it at a glance: the wide bands are where most of it goes. It is named after Captain
Matthew Sankey, whose 1898 drawing of a steam engine's energy losses made it famous, and it is the
standard picture for energy balances, budgets (income into spending), material and supply flows, website
journeys and conversion funnels, and migration between places.

It is one element in the palette's **Build** category: a diagram that lays itself out from a list of
flows, so nobody has to position a band by hand.

## What someone does with it

1. **Drop it.** Concepts → **Sankey**: tap to drop or drag to size. It arrives as a real diagram, a household
   budget (two incomes into a budget, split into needs, wants and savings, needs split into rent and
   groceries), so the idea explains itself and every part is there to overwrite.
2. **Read it.** Hover a band: it lifts, the rest fade back, and a readout says `Salary → Budget`,
   `3,200 · 80% of Salary`. Hover a node: every band touching it lifts, and the readout says what arrives
   and what leaves (`In 4,000 · Out 4,000`), and, quietly, any difference between them
   (`200 not sent on`), since a middle node that loses some of its input is usually a typo.
3. **Edit the flows.** Double-click the diagram, or **Edit Flows** in its menu (Sankey → Flows), to open the **Flows**
   dialog. Its flows read as the diagram does, step by step: under each node, where it sends and how
   much. Names autocomplete from the nodes the diagram already has. The diagram behind and the preview in
   the dialog redraw as you type.
4. **Or type them.** The dialog's **Text** tab holds the same flows as lines, `Salary [3200] Budget`
   (the SankeyMATIC form, so a diagram from there pastes straight in), and also reads
   `Salary -> Budget: 3200` and spreadsheet rows (`Salary, Budget, 3200` or tab-separated, a header row
   skipped). Pasting a column of rows from a spreadsheet just works. **Import CSV** reads a file the
   same way.
5. **Style it.** From the menu: the nodes' colours, how bands are coloured, how the columns align, what
   the labels say, the unit, the text size, a palette, and an animation (below).

## How it draws

- **Columns.** A node's column is its step from a start node (the longest path to it). By default end
  nodes, those with nothing leaving them, all stand in the last column (**Ends Right**), so every
  outcome lines up on the right; **By Step** leaves each at its own step instead.
- **Heights.** One scale for the whole diagram, the largest at which the fullest column fits the box. A
  node is as tall as the larger of what enters and what leaves it; a band is as thick as its amount, and
  never thinner than 1px, so a tiny flow beside a huge one is still visible.
- **Order.** Each column starts stacked in the order its nodes were first written, then six sweeps each
  way draw every node toward the height at which each of its bands would run level, measured from where
  that band actually leaves (or reaches) the node at its other end, weighted by amount and by how many
  columns the band spans; overlaps are pushed apart after each column. Siblings that leave one node pull
  to different heights, so they keep their order and the bands cross as little as the columns allow
  (the starter budget draws with none). A node's bands stack in the order of the
  nodes at their other end. The same flows in the same box always draw the same diagram.
- **Bands** curve at the horizontal middle between their nodes. Coloured by **Blend** (a gradient from
  the source node's colour to the target's; the default), **From** (the source's colour, best for "where
  does each income go"), **To** (the target's, best for "where did each cost come from") or **Grey**
  (one quiet colour, when the nodes carry the meaning). At rest they are translucent so overlaps read.
- **Node colours** take the chart colour ladder ([Data charts](pie-chart.md#chart-palettes)): a node's own
  colour, then the diagram's palette, then the tab theme's ramp, then the built-in one, by first
  appearance. So a new diagram matches the theme, and a node somebody recoloured keeps its colour.
- **Labels** face inward: a node left of the middle labels to its right, the rest to their left, so no
  label runs off the box. Each is the node's name over its **Amount** (`£3,200`), its **Percent** of
  everything entering the diagram, or nothing (**Names Only**). A node too short for two lines puts the
  amount beside the name instead. Labels are in the theme's text colour with a soft halo (white behind
  dark ink, deep slate behind light ink), so they read over the bands.
- **Crowding.** Labels never print through each other. Largest node first, a label that would cover one
  already placed puts its amount on the name's line, then drops the amount, and otherwise is not drawn;
  the node's hover readout still names it. Widths are estimated from the characters, the same on the
  canvas and in an export.
- **Unit.** An optional unit of up to 8 characters. A currency mark (`$ £ € ¥ ₹ …`) is written before
  the amount (`£1,200`); anything else after it (`1,200 kWh`).
- **Amounts** are written with thousands grouped and at most two decimals, the same characters on
  every machine whatever its locale.
- **No flows** draws a quiet dashed outline with "No flows yet" (for an Editor, "Double-click to add
  flows"), never an empty box that looks broken.

## Leftovers

A middle node that sends on less than it receives (a budget of 1,000 spending 800) keeps the rest. By
default the diagram draws it: a **leftover** band from the node to an end node named **Leftover**, as wide
as the difference, so every node's height is accounted for. Leftovers are never stored as flows: they are
worked out as the diagram is drawn, so they follow the amounts as they change.

- **Quiet.** A leftover band, and the Leftover node, are the neutral band grey whatever the band
  colouring, so they read as the remainder, not a destination someone chose. Its hover readout says
  `Budget → Leftover`, `200 not sent on`. If somebody writes a node named `Leftover` themselves, the
  leftovers join it, in its own colour.
- **For the whole diagram.** Sankey → **Leftovers**: **Show** (the default) or **Hide**. While shown,
  **Leftover Name** renames the node they run to (up to 60 characters; blank is `Leftover`).
- **For one node.** In the Flows dialog, each node that keeps some back shows its leftover as the last
  line of its group, with a switch: off, that node draws no leftover (its node is still as tall as what
  it receives). Stored as `leftover: false` on the node's row in `sankeyNodes`, so a rename carries it.
- **Not for overspending.** A node that sends on more than it receives has no leftover; that is the
  mistake the balance notes point out.
- Leftovers are drawn after the stored flows, so past the 200-flow limit they are the ones set aside.

## Flows that cannot be drawn

A flow is **set aside**, never silently dropped: the diagram draws the rest, and the Flows dialog marks
the row and says why.

| Flow                                     | Why it is set aside                                     | What the row says                              |
| ---------------------------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| A From or To left blank                  | It has nowhere to start or end                          | Needs a From and a To                          |
| From and To the same                     | A node cannot flow into itself                          | Flows into itself                              |
| Amount zero, negative or not a number    | A band cannot be zero or less wide                      | Needs an amount above zero                     |
| It closes a loop (A → B → A)             | Columns run one way; a flow back has no column to go to | Loops back to an earlier node, so it is hidden |
| Past 200 flows, or a node past 120 nodes | Past that a Sankey is unreadable, and layout cost grows | Over the limit                                 |

Of a loop, it is the flow that **closes** it that is set aside (found by walking the flows in order), so
every flow written before it keeps drawing. Names are matched after trimming and collapsing spaces, so
`Budget ` and `Budget` are one node; case is kept, so `budget` is another.

## The menu

The element's menu holds one **Sankey** category beside the usual others: a row that opens its sections in a
side flyout (`MenuFlyoutSection`), so the menu stays short however much a Sankey offers. Its sections, each
closed until opened as everywhere ([menus](../004-interface-design/menus.md)), are **Flows**, **Bands**,
**Layout**, **Labels**, **Leftovers** and **Text**, each with its own icon.

- **Flows**: a summary line (`7 flows · 8 nodes`, plus `· 1 hidden` when any are set aside)
  over an **Edit Flows** button, then the **Nodes**, each a colour swatch (the
  [colour picker](../004-interface-design/colour-picker.md) in a popover, led by **Palette** once the
  node has a colour of its own, which hands it back) and its name.
- **Bands** (Blend / From / To / Grey), **Layout** (Ends Right / By Step), **Labels** (Amount / Percent /
  Names Only) and **Leftovers** (Show / Hide): each an option list, the Plan mode picker (`OptionRows`): a
  bordered box, one choice to a row, a glyph drawing it at the left, the chosen row tinted with a tick.
  **Leftovers** also holds **Leftover Name** while they show.
- **Text**: **Unit**, and **Text Size** (the [Text Size](../004-interface-design/fonts.md#text-size) slider without Scale: a px is the labels' own; the presets earlier Sankeys carry read 10 / 12 / 15px). Unit and Leftover
  Name are short text fields committed on Enter or blur.
- **Presets** holds the chart palettes ([Data charts](pie-chart.md#chart-palettes)), as a chart's does.
- **Animation**: **None**, **Grow** (bands sweep in from the left, once), **Flow** (a soft current
  runs along every band, looping), **Cascade** (the columns come in one after another, sliding a little
  from the left, once), **Pulse** (a slow wave dims and restores the bands, left to right, looping) and
  **Rise** (each column's nodes grow from their middles, then their bands and labels fade in, once), with
  **Speed** and **Repeat** as on the other data elements. Cascade, Pulse and Rise run column by column,
  each part delayed by its column. All stop under reduced motion.
- The **Colours** and **Border** categories are hidden: a Sankey colours per node, not as one filled box.
  Like a chart, it is borderless and fills nothing.

## The Flows dialog

- Opened by double-clicking the diagram or **Edit Flows**. Two tabs, **Table** and **Text**, the table
  first, with **Import CSV** beside them.
- **Nodes** run along the top as chips in their colours. Click one to rename it everywhere at once, every
  flow and its colour in one step; typing an existing name merges the two nodes. Escape cancels the
  rename, not the dialog.
- **Table**: the flows grouped as the diagram reads, left to right, so the table never becomes one flat
  list. A **step** per column of the diagram (a node's longest path from a start, as By Step draws it)
  that some node sends from, headed `Step 1`, `Step 2`, and so on; a node that only ends makes no step of
  its own. In a step, a **group** per node that sends something: its colour and name, `In … · Out …` (amber
  when they differ and no leftover accounts for it), then a row per flow out of it, **→ To** and
  **Amount**, with a remove button. A row whose To sends nothing on yet has a **+** (Send On From …) that
  adds a flow from it, one step to the right. Under the rows, **Add a Flow From <node>**, a full-width
  dashed row lined up under the To and Amount boxes, adds another flow from that node with the cursor in
  its To. Then the node's leftover line, while it has one ([Leftovers](#leftovers)).
- **Add a Flow**: a dashed area after the last step that always holds one blank line, **From**, **To**,
  **Amount**, the way a spreadsheet keeps an empty row at the bottom: filling it in opens another under
  it. It counts the flows (`7 of 200`). The words under its title say what goes there.
- **Nothing jumps mid-edit.** The groups hold still while the cursor is in the table: a row being written
  in Add a Flow stays there, and a row edited inside a group stays in its group, until the cursor leaves
  the table, or a row is added, removed or pasted. Then everything moves to its step.
- A row that is set aside is outlined in amber with its reason beneath it, and its cells say so to a
  screen reader. From and To suggest the node names already typed. Enter moves through a row's cells,
  then to the next row shown, ending in the Add a Flow line.
- **Pasting** several lines (or a tab-separated row) into any cell turns each line into a row, read as
  the Text tab reads them: a blank row is replaced, otherwise the rows go in after it.
- Under the rows, **balance notes** list each middle node whose in and out differ
  (`Needs receives 2,000 and sends 2,100`), since that is the commonest mistake in a hand-made Sankey.
  While leftovers show, a node keeping some back is drawn, not a mistake, so only one sending on more than
  it receives is listed.
- **Text**: the flows as lines, edited in place; lines it cannot read are named (`Line 4 was not read.`), as is any line past 1,000 characters,
  and nothing else is lost. Switching tabs carries the flows across.
- **Import CSV** (both tabs) reads a `.csv`, `.tsv` or `.txt` file into the flows, replacing them, and
  says how many it read and how many lines it could not.
- A **preview** of the diagram sits beside the rows on a wide screen (above them on a narrow one), drawn
  on white whatever the appearance, and redrawn from the draft as you type, so the effect of an edit is
  seen before it is stored. It answers hover like the canvas.
- **Show Me** and **Help** (the labelled link, to the Sankey Diagram article) head the dialog, left of its
  close cross ([Show Me](#show-me)).
- Every change is stored as one undo step (a cell on blur, a structural change at once), as the chart data
  dialog does; a store that would change nothing (tabbing through cells) is skipped. A row left wholly
  blank is not stored. **Done** closes it.

## Show Me

The Flows dialog is a [Show Me](../007-editor/show-me.md) surface: its **Show Me** button runs a guided tour of
writing flows over the dialog, never offered on its own. Each step rings a real control, which stays usable:
**Your Nodes** (the node strip) and **Flows, Step by Step** (the steps, the Table brought forward), both left out
while there are no flows, **Add a Flow** (the Add a Flow area), **In and Out Differ** (the balance notes, only
while they show), **Or Type Them** (the Text tab, brought forward and put back to the Table on leaving the step),
**Import a File** (Import CSV) and **Live Preview** (the preview), then a closing card, **That Is the Flows
Dialog**, linking the Sankey Diagram article. Each step is a line or two: what the control does, nothing more. The steps are fixed when it is pressed.
While it runs, Escape is the tour's and never closes the dialog. Only an Editor opens the dialog, so only an Editor
sees Show Me. Telemetry: `UI` · `Started` · `SankeyFlowsTour`, and `UI` · `Ended` · `SankeyFlowsTourCompleted` or
`SankeyFlowsTourSkipped`.

## Element tour

Removed from liveplanner with the element tours ([Element tours](../007-editor/element-tours.md)): no Plan tab
places this element. The Sankey tour was offered from a small **Show Me** toolbar beside the first one a person
selected; in livediagram an element's tour is now started from the footer's Start Tour button while the element
is selected, never from a toolbar beside it. The Flows dialog's own [Show Me](#show-me) is unchanged.

## Who may do what

| Role        | May                                                                    |
| ----------- | ---------------------------------------------------------------------- |
| Editor      | Everything: add one, edit flows, restyle, and read it                  |
| Participant | Read it (hover readouts); no menu, no Flows dialog, double-click inert |
| Viewer      | Read it (hover readouts); no menu, no Flows dialog, double-click inert |

Editing a Sankey reshapes the board, which a Participant never does. The editor gate is
`canEditSankey(can, el)`: an Editor's session (`can.level === 'edit'`) on an unlocked diagram, checked by
the double-click, the menu section and the dialog, not `isReadOnly` alone. The server gate is the ordinary
element write, which a Participant's `applyParticipantOp` refuses for every `sankey*` field, since none is
in its writable lists.

## Model

A `ShapeKind` (`'sankey'`), self-drawing (no centred label; its labels are the node names), with these
fields on `ShapeElement`, each bounded in `validate-shape.ts`:

| Field                                               | Type                                                                 | Default      |
| --------------------------------------------------- | -------------------------------------------------------------------- | ------------ |
| `sankeyFlows`                                       | `{ from: string; to: string; value: number }[]`                      | the budget   |
| `sankeyNodes`                                       | `{ name: string; color?: string; leftover?: false }[]`               | none         |
| `sankeyLinkColor`                                   | `'gradient' \| 'source' \| 'target' \| 'neutral'`                    | `'gradient'` |
| `sankeyAlign`                                       | `'justify' \| 'left'`                                                | `'justify'`  |
| `sankeyValueLabel`                                  | `'value' \| 'percent' \| 'none'`                                     | `'value'`    |
| `sankeyUnit`                                        | string, up to 8 characters                                           | none         |
| `sankeyLeftover`                                    | `'show' \| 'hide'`                                                   | `'show'`     |
| `sankeyLeftoverName`                                | string, up to 60 characters                                          | `Leftover`   |
| `sankeyAnim`, `sankeyAnimSpeed`, `sankeyAnimRepeat` | `'grow' \| 'flow' \| 'cascade' \| 'pulse' \| 'rise'`, speed, boolean | none         |

It also reads the shared `chartPalette` and `textSize`. Flows are stored by node **name**, not by id:
that is how people write them, how SankeyMATIC and every spreadsheet holds them, and how an agent
authors them, and a rename in the dialog renames every flow and the node's colour row with it.

## Everywhere else it appears

- **Export and thumbnails** draw the same diagram from the same layout (gradients included), without
  the hover or the motion.
- **Agents** (MCP and the REST element format) author it with `sankeyFlows` and the options above; the
  text views summarise it as `flows=N`.
- **Telemetry**: `track('Element', 'Added', 'Sankey')` on create; `track('Element', 'Changed', 'SankeyFlows'
| 'SankeyStyle' | 'SankeyAnim')` on edits.
- **Help**: a Sankey Diagram article under Build Elements.
