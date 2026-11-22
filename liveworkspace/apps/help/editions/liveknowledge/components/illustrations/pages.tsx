import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  AppFrame,
  Btn,
  DialogCard,
  FormatRow,
  HAIR,
  Lines,
  MenuRows,
  PageHead,
  runningStarts,
  Pill,
  SIDEBAR_W,
  SearchBox,
  Surface,
  type TreeRowSpec,
} from './kit';

// The Pages figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card icons"): the page tree and a
// row's menu, deleting a page, the writing with its formatting row and the slash menu, page links and Linked From,
// and an embed from another app.

const W = 420;
const H = 250;
const COL = SIDEBAR_W + 34;

const TREE: TreeRowSpec[] = [
  { label: 'Start Here', state: 'verified' },
  { label: 'Engineering', open: true },
  { label: 'Deploying', depth: 1, hover: true },
  { label: 'On-Call', depth: 1, state: 'due' },
  { label: 'Runbooks', depth: 1, open: false },
  { label: 'People', open: false, state: 'verified' },
  { label: 'Glossary' },
];

/** The page tree with one row's Page Options menu open: every verb an Editor has for a page. */
export function PageTreeMenu() {
  return (
    <Scene w={W} h={H} bg="none">
      <AppFrame w={W} h={H} rows={TREE} topRow={<FormatRow x={SIDEBAR_W} y={0} />}>
        <PageHead x={COL + 96} y={42} title="Deploying" crumb="Engineering" />
        <Lines x={COL + 96} y={76} widths={[150, 140, 96]} />
      </AppFrame>
      <Surface x={104} y={28} w={118} h={186} r={8} lift>
        <Label x={114} y={41} size={7.5} weight={700} tone="muted">
          Deploying
        </Label>
        <line x1={104} y1={49} x2={222} y2={49} className="stroke-slate-200" strokeWidth={HAIR} />
        <MenuRows
          x={104}
          y={53}
          w={118}
          rows={[
            { label: 'Rename' },
            { label: 'Add Subpage' },
            { label: 'Duplicate' },
            { label: 'Copy Link' },
            { label: 'Verify' },
            { label: 'Always in Context' },
            { label: 'Move Up' },
            { label: 'Move Down' },
            { label: 'Indent', hover: true },
            { label: 'Outdent' },
            'separator',
            { label: 'Delete' },
          ]}
        />
      </Surface>
    </Scene>
  );
}

/** The confirmation before a page with subpages is deleted: it names the count and says Undo brings them back. */
export function DeletePageConfirm() {
  return (
    <Scene w={W} h={130} bg="plain">
      <DialogCard x={70} y={14} w={280} h={102} title="Delete Runbooks and 3 Subpages?">
        <Label x={84} y={56} size={8} tone="body">
          The page and its subpages are removed for everyone.
        </Label>
        <Label x={84} y={68} size={8} tone="body">
          Undo (Cmd/Ctrl-Z) brings them back.
        </Label>
        <Btn x={236} y={88} w={44} label="Cancel" />
        <Btn x={286} y={88} w={50} label="Delete" variant="primary" />
      </DialogCard>
    </Scene>
  );
}

