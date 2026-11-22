'use client';

// The slash menu's preview (docs/specs/030-knowledgebase/page-surface.md "The slash menu", "The preview"): the
// highlighted block drawn as it will look on the page, in the knowledgebase's own fonts and accent (the writing's
// `--article-*` variables, which the menu carries), then its name, what it does and its shortcut. Drawn from markup,
// never measured: it costs nothing of the writing.
import type { CSSProperties, ReactNode } from 'react';
import { keyLabel } from '@liveworkspace/workbench/lib/key-label';
import type { SlashItem } from '@/lib/article/article-slash-items';

// The page's look, with the app's own where the menu has no writing's variables.
const INK = 'var(--article-ink, currentColor)';
const MUTED = 'var(--article-muted, #64748b)';
const ACCENT = 'var(--article-accent, var(--color-brand-600))';
const RULE = 'var(--article-rule, #cbd5e1)';
const HEAD: CSSProperties = {
  fontFamily: 'var(--article-heading-font, inherit)',
  color: 'var(--article-heading-color, currentColor)',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  lineHeight: 1.15,
};
const BODY: CSSProperties = {
  fontFamily: 'var(--article-body-font, inherit)',
  color: INK,
  fontSize: 12,
  lineHeight: 1.5,
};

// A line of writing as a soft bar, `w` of the stage's width.
const Bar = ({ w, tone = 0.16 }: { w: string; tone?: number }) => (
  <span
    className="block h-[6px] rounded-full"
    style={{ width: w, background: `color-mix(in srgb, ${INK} ${tone * 100}%, transparent)` }}
  />
);
const Lines = ({ widths }: { widths: string[] }) => (
  <span className="flex flex-col gap-[7px]">
    {widths.map((w, i) => (
      <Bar key={i} w={w} />
    ))}
  </span>
);

const heading = (size: number, text: string) => (
  <div className="flex flex-col gap-2.5">
    <span style={{ ...HEAD, fontSize: size }}>{text}</span>
    <Lines widths={['100%', '86%', '64%']} />
  </div>
);

const listOf = (marker: (i: number) => ReactNode) => (
  <div className="flex flex-col gap-2" style={BODY}>
    {['Draft the outline', 'Ask for a review', 'Publish to the team'].map((t, i) => (
      <span key={t} className="flex items-center gap-2">
        <span className="flex w-4 shrink-0 justify-center" style={{ color: ACCENT }}>
          {marker(i)}
        </span>
        <span className={i === 0 && marker(0) === '✓' ? 'line-through opacity-60' : ''}>{t}</span>
      </span>
    ))}
  </div>
);

const Box = ({ i, done }: { i: number; done: boolean }) => (
  <span
    key={i}
    className="flex size-3.5 items-center justify-center rounded-[4px] text-[9px] font-bold text-white"
    style={done ? { background: ACCENT } : { boxShadow: `inset 0 0 0 1.5px ${MUTED}` }}
  >
    {done ? '✓' : ''}
  </span>
);

const chartBars = [0.55, 0.85, 0.4, 0.7, 1];

