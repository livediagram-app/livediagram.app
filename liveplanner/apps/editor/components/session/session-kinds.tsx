'use client';

// What each session kind and outcome looks like in the editor (docs/specs/026-plan/session-tabs.md "Designed to
// grow"): an outcome's label, glyph, colour, key and the words it is announced with; a kind's Start Planning line and
// set-up title. `SESSION_KINDS` (@liveplanner/project) holds what is not the editor's.
import type { SessionKindId, SessionOutcome } from '@liveplanner/items';
import { FLAG_COLOUR } from '@liveplanner/project';
import { Glyph, lucideGlyph, type IconProps } from '@liveworkspace/ui';
import { lucideCheck, lucideFlag } from '@liveworkspace/icons/lucide';

const CheckIcon = lucideGlyph(lucideCheck, 16);
const FlagIcon = lucideGlyph(lucideFlag, 16);

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
};

export type SessionKindLook = {
  // Start Planning's card.
  name: string;
  line: string;
  // The set-up dialog's title and subtitle.
  setupTitle: string;
  setupLine: string;
};

export const SESSION_KIND_LOOKS: Readonly<Record<SessionKindId, SessionKindLook>> = {
  refinement: {
    name: 'Refinement',
    line: 'Work through cards one at a time, refining each, with everyone on the same card.',
    setupTitle: 'Set Up Refinement',
    setupLine: 'Pick the cards to refine, their order, and where each goes once refined.',
  },
};