/** A page being written: the formatting row above it, a heading, a to-do list, a table and a chart in the writing. */
export function WritingOnAPage() {
  const rows: TreeRowSpec[] = [
    { label: 'Start Here' },
    { label: 'Engineering', open: true },
    { label: 'Deploying', depth: 1, current: true },
    { label: 'On-Call', depth: 1 },
  ];
  const tx = COL;
  return (
    <Scene w={W} h={H} bg="none">
      <AppFrame w={W} h={H} rows={rows} topRow={<FormatRow x={SIDEBAR_W} y={0} />}>
        <PageHead x={COL} y={40} title="Deploying" crumb="Engineering" />
        <Lines x={COL} y={68} widths={[228, 160]} />
        <Label x={COL} y={92} size={9.5} weight={700} tone="strong">
          Before You Deploy
        </Label>
        {/* A to-do list: one ticked, one open. */}
        {[0, 1].map((i) => (
          <g key={i}>
            <rect
              x={COL}
              y={101 + i * 11}
              width={7}
              height={7}
              rx={1.8}
              className={
                i === 0 ? 'fill-brand-600 stroke-brand-600' : 'fill-white stroke-slate-300'
              }
              strokeWidth={HAIR}
            />
            <rect
              x={COL + 12}
              y={103 + i * 11}
              width={i === 0 ? 96 : 122}
              height={3.5}
              rx={1.75}
              className="fill-slate-200"
            />
          </g>
        ))}
        {/* A table in the text, its header in the accent. */}
        <rect
          x={tx}
          y={130}
          width={130}
          height={48}
          rx={3}
          className="fill-white stroke-slate-200"
          strokeWidth={HAIR}
        />
        <rect x={tx} y={130} width={130} height={12} rx={3} className="fill-brand-50" />
        {[142, 154, 166].map((y) => (
          <line
            key={y}
            x1={tx}
            y1={y}
            x2={tx + 130}
            y2={y}
            className="stroke-slate-200"
            strokeWidth={HAIR}
          />
        ))}
        <line
          x1={tx + 56}
          y1={130}
          x2={tx + 56}
          y2={178}
          className="stroke-slate-200"
          strokeWidth={HAIR}
        />
        <Label x={tx + 6} y={136.4} size={6.8} weight={700} className="fill-brand-800">
          Stage
        </Label>
        <Label x={tx + 62} y={136.4} size={6.8} weight={700} className="fill-brand-800">
          Owner
        </Label>
        {['Build', 'Staging', 'Live'].map((cell, i) => (
          <Label key={cell} x={tx + 6} y={148.4 + i * 12} size={6.8} tone="body">
            {cell}
          </Label>
        ))}
        {[40, 30, 46].map((w, i) => (
          <rect
            key={i}
            x={tx + 62}
            y={146.5 + i * 12}
            width={w}
            height={3.2}
            rx={1.6}
            className="fill-slate-200"
          />
        ))}
        {/* A bar chart in the writing. */}
        <rect
          x={tx + 144}
          y={130}
          width={84}
          height={48}
          rx={4}
          className="fill-white stroke-slate-200"
          strokeWidth={HAIR}
        />
        {[14, 24, 18, 32].map((h, i) => (
          <rect
            key={i}
            x={tx + 156 + i * 16}
            y={170 - h}
            width={10}
            height={h}
            rx={1.5}
            className={i === 3 ? 'fill-brand-500' : 'fill-brand-200'}
          />
        ))}
        <Lines x={COL} y={190} widths={[228]} />
      </AppFrame>
    </Scene>
  );
}

const SLASH_GROUPS: readonly { heading: string; items: readonly string[] }[] = [
  { heading: 'TEXT', items: ['Text', 'Heading 1', 'Heading 2'] },
  { heading: 'LISTS', items: ['Bulleted List', 'To-Do List'] },
  { heading: 'BLOCKS', items: ['Quote', 'Table', 'Footnote'] },
  { heading: 'INSERT', items: ['Link to Page', 'Image', 'Drawing', 'Embed'] },
];

/** The slash menu: type / on a line and pick what to add, grouped as the menu groups it. */
export function SlashMenuScene() {
  const tops = runningStarts(
    20,
    SLASH_GROUPS.map((group) => 13 + group.items.length * 13 + 3),
  );
  return (
    <Scene w={W} h={232} bg="plain">
      <Label x={28} y={34} size={11} tone="strong">
        /
      </Label>
      <rect x={34} y={26} width={1.2} height={15} className="fill-brand-600" />
      <Surface x={52} y={12} w={150} h={208} r={8} lift>
        {SLASH_GROUPS.map((group, groupIndex) => {
          const top = tops[groupIndex]!;
          return (
            <g key={group.heading}>
              <Label x={62} y={top + 5} size={6} weight={700} tone="muted">
                {group.heading}
              </Label>
              {group.items.map((item, i) => {
                const rowY = top + 11 + i * 13;
                const hover = item === 'Link to Page';
                return (
                  <g key={item}>
                    {hover ? (
                      <rect
                        x={56}
                        y={rowY}
                        width={142}
                        height={13}
                        rx={3.5}
                        className="fill-brand-50"
                      />
                    ) : null}
                    <rect
                      x={62}
                      y={rowY + 3.5}
                      width={6}
                      height={6}
                      rx={1.5}
                      className="fill-none stroke-slate-400"
                      strokeWidth={1}
                    />
                    <Label x={74} y={rowY + 6.9} size={7.5} weight={500} tone="strong">
                      {item}
                    </Label>
                  </g>
                );
              })}
            </g>
          );
        })}
      </Surface>
      {/* What each group holds, beside the menu. */}
      {[
        { y: 44, text: 'Text: plain writing, Title, Subtitle, Heading 1 to 3' },
        { y: 92, text: 'Lists: bulleted, numbered, to-do' },
        { y: 136, text: 'Blocks: quote, code, divider, table,' },
        { y: 147, text: 'table of contents, footnote' },
        { y: 190, text: 'Insert: page link, image, charts,' },
        { y: 201, text: 'drawing, callout, sticky note, embed' },
      ].map((note) => (
        <Label key={note.y} x={216} y={note.y} size={7.5} tone="body">
          {note.text}
        </Label>
      ))}
    </Scene>
  );
}

