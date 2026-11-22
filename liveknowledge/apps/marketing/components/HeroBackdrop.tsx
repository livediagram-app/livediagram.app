// The hero's drawn backdrop (docs/specs/019-marketing/marketing-site.md "Hero", "Backdrop"): a knowledgebase drawn
// faintly into the band's ground, behind the copy and the illustration. On the left a page tree, its pages as small
// sheets joined by the tree's elbow guides, one verified and one due; on the right loose pages joined by dashed page
// links, one carrying a [[ link chip. Lime on lime in light, slate on slate in dark, faded towards the copy by a
// mask. Decorative and hidden from assistive technology. Its motion is CSS (app/feature-art/knowledge.css): the
// right side's pages float a few pixels and the dashes run along their links, the ticks and due dots pop in turn; still
// under reduced motion, and resting once the hero is off screen. Drawn only from xl, where the
// band has a margin beside its content to hold it.
import type { CSSProperties, ReactNode } from 'react';

// A delay on the kb-* timeline (app/feature-art/knowledge.css).
const at = (seconds: number) => ({ '--d': `${seconds}s` }) as CSSProperties;

const SHEET = 'fill-white/75 stroke-brand-200 dark:fill-slate-900/80 dark:stroke-slate-800';
const BAR = 'fill-brand-200/80 dark:fill-slate-800';
const GUIDE = 'stroke-brand-300/70 dark:stroke-slate-700';
const GLYPH = 'fill-brand-50 stroke-brand-300 dark:fill-slate-900 dark:stroke-slate-600';

// A page as the tree shows it: a sheet with a folded-corner glyph, its title as a bar and a line under it.
function Sheet({
  x,
  y,
  w = 150,
  title,
  mark,
}: {
  x: number;
  y: number;
  w?: number;
  title: number;
  mark?: 'verified' | 'due';
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={44} rx={9} strokeWidth={1.25} className={SHEET} />
      <path
        d={`M${x + 12} ${y + 14} h8 l5 5 v12 h-13 z`}
        strokeWidth={1.2}
        strokeLinejoin="round"
        className={GLYPH}
      />
      <rect x={x + 34} y={y + 14} width={title} height={6} rx={3} className={BAR} />
      <rect x={x + 34} y={y + 26} width={title * 0.62} height={5} rx={2.5} className={BAR} />
      {mark === 'verified' ? (
        <g className="kb-pop" style={at(y / 400)}>
          <circle cx={x + w - 16} cy={y + 22} r={7} className="fill-emerald-500/55" />
          <path
            d={`M${x + w - 19.2} ${y + 22.3} l2.3 2.3 l4.3 -4.9`}
            fill="none"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-white dark:stroke-slate-950"
          />
        </g>
      ) : null}
      {mark === 'due' ? (
        <circle
          cx={x + w - 16}
          cy={y + 22}
          r={4.5}
          className="kb-pop fill-orange-400/60"
          style={at(y / 400)}
        />
      ) : null}
    </g>
  );
}

// One side's drawing, as wide as the band's margin beside the content (plus a little under it), so it never sits
// behind the copy: a 180 by 640 board kept whole, against the content's edge, its height the band's at most.
function Side({
  align,
  className,
  children,
}: {
  align: 'xMaxYMid' | 'xMinYMid';
  className: string;
  children: ReactNode;
}) {
  // content-visibility: auto, so its motion rests once the hero is scrolled away.
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 w-[max(0px,calc((100%-72rem)/2+1.5rem))] [content-visibility:auto] max-xl:hidden ${className}`}
    >
      <svg
        focusable="false"
        viewBox="0 0 180 640"
        preserveAspectRatio={`${align} meet`}
        className="h-full w-full"
      >
        {children}
      </svg>
    </div>
  );
}

// The tree: top pages hang off the trunk (x 12), subpages off a branch (x 30) under their page.
const TREE: { depth: 0 | 1; title: number; mark?: 'verified' | 'due' }[] = [
  { depth: 0, title: 70, mark: 'verified' },
  { depth: 1, title: 50 },
  { depth: 1, title: 56, mark: 'due' },
  { depth: 0, title: 78 },
  { depth: 1, title: 44, mark: 'verified' },
  { depth: 0, title: 64 },
  { depth: 1, title: 52 },
  { depth: 1, title: 40 },
];
const ROW = 62;
const TOP = 70;

export function HeroBackdrop() {
  const lastTop = TREE.findLastIndex((row) => row.depth === 0);
  return (
    <>
      <Side
        align="xMaxYMid"
        className="left-0 [mask-image:linear-gradient(to_right,black_50%,transparent),linear-gradient(to_bottom,transparent,black_14%,black_82%,transparent)] [mask-composite:intersect]"
      >
        {/* The trunk, then each page's elbow off it (a subpage's off its page's branch). Every guide first, then
            every page over them, so a branch runs behind the page it leaves. */}
        <path
          d={`M12 ${TOP - 20} V ${TOP + lastTop * ROW + 22}`}
          strokeWidth={1.5}
          fill="none"
          className={GUIDE}
        />
        {TREE.map((row, i) => {
          const y = TOP + i * ROW;
          return (
            <path
              key={`guide-${i}`}
              d={row.depth ? `M30 ${y - 40} V ${y + 22} H 40` : `M12 ${y + 22} H 22`}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              className={GUIDE}
            />
          );
        })}
        {TREE.map((row, i) => (
          <Sheet
            key={`page-${i}`}
            x={row.depth ? 40 : 22}
            y={TOP + i * ROW}
            w={row.depth ? 128 : 146}
            title={row.title}
            mark={row.mark}
          />
        ))}
      </Side>
      <Side
        align="xMinYMid"
        className="right-0 [mask-image:linear-gradient(to_left,black_50%,transparent),linear-gradient(to_bottom,transparent,black_14%,black_82%,transparent)] [mask-composite:intersect]"
      >
        {/* Loose pages, joined by the dashed page links between them, one link as the writing shows it. */}
        <path
          d="M120 150 C 160 190, 160 230, 120 262 M90 350 C 40 390, 50 430, 96 468"
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="4 5"
          strokeLinecap="round"
          className={`kb-link ${GUIDE}`}
        />
        <g className="kb-float">
          <Sheet x={20} y={106} w={146} title={66} mark="verified" />
        </g>
        <g className="kb-float" style={at(-3)}>
          <rect
            x={30}
            y={214}
            width={84}
            height={22}
            rx={11}
            className={SHEET}
            strokeWidth={1.25}
          />
          <text
            x={42}
            y={229}
            fontSize={11}
            fontWeight={700}
            className="fill-brand-400 dark:fill-slate-600"
          >
            [[
          </text>
          <rect x={60} y={222} width={42} height={6} rx={3} className={BAR} />
        </g>
        <g className="kb-float" style={at(-5)}>
          <Sheet x={14} y={300} w={156} title={78} />
        </g>
        <g className="kb-float" style={at(-7)}>
          <Sheet x={30} y={468} w={136} title={56} mark="due" />
        </g>
      </Side>
    </>
  );
}
