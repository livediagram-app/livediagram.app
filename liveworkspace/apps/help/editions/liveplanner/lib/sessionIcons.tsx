// Plan → Session Tabs' feature icons, spread into FEATURE_ICONS (featureIcons.tsx). Seven articles about one feature,
// so each draws its own subject: the queue beside the card, the set-up's sliders, a card ticked and moved on, the
// team person by person, points filling a capacity meter, a bug, and the demo screen.

import { lucidePresentation } from '@liveworkspace/icons/lucide';
import { Prims } from '@liveplanner/ui';
import type { ReactNode } from 'react';
import { Glyph } from './glyph';

export const SESSION_ICONS: Record<string, ReactNode> = {
  // The page: the queue on the left, the room's card on the right with its tick.
  'session-tabs': (
    <Glyph>
      <rect x="3" y="4" width="6.5" height="16" rx="1.5" />
      <path d="M5.2 8h2.1M5.2 12h2.1M5.2 16h2.1" />
      <rect x="11.5" y="4" width="9.5" height="16" rx="1.5" />
      <path d="M14 12.2l1.8 1.8 3.2-3.6" />
    </Glyph>
  ),
  // The set-up: two sliders, the choices it makes.
  'set-up-a-session': (
    <Glyph>
      <path d="M3 7h9M16 7h5M3 17h3M10 17h11" />
      <circle cx="14" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
      <path d="M3 12h18" strokeDasharray="2 2.5" />
    </Glyph>
  ),
  // Refinement: a card ticked, and the arrow it moves on by.
  refinement: (
    <Glyph>
      <rect x="3" y="5" width="12" height="14" rx="1.5" />
      <path d="M6 12l2 2 4-4.2" />
      <path d="M17.5 12H21M19.2 9.8L21.4 12l-2.2 2.2" />
    </Glyph>
  ),
  // Stand-up: the team, one person at a time, the speaker raised.
  'stand-up': (
    <Glyph>
      <circle cx="12" cy="6.5" r="2.5" />
      <path d="M8 15c0-2.4 1.8-4 4-4s4 1.6 4 4" />
      <circle cx="5" cy="11" r="1.8" />
      <path d="M2.5 18.5c0-1.8 1.1-3 2.5-3s2.5 1.2 2.5 3" />
      <circle cx="19" cy="11" r="1.8" />
      <path d="M16.5 18.5c0-1.8 1.1-3 2.5-3s2.5 1.2 2.5 3" />
    </Glyph>
  ),
  // Sprint Planning: two cards over the capacity meter they fill.
  'sprint-planning': (
    <Glyph>
      <rect x="4" y="3.5" width="7" height="8" rx="1.2" />
      <rect x="13" y="3.5" width="7" height="8" rx="1.2" />
      <rect x="3" y="15" width="18" height="5" rx="2.5" />
      <path d="M5.5 17.5h8" strokeWidth="2.4" />
    </Glyph>
  ),
  // Bug Triage: the bug itself, its head, body, six legs and the line down its back.
  'bug-triage': (
    <Glyph>
      <path d="M9.5 7.5a2.5 2.5 0 015 0" />
      <rect x="7.5" y="8" width="9" height="12" rx="4.5" />
      <path d="M12 10v9.5M7.5 13H4M20 13h-3.5M8 9.5L5 7M16 9.5L19 7M8 17.5L5 20M16 17.5L19 20" />
    </Glyph>
  ),
  // Sprint Review: the screen the work is demoed on.
  'sprint-review': (
    <Glyph>
      <Prims prims={lucidePresentation} />
    </Glyph>
  ),
};
