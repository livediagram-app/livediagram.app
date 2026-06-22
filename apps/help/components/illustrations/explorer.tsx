// Explorer-category illustrations (spec/55): the full-page diagram library, the
// compact in-editor panel, the sidebar sections (Recent, Shared with you, My
// Work, Team Spaces) and the Library views (image gallery, saved themes).
// Composed only from the shared primitives so the house style holds.

import { Scene, Avatar, Label, TextBar, Button } from './primitives';

// --- Building blocks ---------------------------------------------------------

/** A single sidebar row: an icon glyph, a label, and an optional count badge.
 *  `active` tints it the selected brand state. */
function SidebarRow({
  x,
  y,
  w,
  label,
  count,
  active = false,
  indent = 0,
  glyph,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  count?: number;
  active?: boolean;
  indent?: number;
  glyph?: 'recent' | 'shared' | 'folder' | 'team' | 'image' | 'theme' | 'doc';
}) {
  const rowH = 22;
  const gx = x + 16 + indent;
  return (
    <g>
      {active && (
        <rect x={x + 8} y={y} width={w - 16} height={rowH} rx={7} className="fill-brand-50" />
      )}
      <g transform={`translate(${gx} ${y + rowH / 2})`}>
        <SidebarGlyph kind={glyph ?? 'doc'} active={active} />
      </g>
      <Label
        x={gx + 16}
        y={y + rowH / 2 + 1}
        size={10}
        weight={active ? 700 : 500}
        tone={active ? 'accent' : 'body'}
      >
        {label}
      </Label>
      {count !== undefined && (
        <g>
          <rect
            x={x + w - 30}
            y={y + 4}
            width={22}
            height={14}
            rx={7}
            className={active ? 'fill-brand-500' : 'fill-slate-200'}
          />
          <Label
            x={x + w - 19}
            y={y + 11}
            anchor="middle"
            size={9}
            weight={700}
            tone={active ? 'onAccent' : 'muted'}
          >
            {count}
          </Label>
        </g>
      )}
    </g>
  );
}

/** Small 14x14 sidebar icon glyphs, centred at the origin. */
function SidebarGlyph({
  kind,
  active = false,
}: {
  kind: 'recent' | 'shared' | 'folder' | 'team' | 'image' | 'theme' | 'doc';
  active?: boolean;
}) {
  const stroke = active ? 'stroke-brand-600' : 'stroke-slate-400';
  const fill = active ? 'fill-brand-500' : 'fill-slate-400';
  switch (kind) {
    case 'recent':
      return (
        <g className={stroke} strokeWidth={1.6} fill="none" strokeLinecap="round">
          <circle cx={0} cy={0} r={6} />
          <path d="M0 -3 V0 L2.5 2" />
        </g>
      );
    case 'shared':
      return (
        <g
          className={stroke}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx={-3} cy={-2} r={2.4} />
          <path d="M-6.5 5 a3.5 3 0 0 1 7 0" />
          <circle cx={4} cy={-1} r={2} />
          <path d="M1.5 5 a3 2.6 0 0 1 6 0" />
        </g>
      );
    case 'folder':
      return (
        <path
          d="M-6 -4 h4 l1.5 2 h6.5 v6 h-12 Z"
          className={`${stroke} ${active ? 'fill-brand-100' : 'fill-slate-100'}`}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      );
    case 'team':
      return (
        <g
          className={stroke}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx={0} cy={-3} r={2.4} />
          <path d="M-4 5 a4 3.4 0 0 1 8 0" />
        </g>
      );
    case 'image':
      return (
        <g>
          <rect
            x={-6}
            y={-5}
            width={12}
            height={10}
            rx={1.5}
            className={`${stroke} fill-none`}
            strokeWidth={1.6}
          />
          <circle cx={-2.5} cy={-1.5} r={1.3} className={fill} />
          <path d="M-6 3 L-1 -1 L2 1 L6 -2 V5 h-12 Z" className={fill} />
        </g>
      );
    case 'theme':
      return (
        <g className={stroke} strokeWidth={1.6} fill="none">
          <circle cx={0} cy={0} r={6} />
          <circle cx={-2} cy={-2} r={1.2} className={fill} stroke="none" />
          <circle cx={2.5} cy={-1} r={1.2} className={fill} stroke="none" />
          <circle cx={1} cy={2.5} r={1.2} className={fill} stroke="none" />
        </g>
      );
    default:
      return (
        <g className={stroke} strokeWidth={1.6} fill="none" strokeLinejoin="round">
          <path d="M-4 -6 h6 l3 3 v9 h-9 Z" />
          <path d="M2 -6 v3 h3" />
        </g>
      );
  }
}

