// Timeline renderer contracts (spec/138 §7).
//
// The components in this folder know how to lay a feed out; they know
// nothing about diagrams, teams, or routes. A consumer supplies a
// registry of renderers keyed by source type, and each renderer turns
// one event into the parts of a bubble. That split is what lets the
// same components later back a per-diagram or per-team feed without
// inheriting the Explorer's copy.

import type { ReactNode } from 'react';
import type { TimelineEvent } from '@livediagram/api-schema';

export type { TimelineEvent };

// A per-bubble control. Lives in the bubble's right strip alongside
// anything else the renderer adds, hover-revealed. Renderers never
// render their own buttons inline — one predictable place for "things
// you can do to this event" is worth more than the layout freedom.
export type TimelineBubbleAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

export type TimelineBubbleRender = {
  // Left-strip glyph.
  icon: ReactNode;
  // Headline. Falls back to the event's own title.
  label?: ReactNode;
  // Longer line under the headline. Falls back to the description.
  description?: ReactNode;
  // Quiet third line (a count, a timestamp, a role).
  meta?: ReactNode;
  // Makes the whole bubble clickable. Preferred over an action button
  // for "open the thing this is about" — a bubble that navigates
  // somewhere should be one big target, not a small one.
  onClick?: () => void;
  actions?: TimelineBubbleAction[];
};

export type TimelineRendererContext = {
  // The owner id of whoever is looking. Renderers compare it against
  // `event.actorId` to choose "You worked on X" over "Priya edited X",
  // which is what lets one stored row serve the whole audience.
  viewerId: string | null;
};

export type TimelineRenderer = (
  event: TimelineEvent,
  ctx: TimelineRendererContext,
) => TimelineBubbleRender;

export type TimelineRendererRegistry = Record<string, TimelineRenderer>;

// List, or the month grid. There is no 'favourites' mode: starring is
// out of scope for v1 (spec/138 non-goals).
export type TimelineMode = 'list' | 'calendar';
