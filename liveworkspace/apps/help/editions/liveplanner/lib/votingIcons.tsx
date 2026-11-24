// Collaboration → Voting's feature icons, spread into FEATURE_ICONS (featureIcons.tsx).

import { lucideVote } from '@liveworkspace/icons/lucide';
import { Prims } from '@liveplanner/ui';
import type { ReactNode } from 'react';
import { Glyph } from './glyph';

export const VOTING_ICONS: Record<string, ReactNode> = {
  // Collaboration → Voting. Five articles about one feature, so the collisions
  // here are internal: every one of them could have been "some dots". Each draws
  // its own subject instead, spending a dot, restricting to a layer, hiding the
  // count, tracking the room, and what won.
  //
  // `casting-dots` deliberately has no enclosing square: dots inside a box is the
  // die that `pickers` already draws.
  'casting-dots': (
    <Glyph>
      <Prims prims={lucideVote} />
    </Glyph>
  ),
  // A struck-through eye: the counts and the cursors are what stay hidden. The
  // open eye belongs to layer visibility, which is a different question.
  'vote-privacy': (
    <Glyph>
      <path d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 20L20 4" />
    </Glyph>
  ),
  // A panel tracking the room: who has voted, and how far along it is.
  'vote-panel': (
    <Glyph>
      <rect x="3" y="3.5" width="18" height="17" rx="2" />
      <path d="M3 8h18" />
      <path d="M6 11.5h7M6 15h5" />
      <rect x="6" y="17.5" width="12" height="1.5" rx="0.75" />
      <path d="M6 18.25h5" />
    </Glyph>
  ),
  // A podium: the tallest in the middle, which is what a ranked result looks
  // like. No axes, so it cannot be read as the bar chart.
  'vote-results': (
    <Glyph>
      <rect x="9" y="5.5" width="6" height="15" rx="1" />
      <rect x="2.5" y="11" width="6" height="9.5" rx="1" />
      <rect x="15.5" y="14" width="6" height="6.5" rx="1" />
      <path d="M11.5 9h1v4" />
    </Glyph>
  ),
};