/** A diagram card: a small canvas thumbnail above a title bar and meta line.
 *  Optional owner avatar badge for "shared" cards. */
function DiagramCard({
  x,
  y,
  w = 96,
  h = 80,
  title,
  thumb = 'flow',
  owner,
  shared = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  title?: string;
  thumb?: 'flow' | 'tree' | 'grid';
  owner?: { initial: string; colour: 'emerald' | 'violet' | 'amber' | 'rose' | 'brand' };
  shared?: boolean;
}) {
  const thumbH = h - 28;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect x={x} y={y} width={w} height={thumbH} rx={8} className="fill-slate-50" />
      <rect x={x} y={y + thumbH - 8} width={w} height={8} className="fill-slate-50" />
      <CardThumb x={x} y={y} w={w} h={thumbH} kind={thumb} />
      {title && (
        <Label x={x + 9} y={y + thumbH + 11} size={9.5} weight={600} tone="strong">
          {title}
        </Label>
      )}
      <TextBar x={x + 9} y={y + thumbH + 18} w={w - 40} h={4} tone="faint" />
      {shared && (
        <g>
          <rect
            x={x + w - 30}
            y={y + 6}
            width={24}
            height={13}
            rx={6.5}
            className="fill-emerald-100"
          />
          <Label
            x={x + w - 18}
            y={y + 13}
            anchor="middle"
            size={7.5}
            weight={700}
            className="fill-emerald-600"
          >
            shared
          </Label>
        </g>
      )}
      {owner && (
        <Avatar
          cx={x + w - 13}
          cy={y + thumbH + 13}
          r={8}
          initial={owner.initial}
          colour={owner.colour}
        />
      )}
    </g>
  );
}

/** Miniature diagram motif drawn inside a card thumbnail. */
function CardThumb({
  x,
  y,
  w,
  h,
  kind,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'flow' | 'tree' | 'grid';
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (kind === 'tree') {
    return (
      <g>
        <rect x={cx - 9} y={y + 8} width={18} height={9} rx={2} className="fill-brand-300" />
        <rect x={x + 12} y={cy + 6} width={16} height={9} rx={2} className="fill-brand-200" />
        <rect x={x + w - 28} y={cy + 6} width={16} height={9} rx={2} className="fill-brand-200" />
        <path
          d={`M${cx} ${y + 17} V${cy + 2} M${x + 20} ${cy + 2} H${x + w - 20} M${x + 20} ${cy + 2} V${cy + 6} M${x + w - 20} ${cy + 2} V${cy + 6}`}
          className="stroke-slate-300"
          strokeWidth={1.4}
          fill="none"
        />
      </g>
    );
  }
  if (kind === 'grid') {
    return (
      <g>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={x + 12 + (i % 2) * 24}
            y={y + 9 + Math.floor(i / 2) * 18}
            width={18}
            height={12}
            rx={2}
            className={i % 3 === 0 ? 'fill-brand-300' : 'fill-brand-100'}
          />
        ))}
      </g>
    );
  }
  return (
    <g>
      <rect x={x + 11} y={cy - 6} width={18} height={12} rx={2} className="fill-brand-300" />
      <ellipse cx={x + w - 18} cy={cy} rx={9} ry={6} className="fill-brand-100" />
      <path
        d={`M${x + 29} ${cy} H${x + w - 28}`}
        className="stroke-brand-400"
        strokeWidth={1.6}
        fill="none"
      />
    </g>
  );
}