const SCENES: Readonly<Record<string, () => ReactNode>> = {
  text: () => (
    <div className="flex flex-col gap-2.5">
      <p style={BODY}>Plain writing, the way most of a page reads.</p>
      <Lines widths={['100%', '92%', '48%']} />
    </div>
  ),
  h1: () => heading(24, 'Getting Started'),
  h2: () => heading(19, 'Before You Begin'),
  h3: () => heading(15, 'Install the Tools'),
  subtitle: () => (
    <div className="flex flex-col gap-1.5">
      <span style={{ ...HEAD, fontSize: 18 }}>Onboarding</span>
      <span style={{ ...BODY, color: MUTED, fontSize: 13 }}>
        Everything a new teammate needs in week one
      </span>
    </div>
  ),
  quote: () => (
    <blockquote
      className="border-l-[3px] pl-3 italic"
      style={{ ...BODY, fontSize: 13, borderColor: ACCENT }}
    >
      Write it down once, and nobody has to ask twice.
    </blockquote>
  ),
  code: () => (
    <pre
      className="overflow-hidden rounded-md px-3 py-2.5 text-[11px] leading-relaxed"
      style={{
        fontFamily: 'var(--article-mono-font, ui-monospace, monospace)',
        background: 'var(--article-code-bg, rgb(148 163 184 / 0.14))',
        color: INK,
      }}
    >
      <span style={{ color: ACCENT }}>$</span> pnpm install{'\n'}
      <span style={{ color: ACCENT }}>$</span> pnpm dev
    </pre>
  ),
  bullet: () => listOf(() => '•'),
  numbered: () => listOf((i) => <span className="text-[11px] font-semibold">{i + 1}.</span>),
  todo: () => listOf((i) => <Box i={i} done={i === 0} />),
  image: () => (
    <div
      className="flex h-[92px] items-end overflow-hidden rounded-md"
      style={{
        background: `linear-gradient(160deg, color-mix(in srgb, ${ACCENT} 30%, transparent), color-mix(in srgb, ${ACCENT} 8%, transparent))`,
      }}
    >
      <svg viewBox="0 0 200 60" className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
        <path d="M0 60 L55 18 L95 46 L135 22 L200 54 L200 60 Z" fill={ACCENT} opacity="0.55" />
        <circle cx="160" cy="14" r="7" fill={ACCENT} opacity="0.7" />
      </svg>
    </div>
  ),
  chart: () => (
    <div className="flex h-[92px] items-end gap-2 border-b px-1" style={{ borderColor: RULE }}>
      {chartBars.map((h, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-[3px]"
          style={{
            height: `${h * 100}%`,
            background: ACCENT,
            opacity: i === chartBars.length - 1 ? 1 : 0.45,
          }}
        />
      ))}
    </div>
  ),
  pie: () => (
    <div className="flex h-[92px] items-center justify-center">
      <span
        className="size-[84px] rounded-full"
        style={{
          background: `conic-gradient(${ACCENT} 0 42%, color-mix(in srgb, ${ACCENT} 55%, transparent) 0 70%, color-mix(in srgb, ${ACCENT} 22%, transparent) 0)`,
        }}
      />
    </div>
  ),
  line: () => (
    <svg viewBox="0 0 200 92" className="h-[92px] w-full" aria-hidden>
      <path d="M0 91 H200" stroke={RULE} strokeWidth="1" />
      <path
        d="M4 76 C30 70 40 52 64 56 S100 30 124 36 S170 12 196 10"
        fill="none"
        stroke={ACCENT}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  ),
  drawing: () => (
    <svg viewBox="0 0 200 92" className="h-[92px] w-full" aria-hidden>
      <rect
        x="8"
        y="30"
        width="58"
        height="32"
        rx="7"
        fill="none"
        stroke={ACCENT}
        strokeWidth="2"
      />
      <rect
        x="134"
        y="8"
        width="58"
        height="30"
        rx="15"
        fill="none"
        stroke={MUTED}
        strokeWidth="2"
      />
      <path d="M100 52 l20 14 l-20 14 l-20 -14 Z" fill="none" stroke={MUTED} strokeWidth="2" />
      <path
        d="M66 46 H80 M120 66 C140 66 150 50 158 40"
        stroke={INK}
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M154 38 l6 -1 l-1 6" stroke={INK} strokeWidth="1.5" fill="none" />
    </svg>
  ),
  'page-link': () => (
    <p style={BODY}>
      See{' '}
      <span
        className="rounded px-1 py-px font-medium underline decoration-1 underline-offset-2"
        style={{
          color: 'var(--article-page-link, var(--article-accent, var(--color-brand-700)))',
          background: `color-mix(in srgb, ${ACCENT} 10%, transparent)`,
        }}
      >
        Release Checklist
      </span>{' '}
      before you ship, and link the page you start from here.
    </p>
  ),
  embed: () => (
    <div className="flex flex-col overflow-hidden rounded-lg border" style={{ borderColor: RULE }}>
      <span
        className="flex items-center gap-1.5 border-b px-2 py-1.5"
        style={{ borderColor: RULE }}
      >
        <span className="size-2.5 rounded-sm" style={{ background: ACCENT }} />
        <span style={{ ...BODY, fontSize: 11, fontWeight: 600 }}>Roadmap Board</span>
      </span>
      <span className="grid grid-cols-3 gap-1.5 p-2">
        {[3, 2, 1].map((n, c) => (
          <span key={c} className="flex flex-col gap-1">
            {Array.from({ length: n }, (_, i) => (
              <span
                key={i}
                className="h-3 rounded-sm"
                style={{ background: `color-mix(in srgb, ${INK} 10%, transparent)` }}
              />
            ))}
          </span>
        ))}
      </span>
    </div>
  ),
  footnote: () => (
    <div className="flex flex-col gap-2.5" style={BODY}>
      <p>
        Most teams review a page every quarter
        <sup className="ml-px text-[9px] font-semibold" style={{ color: ACCENT }}>
          1
        </sup>
        .
      </p>
      <span className="block w-1/3 border-t" style={{ borderColor: RULE }} />
      <p style={{ color: MUTED, fontSize: 10.5 }}>
        <span className="font-semibold">1</span> The 2026 survey of docs teams.
      </p>
    </div>
  ),
  toc: () => (
    <div className="flex flex-col gap-1.5" style={{ ...BODY, fontSize: 11.5 }}>
      {[
        ['Overview', 0],
        ['Setting Up', 0],
        ['Accounts', 1],
        ['Permissions', 1],
        ['Going Live', 0],
      ].map(([t, depth]) => (
        <span
          key={t as string}
          className="truncate"
          style={{ paddingLeft: (depth as number) * 12, color: depth ? MUTED : ACCENT }}
        >
          {t}
        </span>
      ))}
    </div>
  ),
  table: () => (
    <div
      className="grid grid-cols-3 overflow-hidden rounded-md border text-[10.5px]"
      style={{ ...BODY, fontSize: 10.5, borderColor: RULE }}
    >
      {['Owner', 'Page', 'Due', 'Ana', 'Setup', 'Mon', 'Raj', 'Billing', 'Wed'].map((c, i) => (
        <span
          key={i}
          className="truncate border-b border-r px-1.5 py-1"
          style={{
            borderColor: RULE,
            fontWeight: i < 3 ? 600 : 400,
            background: i < 3 ? `color-mix(in srgb, ${ACCENT} 12%, transparent)` : undefined,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  ),
  divider: () => (
    <div className="flex flex-col gap-3">
      <Lines widths={['92%', '70%']} />
      <span className="block border-t" style={{ borderColor: RULE }} />
      <Lines widths={['84%', '58%']} />
    </div>
  ),
};

// A key chord as its keys, each a cap.
const Keys = ({ chord }: { chord: string }) => (
  <span className="inline-flex items-center gap-0.5">
    {keyLabel(chord)
      .split(/(?<=[⌘⌥⇧⌃])|\+/)
      .filter(Boolean)
      .map((k, i) => (
        <kbd
          key={i}
          className="min-w-[1.25rem] rounded border border-slate-200 bg-white px-1 text-center font-sans text-[10.5px] leading-[18px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {k}
        </kbd>
      ))}
  </span>
);

/** The preview of `item`: its scene, name, line and shortcut. */
export function SlashPreview({ item }: { item: SlashItem }) {
  const scene = SCENES[item.id];
  return (
    <div className="flex h-full flex-col gap-3" data-slash-preview={item.id}>
      <div
        aria-hidden
        className="flex min-h-[132px] flex-col justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-white p-3.5 text-slate-900 shadow-sm dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-100"
      >
        {scene ? scene() : null}
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          {item.label}
        </span>
        <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">{item.hint}</span>
      </div>
      {item.keys || item.markdown ? (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {item.keys ? <Keys chord={item.keys} /> : null}
          {item.keys && item.markdown ? <span aria-hidden>or</span> : null}
          {item.markdown ? (
            <span className="inline-flex items-center gap-1">
              type
              <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10.5px] leading-[18px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {item.markdown}
              </kbd>
              {item.id === 'page-link' ? null : 'then Space'}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
