import { SceneCursor } from './AppWindow';

// liveknowledge's work (liveworkspace/docs/specs/010-site/site.md "The front door"): a team handbook kept as a knowledgebase.
// The knowledgebase's pages down the left, as a tree; the page itself with its trail, heading, copy, a link to another page
// and a decision called out; Jo editing a line; and, in the margin, an AI tool's question answered from the knowledgebase's
// own pages, each one named. Drawn in the screen's `em` (AppWindow), so it scales as a picture. Decorative.

// The tree: a page's name, how deep it sits, and whether it is the one open.
const TREE: { name: string; depth: 0 | 1; open?: boolean }[] = [
  { name: 'Welcome', depth: 0 },
  { name: 'Engineering', depth: 0 },
  { name: 'How we ship', depth: 1, open: true },
  { name: 'Runbooks', depth: 1 },
  { name: 'On call', depth: 1 },
  { name: 'Product', depth: 0 },
  { name: 'Support', depth: 0 },
];

// The pages an answer was read from.
const SOURCES = ['How we ship', 'Runbooks'];

function PageGlyph({ open }: { open?: boolean }) {
  return (
    <span
      className={`h-[1.1em] w-[0.85em] shrink-0 rounded-[0.2em] border ${open ? 'border-lime-700 bg-lime-100 dark:border-lime-300 dark:bg-lime-400/20' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'}`}
    />
  );
}

export function KnowledgebaseScene() {
  return (
    <div className="relative grid aspect-[16/10] grid-cols-[13em_1fr_14.5em] overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* The knowledgebase's pages, as a tree. */}
      <div className="flex flex-col gap-[0.35em] border-r border-slate-200 bg-white px-[1em] py-[1.2em] dark:border-slate-800 dark:bg-slate-900">
        <span className="px-[0.4em] pb-[0.5em] text-[0.85em] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          Pages
        </span>
        {TREE.map((page) => (
          <span
            key={page.name}
            className={`flex items-center gap-[0.55em] rounded-[0.5em] py-[0.45em] pr-[0.5em] text-[0.95em] leading-none ${page.depth ? 'pl-[1.7em]' : 'pl-[0.5em]'} ${page.open ? 'bg-lime-100 font-semibold text-lime-900 dark:bg-lime-400/15 dark:text-lime-200' : 'text-slate-600 dark:text-slate-300'}`}
          >
            <PageGlyph open={page.open} />
            <span className="truncate">{page.name}</span>
          </span>
        ))}
      </div>

      {/* The page, running on below the fold. */}
      <div className="relative px-[1.6em] pt-[1.6em]">
        <div className="flex h-[40em] flex-col gap-[1em] rounded-t-[0.4em] bg-white px-[2.4em] pt-[2.2em] shadow-[0_1px_3px_rgb(15_23_42/0.08),0_8px_24px_-8px_rgb(15_23_42/0.12)] dark:bg-slate-900">
          <span className="text-[0.85em] font-semibold tracking-[0.16em] text-lime-800 uppercase dark:text-lime-300">
            Engineering · How we ship
          </span>
          <span className="text-[2.1em] leading-[1.1] font-bold tracking-tight text-slate-900 dark:text-white">
            How we ship
          </span>
          <span className="flex items-center gap-[0.6em] text-[0.95em] text-slate-500 dark:text-slate-400">
            <span className="flex size-[2em] items-center justify-center rounded-full bg-sky-700 text-[0.85em] font-semibold text-white">
              <span className="text-optical-centre">AL</span>
            </span>
            Ada Lovelace · Updated 2 days ago
          </span>
          <span className="mt-[0.6em] text-[1.05em] leading-[1.65] text-slate-600 dark:text-slate-300">
            Every change goes out behind a flag, to staging first.{' '}
            <span className="relative rounded-[0.2em] bg-lime-200/80 text-slate-900 dark:bg-lime-400/30 dark:text-white">
              A release that misbehaves is rolled back
              {/* Jo's caret at the end of the selection. */}
              <span className="absolute -top-[0.15em] -right-[0.1em] h-[1.5em] w-[0.15em] rounded-full bg-orange-700" />
            </span>{' '}
            with the steps in{' '}
            <span className="font-semibold text-lime-800 underline decoration-lime-500/60 underline-offset-[0.2em] dark:text-lime-300">
              Runbooks
            </span>
            .
          </span>
          <span className="flex flex-col gap-[0.5em] rounded-[0.6em] border border-lime-300 bg-lime-50 p-[1em] dark:border-lime-400/30 dark:bg-lime-400/10">
            <span className="text-[0.85em] font-semibold tracking-wider text-lime-800 uppercase dark:text-lime-300">
              Decision
            </span>
            <span className="text-[1em] leading-snug text-slate-700 dark:text-slate-200">
              We ship on weekdays before 3pm, so someone is there to watch it land.
            </span>
          </span>
          <span className="flex flex-col gap-[0.55em] pt-[0.2em]">
            <span className="h-[0.5em] w-11/12 rounded-full bg-slate-200 dark:bg-slate-700" />
            <span className="h-[0.5em] w-4/5 rounded-full bg-slate-200 dark:bg-slate-700" />
          </span>
        </div>
        <SceneCursor
          name="Jo"
          colour="#c2410c"
          className="lw-drift-a"
          style={{ left: '58%', top: '47%' }}
        />
      </div>

      {/* An AI tool's question, answered from the knowledgebase's pages. */}
      <div className="flex flex-col pt-[6.4em] pr-[1.4em]">
        <span className="flex flex-col gap-[0.7em] rounded-[0.9em] border border-slate-200 bg-white p-[1em] shadow-[0_8px_20px_-8px_rgb(15_23_42/0.2)] dark:border-slate-700 dark:bg-slate-900">
          <span className="flex items-center gap-[0.5em]">
            <span className="flex size-[2em] items-center justify-center rounded-[0.5em] bg-lime-800 text-[0.8em] font-semibold text-white">
              <span className="text-optical-centre">AI</span>
            </span>
            <span className="text-[0.95em] font-semibold text-slate-800 dark:text-slate-100">
              Your AI tool
            </span>
          </span>
          <span className="rounded-[0.6em] bg-slate-100 px-[0.8em] py-[0.6em] text-[0.95em] leading-snug text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            How do we roll back a release?
          </span>
          <span className="text-[1em] leading-snug text-slate-600 dark:text-slate-300">
            Turn the flag off, then follow the rollback steps.
          </span>
          <span className="flex flex-col gap-[0.4em] border-t border-slate-100 pt-[0.7em] dark:border-slate-800">
            <span className="text-[0.8em] font-semibold tracking-wider text-slate-400 uppercase">
              Read from
            </span>
            {SOURCES.map((source) => (
              <span
                key={source}
                className="flex items-center gap-[0.5em] text-[0.95em] font-semibold text-lime-800 dark:text-lime-300"
              >
                <PageGlyph open />
                {source}
              </span>
            ))}
          </span>
        </span>
      </div>
    </div>
  );
}
