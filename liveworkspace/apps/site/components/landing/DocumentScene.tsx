import { SceneCursor } from './AppWindow';

// livedocuments' work (liveworkspace/docs/specs/010-site/site.md "The front door"): a quarterly review written as
// an article on real pages. The tab's pages down the left (the article, a slide and an infographic, since one
// document holds all three); the page itself with its heading, byline, copy and a chart; Lena selecting a line
// with the format bar over it; and Kai's comment waiting in the margin. Drawn in the screen's `em` (AppWindow), so
// it scales as a picture. Decorative.

const WEEKS = [28, 34, 31, 46, 58, 74, 92];

function Chart({ mini = false }: { mini?: boolean }) {
  return (
    <span className={`flex h-full items-end ${mini ? 'gap-[0.15em]' : 'gap-[0.55em]'}`}>
      {WEEKS.map((h, i) => (
        <span
          key={i}
          className={`flex-1 rounded-t-[0.25em] ${i === WEEKS.length - 1 ? 'bg-amber-500' : 'bg-amber-300/80 dark:bg-amber-400/50'}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </span>
  );
}

// A page in the rail: the article (with its lines and chart), a slide or an infographic, as their thumbnails show.
function Thumb({ kind, active }: { kind: 'article' | 'slide' | 'info'; active?: boolean }) {
  const ring = active ? 'ring-[0.2em] ring-amber-500' : 'ring-1 ring-slate-200 dark:ring-slate-700';
  if (kind === 'slide') {
    return (
      <span
        className={`flex aspect-video flex-col justify-end gap-[0.3em] rounded-[0.4em] bg-gradient-to-br from-amber-700 via-orange-700 to-rose-800 p-[0.6em] shadow-sm ${ring}`}
      >
        <span className="h-[0.45em] w-3/4 rounded-full bg-white/90" />
        <span className="h-[0.3em] w-1/2 rounded-full bg-white/50" />
      </span>
    );
  }
  if (kind === 'info') {
    return (
      <span
        className={`grid aspect-[3/4] grid-cols-2 gap-[0.3em] rounded-[0.4em] bg-white p-[0.5em] shadow-sm dark:bg-slate-900 ${ring}`}
      >
        <span className="col-span-2 h-[0.45em] w-2/3 rounded-full bg-slate-700 dark:bg-slate-300" />
        {['bg-amber-400', 'bg-sky-400', 'bg-emerald-400', 'bg-rose-400'].map((c) => (
          <span key={c} className={`rounded-[0.25em] ${c}`} />
        ))}
      </span>
    );
  }
  return (
    <span
      className={`flex aspect-[3/4] flex-col gap-[0.3em] rounded-[0.4em] bg-white p-[0.5em] shadow-sm dark:bg-slate-900 ${ring}`}
    >
      <span className="h-[0.25em] w-1/3 rounded-full bg-amber-500" />
      <span className="h-[0.45em] w-5/6 rounded-full bg-slate-700 dark:bg-slate-300" />
      <span className="h-[0.25em] rounded-full bg-slate-200 dark:bg-slate-700" />
      <span className="h-[0.25em] w-4/5 rounded-full bg-slate-200 dark:bg-slate-700" />
      <span className="h-[2.2em] rounded-[0.2em] bg-amber-50 p-[0.2em] dark:bg-amber-500/10">
        <Chart mini />
      </span>
      <span className="h-[0.25em] rounded-full bg-slate-200 dark:bg-slate-700" />
    </span>
  );
}

// The format bar's buttons: bold, italic, link, heading, comment.
const FORMAT: [string, string][] = [
  ['B', 'font-bold'],
  ['I', 'italic font-serif'],
  ['U', 'underline'],
];

export function DocumentScene() {
  return (
    <div className="relative grid aspect-[16/10] grid-cols-[9em_1fr_13.5em] overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* The tab's pages. */}
      <div className="flex flex-col gap-[0.9em] border-r border-slate-200 bg-white px-[1.4em] py-[1.2em] dark:border-slate-800 dark:bg-slate-900">
        <span className="text-[0.85em] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          Pages
        </span>
        <Thumb kind="article" active />
        <Thumb kind="slide" />
        <Thumb kind="info" />
      </div>

      {/* The page, running on below the fold. */}
      <div className="relative px-[1.6em] pt-[1.6em]">
        <div className="flex h-[40em] flex-col gap-[1em] rounded-t-[0.4em] bg-white px-[2.6em] pt-[2.4em] shadow-[0_1px_3px_rgb(15_23_42/0.08),0_8px_24px_-8px_rgb(15_23_42/0.12)] dark:bg-slate-900">
          <span className="text-[0.85em] font-semibold tracking-[0.16em] text-amber-700 uppercase dark:text-amber-300">
            Quarterly review · Q3
          </span>
          <span className="text-[2.1em] leading-[1.1] font-bold tracking-tight text-slate-900 dark:text-white">
            What we shipped, and what comes next
          </span>
          <span className="flex items-center gap-[0.6em] text-[0.95em] text-slate-500 dark:text-slate-400">
            <span className="flex size-[2em] items-center justify-center rounded-full bg-amber-700 text-[0.85em] font-semibold text-white">
              <span className="text-optical-centre">LP</span>
            </span>
            Lena Park · 6 min read
          </span>
          <span className="relative mt-[2.2em] text-[1.05em] leading-[1.65] text-slate-600 dark:text-slate-300">
            <span className="relative rounded-[0.2em] bg-amber-200/80 text-slate-900 dark:bg-amber-400/30 dark:text-white">
              Sign-ups doubled after the beta opened
              {/* Lena's caret at the end of her selection. */}
              <span className="absolute -right-[0.1em] -top-[0.15em] h-[1.5em] w-[0.15em] rounded-full bg-amber-700" />
              {/* The format bar over the selection. */}
              <span className="absolute -top-[3.4em] left-[1em] flex items-center gap-[0.2em] rounded-[0.7em] bg-slate-900 px-[0.4em] py-[0.35em] text-[0.95em] leading-none text-white shadow-lg dark:bg-slate-700">
                {FORMAT.map(([l, c]) => (
                  <span key={l} className={`flex size-[1.9em] items-center justify-center ${c}`}>
                    {l}
                  </span>
                ))}
                <span className="mx-[0.2em] h-[1.3em] w-px bg-white/25" />
                <span className="flex h-[1.9em] items-center px-[0.4em] font-semibold">H2</span>
                <span className="flex h-[1.9em] items-center rounded-[0.4em] bg-amber-500 px-[0.5em] font-semibold text-amber-950">
                  Comment
                </span>
              </span>
            </span>
            , and support tickets fell by a third. Three launches went out this quarter, each shared
            with one link.
          </span>
          <span className="flex flex-col gap-[0.6em] rounded-[0.6em] border border-slate-200 p-[1em] dark:border-slate-700">
            <span className="flex items-baseline justify-between">
              <span className="text-[1em] font-semibold text-slate-800 dark:text-slate-100">
                Weekly sign-ups
              </span>
              <span className="text-[0.9em] font-semibold text-emerald-600 dark:text-emerald-400">
                ▲ 2.1×
              </span>
            </span>
            <span className="h-[6.5em]">
              <Chart />
            </span>
          </span>
        </div>
        <SceneCursor
          name="Lena"
          colour="#b45309"
          className="lw-drift-a"
          style={{ left: '62%', top: '44%' }}
        />
      </div>

      {/* Kai's comment in the margin, tied to the line. */}
      <div className="flex flex-col pt-[9.6em] pr-[1.4em]">
        <span className="flex flex-col gap-[0.6em] rounded-[0.9em] border border-slate-200 bg-white p-[1em] shadow-[0_8px_20px_-8px_rgb(15_23_42/0.2)] dark:border-slate-700 dark:bg-slate-900">
          <span className="flex items-center gap-[0.5em]">
            <span className="flex size-[2em] items-center justify-center rounded-full bg-rose-700 text-[0.8em] font-semibold text-white">
              <span className="text-optical-centre">KJ</span>
            </span>
            <span className="text-[0.95em] font-semibold text-slate-800 dark:text-slate-100">
              Kai
            </span>
            <span className="text-[0.85em] text-slate-400">2m</span>
          </span>
          <span className="text-[1em] leading-snug text-slate-600 dark:text-slate-300">
            Can we put the Q4 target next to this?
          </span>
          <span className="flex items-center gap-[0.5em] border-t border-slate-100 pt-[0.6em] text-[0.9em] text-slate-400 dark:border-slate-800">
            <span className="flex size-[1.8em] items-center justify-center rounded-full bg-amber-700 text-[0.75em] font-semibold text-white">
              <span className="text-optical-centre">LP</span>
            </span>
            Lena is replying…
          </span>
        </span>
      </div>
    </div>
  );
}
