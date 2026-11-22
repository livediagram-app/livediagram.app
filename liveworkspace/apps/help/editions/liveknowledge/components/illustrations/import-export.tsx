import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { Btn, ChoiceRow, DialogCard, HAIR, Pill, StackedBar, Surface, TreeRows } from './kit';

// The Import and Export figures (liveworkspace/docs/specs/017-help/help-centre.md "Figures and card icons"): the
// Import dialog's three whole-Knowledgebase sources, the review of what an import found, an import that left pages
// out, the Export dialog's formats for a page, and Publish to the Web's site and what goes public. Every word is the
// dialog's own.

const W = 420;

const SOURCES = [
  { title: 'Markdown Folder', line: 'A folder of .md files and pictures, or a .zip.' },
  { title: 'Notion', line: 'A Notion export. A database becomes a table.' },
  { title: 'Confluence', line: 'A space exported as HTML.' },
] as const;

/** A source's glyph: a folder, an open book or a library, drawn plain (never another product's logo). */
function SourceGlyph({ x, y, i }: { x: number; y: number; i: number }) {
  const d = [
    `M${x} ${y + 3}a1.5 1.5 0 0 1 1.5-1.5h4l1.5 2h6a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11.5a1.5 1.5 0 0 1-1.5-1.5z`,
    `M${x + 7.5} ${y + 3.5}c-2-1.5-4.5-2-7-1.5v10c2.5-.5 5 0 7 1.5c2-1.5 4.5-2 7-1.5v-10c-2.5-.5-5 0-7 1.5zM${x + 7.5} ${y + 3.5}v10`,
    `M${x + 1} ${y + 1.5}v12M${x + 5} ${y + 1.5}v12M${x + 9} ${y + 2.5}l4 11`,
  ][i]!;
  return (
    <path
      d={d}
      className="fill-none stroke-brand-600"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Import: Into This Page beside A Whole Knowledgebase, whose three sources are cards. */
export function ImportSourcesScene() {
  const x = 50;
  return (
    <Scene w={W} h={206} bg="plain">
      <DialogCard
        x={x}
        y={8}
        w={320}
        h={190}
        title="Import"
        line="Import into this page, or bring in a whole Knowledgebase."
      >
        {/* The two choices, as a segmented control. */}
        <rect x={x + 14} y={46} width={180} height={18} rx={6} className="fill-slate-100" />
        <rect
          x={x + 104}
          y={48}
          width={88}
          height={14}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={HAIR}
        />
        <Label x={x + 59} y={55.4} anchor="middle" size={7.2} weight={500} tone="muted">
          Into This Page
        </Label>
        <Label x={x + 148} y={55.4} anchor="middle" size={7.2} weight={700} tone="strong">
          A Whole Knowledgebase
        </Label>
        {SOURCES.map((s, i) => {
          const y = 74 + i * 38;
          return (
            <Surface key={s.title} x={x + 14} y={y} w={292} h={32} r={7}>
              <SourceGlyph x={x + 24} y={y + 9} i={i} />
              <Label x={x + 48} y={y + 12} size={8.2} weight={700} tone="strong">
                {s.title}
              </Label>
              <Label x={x + 48} y={y + 23} size={6.8} tone="muted">
                {s.line}
              </Label>
            </Surface>
          );
        })}
      </DialogCard>
    </Scene>
  );
}

/** Review: what was found, the pages as a tree, what is left out or changed, where it lands, and Import. */
export function ImportReviewScene() {
  const x = 40;
  return (
    <Scene w={W} h={252} bg="plain">
      <DialogCard x={x} y={8} w={340} h={236} title="320 Pages and 41 Pictures Found">
        <TreeRows
          x={x + 14}
          y={34}
          w={150}
          rows={[
            { label: 'Handbook' },
            { label: 'Engineering', open: true },
            { label: 'Deploying', depth: 1 },
            { label: 'On-Call', depth: 1 },
            { label: 'People', open: true },
            { label: 'Holidays', depth: 1 },
          ]}
        />
        <Label x={x + 27} y={130} size={6.8} tone="muted">
          and 314 more
        </Label>
        <Label x={x + 180} y={40} size={6.4} weight={700} tone="muted">
          LEFT OUT OR CHANGED
        </Label>
        <Label x={x + 180} y={54} size={7.5} weight={700} tone="strong">
          3 Pictures Not Found
        </Label>
        <Label x={x + 180} y={65} size={6.4} tone="muted">
          Each page keeps the picture's description.
        </Label>
        <Label x={x + 180} y={82} size={7.5} weight={700} tone="strong">
          2 Pages Moved Up
        </Label>
        <Label x={x + 180} y={93} size={6.4} tone="muted">
          Pages nest 8 levels deep at most.
        </Label>
        <line
          x1={x}
          y1={142}
          x2={x + 340}
          y2={142}
          className="stroke-slate-100"
          strokeWidth={HAIR}
        />
        <Label x={x + 14} y={156} size={6.4} weight={700} tone="muted">
          WHERE IT LANDS
        </Label>
        <ChoiceRow x={x + 14} y={162} w={152} h={18} label="A New Knowledgebase" chosen />
        <ChoiceRow x={x + 172} y={162} w={154} h={18} label="Under a Page of This..." />
        <Label x={x + 14} y={194} size={6.4} tone="muted">
          An import cannot be undone as one step.
        </Label>
        <Btn x={x + 160} y={214} w={74} h={16} label="Choose Another" size={7} />
        <Btn
          x={x + 240}
          y={214}
          w={86}
          h={16}
          label="Import 320 Pages"
          variant="primary"
          size={7}
        />
      </DialogCard>
    </Scene>
  );
}

/** Done, with pages left out: the count, each failed page by name and why, and Open on the first page. */
export function ImportDoneScene() {
  const x = 60;
  return (
    <Scene w={W} h={172} bg="plain">
      <DialogCard x={x} y={8} w={300} h={156} title="318 of 320 Pages Imported">
        <StackedBar
          x={x + 14}
          y={36}
          w={272}
          h={6}
          parts={[
            { share: 318 / 320, className: 'fill-brand-600' },
            { share: 2 / 320, className: 'fill-amber-400' },
          ]}
        />
        <Label x={x + 14} y={58} size={7.5} weight={700} tone="strong">
          Giant Page
        </Label>
        <Label x={x + 14} y={69} size={6.6} tone="muted">
          It is larger than a page may be.
        </Label>
        <Label x={x + 14} y={86} size={7.5} weight={700} tone="strong">
          Old Roadmap
        </Label>
        <Label x={x + 14} y={97} size={6.6} tone="muted">
          It could not be saved.
        </Label>
        <Label x={x + 14} y={116} size={6.6} tone="muted">
          Their subpages landed under the page above them.
        </Label>
        <Btn x={x + 200} y={134} w={86} h={16} label="Open Handbook" variant="primary" size={7} />
      </DialogCard>
    </Scene>
  );
}

const FORMATS = ['PDF', 'Print', 'PNG', 'SVG', 'Word', 'Markdown', 'JSON'] as const;

/** Export: the formats a page saves to, as cards. */
export function ExportFormatsScene() {
  const x = 40;
  return (
    <Scene w={W} h={150} bg="plain">
      <DialogCard x={x} y={8} w={340} h={134} title="Export" line="Deploying">
        {FORMATS.map((f, i) => {
          const cx = x + 14 + (i % 4) * 80;
          const cy = 46 + Math.floor(i / 4) * 44;
          return (
            <Surface key={f} x={cx} y={cy} w={74} h={38} r={7}>
              <rect
                x={cx + 8}
                y={cy + 8}
                width={14}
                height={18}
                rx={2}
                className="fill-brand-50 stroke-brand-300"
                strokeWidth={HAIR}
              />
              <Label x={cx + 28} y={cy + 17.4} size={8} weight={700} tone="strong">
                {f}
              </Label>
            </Surface>
          );
        })}
      </DialogCard>
    </Scene>
  );
}

const PUBLIC_PAGES = ['Overview', 'Release Process', 'On-Call'] as const;

/** Publish to the Web: the site live at its address, then What Goes Public with a page left out and why. */
export function PublishSiteScene() {
  const x = 40;
  const w = 340;
  return (
    <Scene w={W} h={206} bg="plain">
      <DialogCard
        x={x}
        y={8}
        w={w}
        h={190}
        title="Publish to the Web"
        line="A public help centre anyone can read, from this knowledgebase's saved pages."
      >
        {/* The site: live, its address, Copy Link. */}
        <Surface
          x={x + 14}
          y={44}
          w={w - 28}
          h={40}
          r={7}
          className="fill-brand-50 stroke-brand-200"
        >
          <circle cx={x + 32} cy={64} r={10} className="fill-brand-600" />
          <g className="fill-none stroke-white help-art-as-drawn" strokeWidth={1.1}>
            <circle cx={x + 32} cy={64} r={5.5} />
            <path d={`M${x + 26.5} ${64}h11M${x + 32} ${58.5}c-3 3-3 8 0 11c3-3 3-8 0-11`} />
          </g>
          <Label x={x + 50} y={58} size={8.5} weight={700} tone="strong">
            Live on the Web
          </Label>
          <Label x={x + 50} y={70} size={7.5} weight={600} className="fill-brand-700">
            liveknowledge.app/kb/acme-help
          </Label>
          <Btn x={x + w - 78} y={56} w={60} label="Copy Link" size={7.5} />
        </Surface>
        {/* What Goes Public. */}
        <Label x={x + 14} y={100} size={8.5} weight={700} tone="strong">
          What Goes Public
        </Label>
        <Surface x={x + 14} y={108} w={w - 28} h={64} r={7}>
          <Label x={x + 24} y={120} size={7.5} tone="muted">
            3 pages go public · 1 page stays private
          </Label>
          {PUBLIC_PAGES.map((title, i) => (
            <Label key={title} x={x + 24} y={134 + i * 12} size={7.5} tone="strong">
              {title}
            </Label>
          ))}
          <Label x={x + 160} y={134} size={7.5} tone="muted">
            Hotfixes
          </Label>
          <Pill x={x + 200} y={133.5} label="Pending Approval" />
        </Surface>
        <Btn x={x + w - 78} y={177} w={64} label="Update Site" variant="primary" size={7.5} />
      </DialogCard>
    </Scene>
  );
}