/** A diagram list row: thumbnail dot, title, meta, and a kebab menu affordance. */
function DiagramRow({
  x,
  y,
  w,
  title,
  meta,
  active = false,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  meta?: string;
  active?: boolean;
}) {
  const h = 30;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={7}
        className={active ? 'fill-brand-50 stroke-brand-200' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
      />
      <rect
        x={x + 8}
        y={y + 7}
        width={22}
        height={16}
        rx={3}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1}
      />
      <rect x={x + 11} y={y + 11} width={9} height={8} rx={1.5} className="fill-brand-300" />
      <Label x={x + 40} y={y + 12} size={10} weight={600} tone="strong">
        {title}
      </Label>
      {meta && (
        <Label x={x + 40} y={y + 22} size={8} tone="muted">
          {meta}
        </Label>
      )}
      <g className="fill-slate-300">
        <circle cx={x + w - 12} cy={y + h / 2 - 4} r={1.4} />
        <circle cx={x + w - 12} cy={y + h / 2} r={1.4} />
        <circle cx={x + w - 12} cy={y + h / 2 + 4} r={1.4} />
      </g>
    </g>
  );
}

/** The Explorer sidebar column with its three groups of sections. Reused by the
 *  full-page overview. */
function ExplorerSidebar({
  x,
  y,
  w,
  h,
  active = 0,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  active?: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Brand mark */}
      <circle cx={x + 22} cy={y + 20} r={6} className="fill-brand-500" />
      <Label x={x + 34} y={y + 21} size={11} weight={700} tone="strong">
        Explorer
      </Label>
      <SidebarRow
        x={x}
        y={y + 40}
        w={w}
        label="Recent"
        count={8}
        active={active === 0}
        glyph="recent"
      />
      <SidebarRow
        x={x}
        y={y + 66}
        w={w}
        label="Shared with you"
        count={3}
        active={active === 1}
        glyph="shared"
      />
      <Label x={x + 18} y={y + 100} size={8} weight={700} tone="muted">
        MY WORK
      </Label>
      <SidebarRow x={x} y={y + 108} w={w} label="Unsorted" active={active === 2} glyph="folder" />
      <SidebarRow x={x} y={y + 134} w={w} label="Projects" active={active === 3} glyph="folder" />
      <Label x={x + 18} y={y + 168} size={8} weight={700} tone="muted">
        TEAMS
      </Label>
      <SidebarRow
        x={x}
        y={y + 176}
        w={w}
        label="Design"
        count={4}
        active={active === 4}
        glyph="team"
      />
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** The whole full-page Explorer: sidebar of sections on the left, a breadcrumb
 *  and a grid of diagram cards on the right. */
export function ExplorerOverview() {
  return (
    <Scene w={420} h={250} bg="plain">
      <ExplorerSidebar x={16} y={16} w={150} h={218} active={0} />
      {/* Main pane */}
      <rect
        x={178}
        y={16}
        width={226}
        height={218}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Breadcrumb */}
      <Label x={192} y={32} size={10} weight={700} tone="strong">
        Recent
      </Label>
      <Button x={336} y={22} w={56} h={20} label="New" variant="primary" />
      <line x1={178} y1={48} x2={404} y2={48} className="stroke-slate-200" strokeWidth={1.5} />
      {/* Card grid */}
      <DiagramCard x={192} y={60} title="Onboarding" thumb="flow" />
      <DiagramCard x={296} y={60} title="Data model" thumb="grid" />
      <DiagramCard x={192} y={144} title="Org chart" thumb="tree" />
      <DiagramCard x={296} y={144} title="API flow" thumb="flow" />
    </Scene>
  );
}

/** The compact in-editor floating Explorer panel docked over the canvas. */
export function ExplorerPanel() {
  return (
    <Scene w={420} h={230}>
      {/* A faint diagram on the canvas behind the panel */}
      <rect
        x={250}
        y={40}
        width={70}
        height={36}
        rx={6}
        className="fill-white stroke-brand-200"
        strokeWidth={2}
      />
      <rect
        x={300}
        y={120}
        width={70}
        height={36}
        rx={6}
        className="fill-white stroke-brand-200"
        strokeWidth={2}
      />
      {/* The floating panel */}
      <rect
        x={28}
        y={20}
        width={188}
        height={196}
        rx={10}
        className="fill-white stroke-slate-300"
        strokeWidth={2}
      />
      <Label x={44} y={40} size={11} weight={700} tone="strong">
        Explorer
      </Label>
      <line x1={28} y1={54} x2={216} y2={54} className="stroke-slate-200" strokeWidth={1.5} />
      <SidebarRow x={28} y={66} w={188} label="Recent" count={8} active glyph="recent" />
      <DiagramRow x={40} y={92} w={164} title="Onboarding flow" meta="edited 2m ago" active />
      <DiagramRow x={40} y={126} w={164} title="Data model" meta="edited today" />
      <SidebarRow x={28} y={162} w={188} label="My Work" glyph="folder" />
      <SidebarRow x={28} y={184} w={188} label="Shared with you" count={3} glyph="shared" />
    </Scene>
  );
}

