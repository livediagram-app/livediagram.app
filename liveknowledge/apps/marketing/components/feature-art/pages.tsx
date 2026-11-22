// Pages That Stay Organised: the page tree beside one continuous page, with a page link in the writing and the
// pages that link back at its foot.
import { ArtPanel, Bars, Board, Card, Label, PageGlyph, Pill, Rule, T, Tick, at } from './kit';

// The tree's rows, top to bottom: `depth` indents a subpage, `open` turns a parent's chevron down.
const ROWS: readonly { title: string; depth: 0 | 1; open?: boolean; parent?: boolean }[] = [
  { title: 'How We Work', depth: 0, parent: true },
  { title: 'Engineering', depth: 0, parent: true, open: true },
  { title: 'Release Runbook', depth: 1 },
  { title: 'On Call', depth: 1 },
  { title: 'Incident Review', depth: 1 },
  { title: 'Product', depth: 0, parent: true },
  { title: 'Support', depth: 0, parent: true },
];
const SELECTED = 'Release Runbook';
const ROW_TOP = 76;
const ROW_STEP = 30;

function Chevron({ x, y, open }: { x: number; y: number; open: boolean }) {
  return (
    <path
      d={open ? `M${x - 3.5} ${y - 2} l3.5 4 l3.5 -4` : `M${x - 2} ${y - 3.5} l4 3.5 l-4 3.5`}
      fill="none"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-slate-500 dark:stroke-slate-400"
    />
  );
}

export function PagesArt() {
  return (
    <ArtPanel>
      <Board>
        {/* The page tree. */}
        <Card x={14} y={22} w={178} h={330}>
          <T x={30} y={52} size={13} weight={700}>
            Acme Handbook
          </T>
          <Rule x={30} y={62} w={146} />
          {ROWS.map((row, i) => {
            const y = ROW_TOP + i * ROW_STEP;
            const x = 34 + row.depth * 16;
            const selected = row.title === SELECTED;
            return (
              <g key={row.title} className="kb-in" style={at(0.2 + i * 0.12)}>
                {selected ? (
                  <rect
                    x={22}
                    y={y - 4}
                    width={162}
                    height={26}
                    rx={8}
                    className="fill-brand-100 dark:fill-brand-900"
                  />
                ) : null}
                {row.parent ? <Chevron x={x} y={y + 9} open={!!row.open} /> : null}
                <T
                  x={x + (row.parent ? 12 : 0)}
                  y={y + 13}
                  size={12}
                  weight={selected || row.parent ? 600 : 400}
                  tone={selected ? 'brand' : 'words'}
                >
                  {row.title}
                </T>
                {selected ? <Tick cx={171} cy={y + 9} r={7} /> : null}
              </g>
            );
          })}
          <T x={34} y={ROW_TOP + ROWS.length * ROW_STEP + 16} size={12} tone="quiet">
            + New Page
          </T>
        </Card>

        {/* The page: its breadcrumb, its title, writing with a page link, and Linked From. */}
        <Card x={210} y={22} w={296} h={330}>
          <T x={230} y={50} size={10.5} tone="quiet">
            Engineering / Release Runbook
          </T>
          <T x={230} y={80} size={20} weight={700}>
            Release Runbook
          </T>
          <Bars x={230} y={102} widths={[252, 236, 168]} />
          <T x={230} y={170} size={13} weight={600}>
            If It Fails
          </T>
          <Bars x={230} y={184} widths={[100]} />
          {/* A page link in the line: it follows its page through renames and moves. */}
          <rect
            x={338}
            y={176}
            width={78}
            height={22}
            rx={6}
            className="fill-brand-100 dark:fill-brand-900"
          />
          <PageGlyph x={344} y={180} />
          <T x={361} y={191.5} size={11.5} weight={600} tone="brand">
            On Call
          </T>
          <path
            d="M422 177 v20"
            strokeWidth={1.75}
            strokeLinecap="round"
            className="fa-pulse stroke-brand-700 dark:stroke-brand-300"
          />
          <Bars x={230} y={208} widths={[244, 190]} />
          <Rule x={230} y={254} w={256} />
          <Label x={230} y={276}>
            LINKED FROM
          </Label>
          <Pill x={230} y={288} w={68} tone="brand" delay={1.3}>
            On Call
          </Pill>
          <Pill x={304} y={288} w={110} tone="brand" delay={1.5}>
            Incident Review
          </Pill>
          <Pill x={420} y={288} w={66} tone="plain" delay={1.7}>
            2 More
          </Pill>
          <T x={230} y={334} size={10.5} tone="quiet">
            One continuous page. No page breaks to manage.
          </T>
        </Card>
      </Board>
    </ArtPanel>
  );
}
