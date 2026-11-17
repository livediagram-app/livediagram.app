import type { ForumCategory } from '@liveworkspace/community';
import type { lucideGlyph } from '@liveworkspace/ui';
import {
  BugReportIcon,
  ForumIcon,
  QuestionIcon,
  ShowcaseIcon,
  SparklesIcon,
  TipIcon,
} from '../shared/icons';

// How each Forum category is drawn (liveworkspace/docs/specs/007-community/community.md "Categories and apps"): a
// glyph, a tone and a line saying what belongs in it. The words and order stay the contract's (FORUM_CATEGORIES).

type Glyph = ReturnType<typeof lucideGlyph>;

export type ForumCategoryLook = { Icon: Glyph; blurb: string; tile: string };

export const FORUM_CATEGORY_LOOK: Record<ForumCategory, ForumCategoryLook> = {
  question: {
    Icon: QuestionIcon,
    blurb: 'How something works, or how to do it',
    tile: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
  },
  tips: {
    Icon: TipIcon,
    blurb: 'Shortcuts and better ways of working',
    tile: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  },
  feature: {
    Icon: SparklesIcon,
    blurb: "What you'd like the apps to do next",
    tile: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
  },
  bug: {
    Icon: BugReportIcon,
    blurb: "Something that isn't working right",
    tile: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  },
  showcase: {
    Icon: ShowcaseIcon,
    blurb: "Share something you've made",
    tile: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  },
  general: {
    Icon: ForumIcon,
    blurb: 'Anything else about the apps',
    tile: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/50 dark:text-slate-200 dark:ring-slate-600',
  },
};
