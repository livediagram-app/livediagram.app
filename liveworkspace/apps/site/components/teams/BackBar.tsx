import { Glyph } from '@livediagram/ui';

// The way back from a team to all of them: the breadcrumb bar the apps' export and import screens
// use ("All formats", with the format named in a chip; livediagram apps/editor
// components/primitives/BackBar.tsx). Its markup and classes are copied here, since the bar isn't
// exported from a shared package: a full-width bar whose whole row is the target, a chevron in a
// well that nudges left on hover, the label, and where you are in a chip at the end. It is a link
// here, not a button, because it goes to another page; the chip repeats the page's heading, so
// screen readers hear just the way back. The apps' brand hover is the site's slate.

const SHELL =
  'flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const WELL =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-200';

export function BackBar({
  href,
  label,
  current,
}: {
  href: string;
  label: string;
  current?: string;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <a
        href={href}
        className={`group relative ${SHELL} transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800/80 dark:hover:text-white`}
      >
        <span
          className={`${WELL} transition group-hover:bg-slate-200 group-hover:text-slate-800 dark:group-hover:bg-slate-600 dark:group-hover:text-white`}
        >
          <ChevronGlyph />
        </span>
        <span className="shrink-0">{label}</span>
        {current && (
          <span
            aria-hidden
            className="ml-auto min-w-0 truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {current}
          </span>
        )}
      </a>
    </nav>
  );
}

function ChevronGlyph() {
  return (
    <Glyph
      size={13}
      units={12}
      className="transition-transform duration-micro group-hover:-translate-x-0.5"
    >
      <path d="M7.5 2.5 4 6l3.5 3.5" />
    </Glyph>
  );
}
