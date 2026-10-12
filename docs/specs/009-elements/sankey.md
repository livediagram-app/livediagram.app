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

1. **Drop it.** Build → **Sankey**: tap to drop or drag to size. It arrives as a real diagram, a household
   budget (two incomes into a budget, split into needs, wants and savings, needs split into rent and
   groceries), so the idea explains itself and every part is there to overwrite.
2. **Read it.** Hover a band: it lifts, the rest fade back, and a readout says `Salary → Budget`,
   `3,200 · 80% of Salary`. Hover a node: every band touching it lifts, and the readout says what arrives
   and what leaves (`In 4,000 · Out 4,000`), and, quietly, any difference between them
   (`200 not sent on`), since a middle node that loses some of its input is usually a typo.
3. **Edit the flows.** Double-click the diagram, or **Edit Flows** in its menu, to open the **Flows**
   dialog. Each flow is a row: **From**, **To**, **Amount**. Names autocomplete from the nodes the
   diagram already has, so a second flow out of `Budget` is two keystrokes. The diagram behind and the
   preview in the dialog redraw as you type.
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
- **Order.** Each column starts stacked largest first, then every node is drawn toward the
  value-weighted middle of the nodes it connects to, a few sweeps each way, with overlaps pushed apart
  after each, so bands cross as little as the columns allow. A node's bands stack in the order of the
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
  amount beside the name instead. Labels are in the theme's text colour with a soft halo, so they read
  over the bands.
- **Unit.** An optional unit of up to 8 characters. A currency mark (`$ £ € ¥ ₹ …`) is written before
  the amount (`£1,200`); anything else after it (`1,200 kWh`).
- **Amounts** are written with thousands grouped and at most two decimals, the same characters on
  every machine whatever its locale.
- **No flows** draws a quiet dashed outline with "No flows yet" (for an Editor, "Double-click to add
  flows"), never an empty box that looks broken.

## Flows that cannot be drawn

A flow is **set aside**, never silently dropped: the diagram draws the rest, and the Flows dialog marks
the row and says why.

| Flow                                      | Why it is set aside                                      | What the row says                              |
| ----------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| A From or To left blank                   | It has nowhere to start or end                           | Needs a From and a To                          |
| From and To the same                      | A node cannot flow into itself                           | Flows into itself                              |
| Amount zero, negative or not a number     | A band cannot be zero or less wide                       | Needs an amount above zero                     |
| It closes a loop (A → B → A)              | Columns run one way; a flow back has no column to go to  | Loops back to an earlier node, so it is hidden |
| Past 200 flows, or a node past 120 nodes  | Past that a Sankey is unreadable, and layout cost grows  | Over the limit                                 |

Of a loop, it is the flow that **closes** it that is set aside (found by walking the flows in order), so
every flow written before it keeps drawing. Names are matched after trimming and collapsing spaces, so
`Budget ` and `Budget` are one node; case is kept, so `budget` is another.

## The menu

The element's **Tools** flyout holds a **Sankey** section and the usual others; every section is closed
until opened, as everywhere ([menus](../../004-interface-design/menus.md)).

- **Sankey** section: a summary line (`7 flows · 8 nodes`, plus `· 1 hidden` when any are set aside)
  over an **Edit Flows** button; the **Nodes**, each a colour swatch (the
  [colour picker](../../004-interface-design/colour-picker.md) in a popover, with a reset back to the
  palette) and its name; **Bands** (Blend / From / To / Grey), **Layout** (Ends Right / By Step),
  **Labels** (Amount / Percent / Names Only) as tiles; **Unit** as a short text field; **Text Size**
  (Small / Medium / Large: 10 / 12 / 15px labels).
- **Presets** holds the chart palettes ([Data charts](pie-chart.md#chart-palettes)), as a chart's does.
- **Animation**: **None**, **Grow** (bands sweep in from the left, once) and **Flow** (a soft current
  runs along every band, looping), with **Speed** and **Repeat** as on the other data elements. Both
  stop under reduced motion.
- The **Colours** and **Border** categories are hidden: a Sankey colours per node, not as one filled box.
  Like a chart, it is borderless and fills nothing.

## The Flows dialog

- Opened by double-clicking the diagram or **Edit Flows**. Two tabs: **Table** and **Text**, the
  table first.
- **Table**: a row per flow, **From** → **To**, **Amount**, and a remove button. From and To suggest
  the diagram's node names as you type. A row that is set aside shows its reason beneath it in amber.
  **Add Flow** adds a row starting from the last row's To, because flows are usually written as a
  chain; **Enter** in a row's Amount adds the next row and puts the cursor in its From.
- Under the rows, **balance notes** list each middle node whose in and out differ
  (`Needs receives 2,000 and sends 1,900`), since that is the commonest mistake in a hand-made Sankey.
- **Text**: the flows as lines, edited in place; lines it cannot read are named (`Line 4 was not read`)
  and nothing else is lost. Switching tabs carries the flows across.
- **Import CSV** (both tabs) reads a `.csv` or `.tsv` file into the flows, replacing them.
- A **preview** of the diagram sits beside the rows on a wide screen (above them on a narrow one), so the
  effect of an edit is seen without closing the dialog.
- Every edit commits live as one undo step per change (a row's field on blur, a structural change at
  once), as the chart data dialog does. **Done** closes it.

## Who may do what

| Role        | May                                                                   |
| ----------- | --------------------------------------------------------------------- |
| Editor      | Everything: add one, edit flows, restyle, and read it                 |
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

| Field              | Type                                          | Default        |
| ------------------ | --------------------------------------------- | -------------- |
| `sankeyFlows`      | `{ from: string; to: string; value: number }[]` | the budget     |
| `sankeyNodes`      | `{ name: string; color?: string }[]`          | none           |
| `sankeyLinkColor`  | `'gradient' \| 'source' \| 'target' \| 'neutral'` | `'gradient'` |
| `sankeyAlign`      | `'justify' \| 'left'`                         | `'justify'`    |
| `sankeyValueLabel` | `'value' \| 'percent' \| 'none'`              | `'value'`      |
| `sankeyUnit`       | string, up to 8 characters                    | none           |
| `sankeyAnim`, `sankeyAnimSpeed`, `sankeyAnimRepeat` | `'grow' \| 'flow'`, speed, boolean | none |

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
