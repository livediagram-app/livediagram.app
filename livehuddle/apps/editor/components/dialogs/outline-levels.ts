// Edit Outline's colour by level (docs/specs/009-elements/mind-node.md "Edit Outline"): the root in
// the body colour, each level below in its own colour from a ring of five, round again past the
// fifth, for the row editor's text, bullets and indent guides (MindOutlineRows). Whole class
// strings, so Tailwind
// finds them.

type LevelLook = { text: string; bullet: string; guide: string };

// Text: light -700 on white and dark -300 on slate-900, each over 4.5:1. Bullets the same hue;
// guides quieter (they are decoration beside text that already carries the level).
const RING: readonly LevelLook[] = [
  {
    text: 'text-violet-700 dark:text-violet-300',
    bullet: 'bg-violet-600 dark:bg-violet-300',
    guide: 'border-violet-300 dark:border-violet-500/60',
  },
  {
    text: 'text-sky-700 dark:text-sky-300',
    bullet: 'bg-sky-600 dark:bg-sky-300',
    guide: 'border-sky-300 dark:border-sky-500/60',
  },
  {
    text: 'text-emerald-700 dark:text-emerald-300',
    bullet: 'bg-emerald-600 dark:bg-emerald-300',
    guide: 'border-emerald-300 dark:border-emerald-500/60',
  },
  {
    text: 'text-amber-700 dark:text-amber-300',
    bullet: 'bg-amber-600 dark:bg-amber-300',
    guide: 'border-amber-300 dark:border-amber-500/60',
  },
  {
    text: 'text-rose-700 dark:text-rose-300',
    bullet: 'bg-rose-600 dark:bg-rose-300',
    guide: 'border-rose-300 dark:border-rose-500/60',
  },
];

const ROOT: LevelLook = {
  text: 'text-slate-900 dark:text-slate-100',
  bullet: 'bg-slate-500',
  guide: 'border-slate-300 dark:border-slate-600',
};

/** The look of a node at `level` (0 the root). */
export const levelLook = (level: number): LevelLook =>
  level === 0 ? ROOT : RING[(level - 1) % RING.length]!;