/** A list of recently opened diagrams, newest first. */
export function RecentList() {
  return (
    <Scene w={420} h={224} bg="plain">
      <rect
        x={24}
        y={16}
        width={372}
        height={194}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <g transform="translate(40 33)">
        <SidebarGlyph kind="recent" active />
      </g>
      <Label x={56} y={33} size={10.5} weight={700} tone="strong">
        Recent diagrams
      </Label>
      <g>
        <rect x={178} y={26} width={20} height={14} rx={7} className="fill-brand-500" />
        <Label x={188} y={33} anchor="middle" size={9} weight={700} tone="onAccent">
          8
        </Label>
      </g>
      <line x1={24} y1={48} x2={396} y2={48} className="stroke-slate-200" strokeWidth={1.5} />
      <DiagramRow x={40} y={58} w={340} title="Onboarding flow" meta="opened just now" active />
      <DiagramRow x={40} y={94} w={340} title="Q3 roadmap" meta="opened 12m ago" />
      <DiagramRow x={40} y={130} w={340} title="Auth sequence" meta="opened yesterday" />
      <DiagramRow x={40} y={166} w={340} title="Data model" meta="opened 2 days ago" />
    </Scene>
  );
}

/** Shared-with-you cards, each carrying an owner avatar and a "shared" badge. */
export function SharedWithYou() {
  return (
    <Scene w={420} h={210} bg="plain">
      <rect
        x={24}
        y={16}
        width={372}
        height={178}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <g transform="translate(40 32)">
        <SidebarGlyph kind="shared" active />
      </g>
      <Label x={56} y={32} size={11} weight={700} tone="strong">
        Shared with you
      </Label>
      <line x1={24} y1={46} x2={396} y2={46} className="stroke-slate-200" strokeWidth={1.5} />
      <DiagramCard
        x={44}
        y={58}
        title="Sprint board"
        thumb="grid"
        shared
        owner={{ initial: 'M', colour: 'violet' }}
      />
      <DiagramCard
        x={162}
        y={58}
        title="System map"
        thumb="flow"
        shared
        owner={{ initial: 'A', colour: 'emerald' }}
      />
      <DiagramCard
        x={280}
        y={58}
        title="Hiring plan"
        thumb="tree"
        shared
        owner={{ initial: 'R', colour: 'amber' }}
      />
    </Scene>
  );
}

