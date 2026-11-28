'use client';

// What each session kind and outcome looks like in the editor (docs/specs/026-plan/session-tabs.md "Designed to
// grow"): an outcome's label, glyph, colour, key and the words it is announced with; a kind's Start Planning line and
// set-up title. `SESSION_KINDS` (@liveplanner/project) holds what is not the editor's.
import {
  TRIAGE_WAITING_STAGES,
  type BoardSortLevel,
  type SessionKindId,
  type SessionOutcome,
} from '@liveplanner/items';
import { FLAG_COLOUR } from '@liveplanner/project';
import { Glyph, lucideGlyph, type IconProps } from '@liveworkspace/ui';
import {
  lucideCalendarCheck,
  lucideCheck,
  lucideCircleX,
  lucideFlag,
} from '@liveworkspace/icons/lucide';

const CheckIcon = lucideGlyph(lucideCheck, 16);
const FlagIcon = lucideGlyph(lucideFlag, 16);
const CommitIcon = lucideGlyph(lucideCalendarCheck, 16);
const CloseIcon = lucideGlyph(lucideCircleX, 16);

// Closed's colour: a deep rose, apart from the flag's orange and the accent, readable on white and on slate-950.
export const CLOSED_COLOUR = '#e11d48';

// A skip arrow: lucide has none, so drawn here (a triangle to a bar).
export function SkipIcon({ size = 16, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={24} {...rest}>
      <path d="M5 5l9 7-9 7z" />
      <path d="M19 5v14" />
    </Glyph>
  );
}

export type OutcomeLook = {
  label: string;
  // The keyboard key that decides it (the facilitator's, outside text fields).
  key: string;
  Icon: (p: IconProps) => React.JSX.Element;
  // The sidebar glyph's and the progress segment's colour: the theme's accent (its brand ramp), slate or the flag
  // colour.
  colour: string;
  // The outcome in the past tense: a decided card's line, the summary, and what the live region says.
  done: string;
};

export const OUTCOME_LOOKS: Readonly<Record<SessionOutcome, OutcomeLook>> = {
  refined: {
    label: 'Refined',
    key: 'r',
    Icon: CheckIcon,
    colour: 'var(--color-brand-600)',
    done: 'Refined',
  },
  skipped: { label: 'Skip', key: 's', Icon: SkipIcon, colour: '#64748b', done: 'Skipped' },
  flagged: { label: 'Flag', key: 'f', Icon: FlagIcon, colour: FLAG_COLOUR, done: 'Flagged' },
  committed: {
    label: 'Commit',
    key: 'c',
    Icon: CommitIcon,
    colour: 'var(--color-brand-600)',
    done: 'Committed',
  },
  accepted: {
    label: 'Accept',
    key: 'a',
    Icon: CheckIcon,
    colour: 'var(--color-brand-600)',
    done: 'Accepted',
  },
  closed: { label: 'Close', key: 'c', Icon: CloseIcon, colour: CLOSED_COLOUR, done: 'Closed' },
};

export type SessionKindLook = {
  // Start Planning's card.
  name: string;
  line: string;
  // The set-up dialog's title and subtitle.
  setupTitle: string;
  setupLine: string;
  // The set-up's heading over the stages it takes cards from.
  stagesHeading: string;
  // The set-up's heading over where the completing outcome moves each type's cards, and, for a kind with a closing
  // outcome, over where that one moves them.
  targetHeading: string;
  closeHeading?: string;
  // The stage names (compared without case) the set-up picks first, else each picked type's first stage.
  startStages: readonly string[];
  // Type names (lower case) or glyphs the set-up prefers among the types it would pick (Bug Triage's bug-like ones).
  startTypes?: readonly string[];
  // The order a new set-up starts on; absent: the hand order.
  startSort?: readonly BoardSortLevel[];
  // Stage names (lower case) the kind's Next Stage steps past (sessionTarget's `pass`).
  passStages?: readonly string[];
  // Words Start Planning's search finds it by, beyond every session's.
  keywords: readonly string[];
};

export const SESSION_KIND_LOOKS: Readonly<Record<SessionKindId, SessionKindLook>> = {
  refinement: {
    name: 'Refinement',
    line: 'Work through cards one at a time, refining each, with everyone on the same card.',
    setupTitle: 'Set Up Refinement',
    setupLine: 'Pick the cards to refine, their order, and where each goes once refined.',
    stagesHeading: 'Stages',
    targetHeading: 'When Refined',
    startStages: ['backlog', 'new', 'to do', 'todo', 'ideas', 'idea', 'needs detail', 'inbox'],
    keywords: ['refine', 'refinement', 'grooming', 'backlog'],
  },
  planning: {
    name: 'Sprint Planning',
    line: 'Walk the top of the backlog and commit cards into the sprint, tallying estimates against capacity.',
    setupTitle: 'Set Up Sprint Planning',
    setupLine:
      'Pick the cards to plan from, their order, where committed cards go and the team’s capacity.',
    stagesHeading: 'Stages',
    targetHeading: 'When Committed',
    startStages: [
      'reviewed',
      'ready',
      'refined',
      'ready for development',
      'ready for dev',
      'groomed',
      'selected',
      'backlog',
    ],
    keywords: [
      'sprint',
      'planning',
      'commit',
      'capacity',
      'estimate',
      'points',
      'scrum',
      'iteration',
    ],
  },
  triage: {
    // Named apart from the Bug Triage board, which Start Planning's Boards offer too.
    name: 'Bug Triage Session',
    line: 'Walk every new bug one at a time and decide: accept it, close it with a reason, skip or flag it.',
    setupTitle: 'Set Up Bug Triage',
    setupLine: 'Pick the bugs to triage, their order, and where accepted and closed bugs go.',
    stagesHeading: 'Intake Stages',
    targetHeading: 'When Accepted',
    closeHeading: 'When Closed',
    startStages: [
      'new',
      'under review',
      'triage',
      'needs triage',
      'untriaged',
      'to triage',
      'inbox',
      'reported',
      'submitted',
      'open',
    ],
    startTypes: ['bug', 'bugs', 'defect', 'issue', 'incident', 'problem'],
    startSort: [{ field: 'createdAt', dir: 'asc' }],
    passStages: TRIAGE_WAITING_STAGES,
    keywords: ['triage', 'bug', 'bugs', 'defect', 'issue', 'incident', 'close', 'accept'],
  },
};