/** A row of the page link picker: a page's title, with its parents as the hint. */
function PickRow({
  y,
  title,
  hint,
  hover = false,
}: {
  y: number;
  title: string;
  hint?: string;
  hover?: boolean;
}) {
  return (
    <g>
      {hover ? (
        <rect x={96} y={y} width={176} height={15} rx={4} className="fill-brand-50" />
      ) : null}
      <Label x={104} y={y + 7.9} size={7.8} weight={600} tone="strong">
        {title}
      </Label>
      {hint ? (
        <Label x={264} y={y + 7.9} anchor="end" size={6.8} tone="muted">
          {hint}
        </Label>
      ) : null}
    </g>
  );
}

/** Typing [[ in the writing: the picker lists the pages that match, with Create Page at its foot. */
export function PageLinkPicker() {
  return (
    <Scene w={W} h={170} bg="plain">
      <Surface x={20} y={14} w={380} h={142} r={8}>
        <Lines x={36} y={30} widths={[348, 300]} />
        <Label x={36} y={54} size={8.5} tone="body">
          Page the engineer who is
        </Label>
        <Label x={137} y={54} size={8.5} weight={600} tone="strong">
          [[on
        </Label>
        <rect x={156} y={47} width={1.2} height={13} className="fill-brand-600" />
        <Lines x={36} y={132} widths={[220]} />
      </Surface>
      <Surface x={92} y={64} w={184} h={84} r={8} lift>
        <PickRow y={70} title="On-Call" hint="Engineering" hover />
        <PickRow y={86} title="Onboarding" hint="People" />
        <PickRow y={102} title="One-to-Ones" hint="People" />
        <line x1={92} y1={122} x2={276} y2={122} className="stroke-slate-200" strokeWidth={HAIR} />
        <Label x={104} y={134} size={7.8} weight={600} className="fill-brand-700">
          + Create Page
        </Label>
        <Label x={264} y={134} anchor="end" size={6.8} tone="muted">
          &quot;on&quot;
        </Label>
      </Surface>
    </Scene>
  );
}

/** The foot of a page: a live link, a link to a page that was deleted, and Linked From with its chips. */
export function LinkedFromScene() {
  return (
    <Scene w={W} h={150} bg="plain">
      <Surface x={20} y={14} w={380} h={122} r={8}>
        <Lines x={36} y={30} widths={[348]} />
        <Label x={36} y={48} size={8.5} tone="body">
          Follow
        </Label>
        <Label x={64} y={48} size={8.5} weight={600} className="fill-brand-700">
          Release Checklist
        </Label>
        <line
          x1={64}
          y1={53.5}
          x2={133}
          y2={53.5}
          className="stroke-brand-300"
          strokeWidth={HAIR}
        />
        <Label x={137} y={48} size={8.5} tone="body">
          and, for the old process,
        </Label>
        <Label x={234} y={48} size={8.5} className="fill-slate-400 line-through">
          Deleted Page
        </Label>
        <Lines x={36} y={64} widths={[300]} />
        <line x1={36} y1={86} x2={384} y2={86} className="stroke-slate-200" strokeWidth={HAIR} />
        <Label x={36} y={99} size={6.5} weight={700} tone="muted">
          LINKED FROM 3 PAGES
        </Label>
        <Pill x={36} y={116} label="Start Here" tone="slate" size={7.5} h={14} />
        <Pill x={96} y={116} label="On-Call" tone="slate" size={7.5} h={14} />
        <Pill x={143} y={116} label="Release Checklist" tone="slate" size={7.5} h={14} />
      </Surface>
    </Scene>
  );
}

/** A plan from liveplanner embedded in a page: its picture, its name and Open, read-only and live. */
export function EmbedInAPage() {
  const rows: TreeRowSpec[] = [
    { label: 'Start Here' },
    { label: 'Engineering', open: true },
    { label: 'Roadmap', depth: 1, current: true },
  ];
  const ex = COL;
  const ey = 78;
  return (
    <Scene w={W} h={H} bg="none">
      <AppFrame w={W} h={H} rows={rows} topRow={<FormatRow x={SIDEBAR_W} y={0} />}>
        <PageHead x={COL} y={40} title="Roadmap" crumb="Engineering" />
        <Lines x={COL} y={66} widths={[200]} />
        <Surface x={ex} y={ey} w={230} h={112} r={6}>
          {/* The plan's board, live and read-only. */}
          {[0, 1, 2].map((col) => (
            <g key={col}>
              <rect
                x={ex + 10 + col * 72}
                y={ey + 10}
                width={66}
                height={72}
                rx={4}
                className="fill-slate-100"
              />
              <rect
                x={ex + 15 + col * 72}
                y={ey + 15}
                width={[24, 34, 20][col]}
                height={3.5}
                rx={1.75}
                className="fill-slate-400"
              />
              {Array.from({ length: [3, 2, 1][col] ?? 0 }, (_, card) => (
                <rect
                  key={card}
                  x={ex + 15 + col * 72}
                  y={ey + 24 + card * 18}
                  width={56}
                  height={14}
                  rx={3}
                  className="fill-white stroke-slate-200"
                  strokeWidth={HAIR}
                />
              ))}
            </g>
          ))}
          <line
            x1={ex}
            y1={ey + 90}
            x2={ex + 230}
            y2={ey + 90}
            className="stroke-slate-200"
            strokeWidth={HAIR}
          />
          {/* liveplanner's mark, in its violet. */}
          <rect
            x={ex + 10}
            y={ey + 96}
            width={10}
            height={10}
            rx={2.5}
            className="fill-violet-500"
          />
          <Label x={ex + 26} y={ey + 101.4} size={8} weight={700} tone="strong">
            Product Roadmap
          </Label>
          <Btn x={ex + 148} y={ey + 94} w={72} h={14} label="Open in liveplanner" size={6.8} />
        </Surface>
        <Lines x={COL} y={200} widths={[180]} />
      </AppFrame>
    </Scene>
  );
}

/** Choose a File: the picker an empty embed opens, with a pasted share link, a search and the recent files. */
export function ChooseAFile() {
  const files: readonly { name: string; app: string; tone: string }[] = [
    { name: 'Product Roadmap', app: 'liveplanner', tone: 'fill-violet-500' },
    { name: 'Payments Architecture', app: 'livediagram', tone: 'fill-sky-500' },
    { name: 'Brand Kit', app: 'livedesign', tone: 'fill-rose-500' },
  ];
  return (
    <Scene w={W} h={206} bg="plain">
      <DialogCard
        x={60}
        y={12}
        w={300}
        h={182}
        title="Choose a File"
        line="Show a canvas, plan, page or design here, live and read-only."
      >
        <Label x={74} y={56} size={6.5} weight={700} tone="muted">
          PASTE A SHARE LINK
        </Label>
        <rect
          x={74}
          y={62}
          width={230}
          height={16}
          rx={4}
          className="fill-white stroke-slate-200"
          strokeWidth={HAIR}
        />
        <Label x={81} y={70.4} size={7} tone="muted">
          https://www.liveplanner.app/project/shared?s=…
        </Label>
        <Btn x={310} y={62} w={36} label="Add" />
        <SearchBox x={74} y={88} w={272} h={16} text="Find a file" keys={null} />
        {files.map((file, i) => (
          <g key={file.name}>
            {i === 0 ? (
              <rect x={74} y={110} width={272} height={22} rx={5} className="fill-slate-100" />
            ) : null}
            <rect x={82} y={116 + i * 24} width={10} height={10} rx={2.5} className={file.tone} />
            <Label x={100} y={121.4 + i * 24} size={8} weight={600} tone="strong">
              {file.name}
            </Label>
            <Label x={338} y={121.4 + i * 24} anchor="end" size={7} tone="muted">
              {file.app}
            </Label>
          </g>
        ))}
      </DialogCard>
    </Scene>
  );
}