/** The My Work folder tree: an Unsorted bucket plus nested project folders. */
export function MyWorkTree() {
  const row = (
    y: number,
    label: string,
    indent: number,
    opts: { glyph?: 'folder' | 'doc'; active?: boolean; open?: boolean } = {},
  ) => (
    <g key={`${label}-${y}`}>
      {opts.glyph !== 'doc' && (
        <path
          d={
            opts.open
              ? `M${52 + indent} ${y + 9} l4 4 l4 -4`
              : `M${54 + indent} ${y + 7} l4 4 l-4 4`
          }
          className="stroke-slate-400"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <SidebarRow
        x={64 + indent}
        y={y}
        w={300 - indent}
        label={label}
        indent={0}
        active={opts.active}
        glyph={opts.glyph ?? 'folder'}
      />
    </g>
  );
  return (
    <Scene w={420} h={240} bg="plain">
      <rect
        x={24}
        y={16}
        width={372}
        height={208}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={40} y={32} size={11} weight={700} tone="strong">
        My Work
      </Label>
      <line x1={24} y1={44} x2={396} y2={44} className="stroke-slate-200" strokeWidth={1.5} />
      {row(56, 'Unsorted', 0, { glyph: 'folder' })}
      {row(82, 'Projects', 0, { open: true })}
      {row(108, 'Acme Corp', 24, { open: true })}
      {row(134, 'Kickoff diagram', 48, { glyph: 'doc' })}
      {row(160, 'Architecture', 48, { glyph: 'doc', active: true })}
      {row(186, 'Internal', 24, { glyph: 'folder' })}
    </Scene>
  );
}

/** A team space: members across the top, shared folders, and a pending-invite row. */
export function TeamSpace() {
  return (
    <Scene w={420} h={236} bg="plain">
      <rect
        x={24}
        y={16}
        width={372}
        height={204}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <g transform="translate(40 32)">
        <SidebarGlyph kind="team" active />
      </g>
      <Label x={56} y={32} size={11} weight={700} tone="strong">
        Design team
      </Label>
      {/* Members */}
      <Avatar cx={304} cy={31} r={11} initial="M" colour="violet" />
      <Avatar cx={326} cy={31} r={11} initial="A" colour="emerald" />
      <Avatar cx={348} cy={31} r={11} initial="R" colour="amber" />
      <circle cx={370} cy={31} r={11} className="fill-slate-100 stroke-white" strokeWidth={2.5} />
      <Label x={370} y={32} anchor="middle" size={9} weight={700} tone="muted">
        +2
      </Label>
      <line x1={24} y1={48} x2={396} y2={48} className="stroke-slate-200" strokeWidth={1.5} />
      <Label x={40} y={64} size={8} weight={700} tone="muted">
        SHARED FOLDERS
      </Label>
      <SidebarRow x={32} y={72} w={356} label="Brand assets" glyph="folder" />
      <SidebarRow x={32} y={96} w={356} label="Product specs" glyph="folder" />
      <SidebarRow x={32} y={120} w={356} label="Research" glyph="folder" />
      {/* Pending invite row */}
      <rect
        x={40}
        y={154}
        width={340}
        height={34}
        rx={8}
        className="fill-amber-50 stroke-amber-300"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <Avatar cx={60} cy={171} r={9} initial="?" colour="amber" />
      <Label x={78} y={166} size={10} weight={600} tone="strong">
        sam@acme.com
      </Label>
      <Label x={78} y={178} size={8.5} tone="muted">
        Invite pending
      </Label>
      <Button x={232} y={161} w={62} h={18} label="Resend" variant="default" />
      <Button x={302} y={161} w={64} h={18} label="Accept" variant="primary" />
    </Scene>
  );
}

/** The image gallery: a grid of uploaded thumbnails, each with a delete affordance. */
export function ImageGallery() {
  const tiles = [
    { used: true, hue: 'fill-brand-200' },
    { used: true, hue: 'fill-emerald-200' },
    { used: false, hue: 'fill-amber-200' },
    { used: true, hue: 'fill-violet-200' },
    { used: false, hue: 'fill-rose-200' },
    { used: true, hue: 'fill-teal-200' },
  ];
  return (
    <Scene w={420} h={216} bg="plain">
      <rect
        x={24}
        y={16}
        width={372}
        height={184}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={40} y={32} size={11} weight={700} tone="strong">
        Image gallery
      </Label>
      <Button x={314} y={22} w={68} h={20} label="Upload" variant="primary" />
      <line x1={24} y1={48} x2={396} y2={48} className="stroke-slate-200" strokeWidth={1.5} />
      {tiles.map((t, i) => {
        const col = i % 3;
        const r = Math.floor(i / 3);
        const tx = 44 + col * 116;
        const ty = 60 + r * 70;
        return (
          <g key={i}>
            <rect
              x={tx}
              y={ty}
              width={100}
              height={58}
              rx={8}
              className="fill-slate-50 stroke-slate-200"
              strokeWidth={1.5}
            />
            {/* image motif */}
            <circle cx={tx + 24} cy={ty + 20} r={6} className={t.hue} />
            <path
              d={`M${tx + 8} ${ty + 50} L${tx + 34} ${ty + 28} L${tx + 52} ${ty + 42} L${tx + 70} ${ty + 26} L${tx + 92} ${ty + 50} Z`}
              className={t.hue}
            />
            {/* used-in badge */}
            <g>
              <rect
                x={tx + 6}
                y={ty + 6}
                width={t.used ? 44 : 50}
                height={13}
                rx={6.5}
                className={t.used ? 'fill-brand-100' : 'fill-slate-200'}
              />
              <Label
                x={tx + 10}
                y={ty + 13}
                size={7.5}
                weight={700}
                className={t.used ? 'fill-brand-600' : 'fill-slate-500'}
              >
                {t.used ? 'Used x2' : 'Unused'}
              </Label>
            </g>
            {/* delete affordance */}
            <g>
              <circle
                cx={tx + 88}
                cy={ty + 13}
                r={9}
                className="fill-white stroke-slate-300"
                strokeWidth={1.5}
              />
              <path
                d={`M${tx + 84} ${ty + 9} l8 8 M${tx + 92} ${ty + 9} l-8 8`}
                className="stroke-rose-500"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </g>
          </g>
        );
      })}
    </Scene>
  );
}

/** The saved-themes library: custom themes as swatch preview cards. */
export function ThemesLibrary() {
  const themes: { name: string; swatches: string[] }[] = [
    {
      name: 'Ocean',
      swatches: ['fill-brand-500', 'fill-brand-300', 'fill-brand-100', 'fill-brand-50'],
    },
    {
      name: 'Forest',
      swatches: ['fill-emerald-500', 'fill-emerald-300', 'fill-emerald-100', 'fill-emerald-50'],
    },
    {
      name: 'Sunset',
      swatches: ['fill-rose-500', 'fill-amber-400', 'fill-amber-200', 'fill-amber-50'],
    },
    {
      name: 'Grape',
      swatches: ['fill-violet-500', 'fill-violet-300', 'fill-violet-100', 'fill-violet-50'],
    },
  ];
  return (
    <Scene w={420} h={214} bg="plain">
      <rect
        x={24}
        y={16}
        width={372}
        height={182}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={40} y={32} size={11} weight={700} tone="strong">
        Saved themes
      </Label>
      <line x1={24} y1={48} x2={396} y2={48} className="stroke-slate-200" strokeWidth={1.5} />
      {themes.map((t, i) => {
        const col = i % 2;
        const r = Math.floor(i / 2);
        const tx = 44 + col * 178;
        const ty = 60 + r * 66;
        return (
          <g key={i}>
            <rect
              x={tx}
              y={ty}
              width={158}
              height={54}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            {t.swatches.map((s, j) => (
              <rect
                key={j}
                x={tx + 12 + j * 26}
                y={ty + 12}
                width={22}
                height={20}
                rx={4}
                className={s}
              />
            ))}
            <Label x={tx + 12} y={ty + 44} size={9.5} weight={600} tone="strong">
              {t.name}
            </Label>
            {/* edit / duplicate / delete dots */}
            <g className="fill-slate-300">
              <circle cx={tx + 140} cy={ty + 43} r={1.4} />
              <circle cx={tx + 146} cy={ty + 43} r={1.4} />
              <circle cx={tx + 152} cy={ty + 43} r={1.4} />
            </g>
          </g>
        );
      })}
    </Scene>
  );
}

/** The Unsorted folder: the synthetic home for diagrams not filed anywhere,
 *  shown highlighted at the top of My Work with a couple of loose docs in it. */
export function UnsortedFolder() {
  return (
    <Scene w={420} h={214} bg="plain">
      <rect
        x={24}
        y={16}
        width={372}
        height={182}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={40} y={32} size={11} weight={700} tone="strong">
        My Work
      </Label>
      <line x1={24} y1={44} x2={396} y2={44} className="stroke-slate-200" strokeWidth={1.5} />
      <SidebarRow x={40} y={54} w={336} label="Unsorted" glyph="folder" active count={2} />
      <SidebarRow x={64} y={92} w={312} label="Untitled diagram" glyph="doc" />
      <SidebarRow x={64} y={122} w={312} label="Quick sketch" glyph="doc" />
      <SidebarRow x={40} y={158} w={336} label="Projects" glyph="folder" />
    </Scene>
  );
}
