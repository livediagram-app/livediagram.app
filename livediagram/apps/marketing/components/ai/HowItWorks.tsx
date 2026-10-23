import {
  lucideCircleCheck,
  lucideClipboardPaste,
  lucideWandSparkles,
} from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

// The three steps (docs/specs/019-marketing/build-with-ai.md "The page" 2), one row, joined by a line on wide
// screens so they read as a sequence.
const STEPS = [
  {
    icon: lucideGlyph(lucideClipboardPaste, 20),
    title: 'Add livediagram',
    body: 'Paste the address into your AI tool, or click once in Cursor and VS Code.',
  },
  {
    icon: lucideGlyph(lucideCircleCheck, 20),
    title: 'Approve',
    body: 'A livediagram page opens. Sign in or create a free account, check where access goes, and choose Connect.',
  },
  {
    icon: lucideGlyph(lucideWandSparkles, 20),
    title: 'Ask',
    body: 'Ask for a diagram, a whiteboard or a workshop. It lands in your account, ready to edit and share.',
  },
];

export function HowItWorks() {
  return (
    <ol className="relative grid gap-4 md:grid-cols-3 md:gap-6">
      <span
        aria-hidden
        className="absolute top-9 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-brand-200 via-brand-300 to-brand-200 md:block dark:from-brand-500/20 dark:via-brand-500/40 dark:to-brand-500/20"
      />
      {STEPS.map(({ icon: Icon, title, body }, i) => (
        <li
          key={title}
          className="relative rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="relative mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-sm ring-4 ring-white dark:bg-brand-500 dark:text-slate-950 dark:ring-slate-900">
            <Icon aria-hidden />
          </span>
          <p className="mt-4 text-xs font-semibold tracking-wider text-brand-700 uppercase dark:text-brand-300">
            Step {i + 1}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
        </li>
      ))}
    </ol>
  );
}
