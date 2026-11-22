import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { Btn, Code, DialogCard, HAIR, Lines, Surface, Tick } from './kit';

// The Style, Developers and Roles figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card
// icons"): Knowledgebase Style's looks, a terminal running the liveknowledge CLI, what an agent reads back from
// search_pages, and the three roles side by side.

const W = 420;

const LOOKS = [
  { name: 'Everyday', line: 'Lime, Inter', head: 'fill-lime-700', chosen: true },
  { name: 'Steel', line: 'Steel, Inter', head: 'fill-slate-700', chosen: false },
  { name: 'Paper', line: 'Paper, Lora', head: 'fill-amber-800', chosen: false },
] as const;

/** Knowledgebase Style: its line, the looks (each a small page of writing in that look) and Fine-tune. */
export function KnowledgebaseStyleScene() {
  const x = 50;
  return (
    <Scene w={W} h={186} bg="plain">
      <DialogCard
        x={x}
        y={8}
        w={320}
        h={170}
        title="Knowledgebase Style"
        line="Pick a look for every page of this knowledgebase."
      >
        {LOOKS.map((look, i) => {
          const cx = x + 14 + i * 100;
          return (
            <g key={look.name}>
              <Surface x={cx} y={46} w={92} h={84} r={7}>
                <Label x={cx + 9} y={60} size={8} weight={800} tone="strong">
                  Title
                </Label>
                <Label x={cx + 9} y={73} size={6.8} weight={700} className={look.head}>
                  Heading
                </Label>
                <Lines x={cx + 9} y={80} widths={[70, 58]} gap={6} h={3} />
                <rect
                  x={cx + 9}
                  y={96}
                  width={2}
                  height={10}
                  className={look.head.replace('fill-', 'fill-')}
                />
                <Lines x={cx + 14} y={98} widths={[54]} h={3} />
                <rect
                  x={cx + 9}
                  y={112}
                  width={74}
                  height={10}
                  rx={2}
                  className="fill-slate-50 stroke-slate-200"
                  strokeWidth={HAIR}
                />
              </Surface>
              {look.chosen ? (
                <rect
                  x={cx - 1.5}
                  y={44.5}
                  width={95}
                  height={87}
                  rx={8}
                  className="fill-none stroke-brand-600"
                  strokeWidth={1.4}
                />
              ) : null}
              <Label x={cx + 2} y={142} size={7.4} weight={700} tone="strong">
                {look.name}
              </Label>
              <Label x={cx + 2} y={153} size={6.6} tone="muted">
                {look.line}
              </Label>
              {look.chosen ? (
                <Tick cx={cx + 84} cy={142} r={3.4} className="stroke-brand-600" />
              ) : null}
            </g>
          );
        })}
        <Btn x={x + 250} y={156} w={56} h={15} label="Fine-tune" size={7} />
      </DialogCard>
    </Scene>
  );
}

/** One line in a terminal: a prompt and a command, or the command's output. */
type TermLine = { text: string; kind: 'command' | 'out' | 'muted' | 'warn' };

function Terminal({
  x,
  y,
  w,
  h,
  title,
  lines,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines: readonly TermLine[];
}) {
  const tone = {
    command: 'fill-slate-100',
    out: 'fill-slate-300',
    muted: 'fill-slate-500',
    warn: 'fill-amber-300',
  } as const;
  return (
    <g className="help-art-as-drawn">
      <rect x={x} y={y} width={w} height={h} rx={9} className="fill-slate-900" />
      {[0, 1, 2].map((d) => (
        <circle key={d} cx={x + 12 + d * 9} cy={y + 10} r={2.6} className="fill-slate-600" />
      ))}
      <Label
        x={x + w / 2}
        y={y + 10.4}
        anchor="middle"
        size={6.6}
        className="fill-slate-400 help-art-as-drawn"
      >
        {title}
      </Label>
      {lines.map((line, i) => (
        <Code
          key={`${i}-${line.text}`}
          x={x + 12}
          y={y + 28 + i * 11}
          size={6.8}
          className={`${tone[line.kind]} help-art-as-drawn`}
        >
          {line.kind === 'command' ? `$ ${line.text}` : line.text}
        </Code>
      ))}
    </g>
  );
}

/** The CLI: the page tree with its trust, then a search that finds a passage. */
export function CliScene() {
  return (
    <Scene w={W} h={196} bg="plain">
      <Terminal
        x={20}
        y={10}
        w={380}
        h={176}
        title="Terminal"
        lines={[
          { text: 'liveknowledge pages Handbook', kind: 'command' },
          { text: '42 pages · reviews every 90 days', kind: 'muted' },
          { text: 'Start Here  (a1f3)  verified 2026-03-12 by Maya', kind: 'out' },
          { text: '  Deploying  (c7e2)  verified 2026-03-02, review due 2026-05-31', kind: 'out' },
          { text: '  On-Call  (d4b9)  REVIEW DUE, last verified 2025-11-20', kind: 'warn' },
          { text: '', kind: 'out' },
          { text: 'liveknowledge search Handbook when do we deploy', kind: 'command' },
          { text: 'Deploying > When we deploy  (c7e2)  verified 2026-03-02', kind: 'out' },
          { text: '  We deploy on Mondays, after the checks pass.', kind: 'muted' },
          { text: '', kind: 'out' },
          { text: 'liveknowledge read Handbook Deploying -q > deploying.md', kind: 'command' },
        ]}
      />
    </Scene>
  );
}

/** What an agent reads back from search_pages: the passage, its page, its heading and how far to trust it. */
export function McpResultScene() {
  return (
    <Scene w={W} h={176} bg="plain">
      <Terminal
        x={20}
        y={10}
        w={380}
        h={156}
        title="search_pages"
        lines={[
          { text: '{ "query": "when do we deploy" }', kind: 'command' },
          { text: '"page": "c7e2", "title": "Deploying",', kind: 'out' },
          { text: '"heading": "When we deploy",', kind: 'out' },
          { text: '"passage": "We deploy on Mondays, after the checks pass.",', kind: 'out' },
          {
            text: '"verified": "verified", "verified_at": "2026-03-02T09:14:00.000Z",',
            kind: 'out',
          },
          { text: '"review_due": "2026-05-31T09:14:00.000Z", "stale": false', kind: 'out' },
        ]}
      />
    </Scene>
  );
}

const ROLES = [
  {
    name: 'Editor',
    can: ['Write and verify pages', 'Add and move pages', 'Settings, Style, AI key'],
  },
  { name: 'Participant', can: ['Read, search and Ask', 'Comment on a page', 'Export a page'] },
  { name: 'Viewer', can: ['Read, search and Ask', 'Follow links', 'Export a page'] },
] as const;

/** The three roles side by side, with a few of the things each can do. */
export function RolesScene() {
  return (
    <Scene w={W} h={124} bg="plain">
      {ROLES.map((role, i) => {
        const x = 16 + i * 132;
        return (
          <Surface key={role.name} x={x} y={12} w={124} h={100} r={8}>
            <Label x={x + 12} y={28} size={9.5} weight={700} tone="strong">
              {role.name}
            </Label>
            <line
              x1={x}
              y1={40}
              x2={x + 124}
              y2={40}
              className="stroke-slate-100"
              strokeWidth={HAIR}
            />
            {role.can.map((line, j) => (
              <g key={line}>
                <Tick cx={x + 16} cy={56 + j * 18} r={3.2} className="stroke-brand-600" />
                <Label x={x + 24} y={56.4 + j * 18} size={6.8} tone="body">
                  {line}
                </Label>
              </g>
            ))}
          </Surface>
        );
      })}
    </Scene>
  );
}
