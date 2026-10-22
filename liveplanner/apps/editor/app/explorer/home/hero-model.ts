// Home's hero, pure (docs/specs/013-workspace/explorer-home.md "The hero"; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md): the greeting by the reader's hour, the status pills'
// words, and the features the fanned previews show.

export type HeroFeature = { id: 'board' | 'sheet' | 'dashboard' | 'form'; label: string };

/** The fanned previews, one per tab a project holds, in their places' order: Board and Sheet behind, Dashboard and
 *  Form in front. The same for everyone, so nothing is read to draw them. */
export const HERO_FEATURES: readonly HeroFeature[] = [
  { id: 'board', label: 'Board' },
  { id: 'sheet', label: 'Sheet' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'form', label: 'Form' },
];

/** Morning runs from 5 to 11, afternoon from 12 to 17; the rest of the day is evening. */
export function heroGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning,';
  if (hour >= 12 && hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export const HERO_COPY = {
  question: 'what are you planning today?',
  lead: 'Jump back into what you use most, or see what changed while you were away.',
  newProject: 'New Project',
  // The page header's words for the same drawer button.
  openNav: 'Browse sections',
  // The banner's close (explorer-home.md "Hiding the banner"), and its Settings switch.
  hideBanner: 'Hide Home Banner',
  // The fanned previews' group, for assistive technology.
  featuresLabel: 'What a project can hold',
} as const;

export type HeroPill = { id: 'projects' | 'inbox'; label: string; tone: 'emerald' | 'sky' };

/** The status pills, each only once its count is known: never "0 projects" while the lists load, nor a clear Inbox
 *  that was never read. */
export function heroPills(input: {
  projects: number | undefined;
  inbox: number | undefined;
}): HeroPill[] {
  const pills: HeroPill[] = [];
  if (input.projects !== undefined) {
    pills.push({
      id: 'projects',
      label: input.projects === 1 ? '1 project' : `${input.projects} projects`,
      tone: 'emerald',
    });
  }
  if (input.inbox !== undefined) {
    pills.push({
      id: 'inbox',
      label: input.inbox === 0 ? 'Inbox is clear' : `${input.inbox} open in your Inbox`,
      tone: 'sky',
    });
  }
  return pills;
}
