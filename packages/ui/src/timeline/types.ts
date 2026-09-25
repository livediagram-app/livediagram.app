// Timeline renderer contracts (spec/138 §7).
//
// The components in this folder know how to lay a feed out; they know
// nothing about diagrams, teams, or routes. A consumer supplies a
// registry of renderers keyed by source type, and each renderer turns
// one event into the parts of a card. That split is what lets the
// same components back a per-diagram or per-team feed without
// inheriting the Explorer's copy.

import type { MouseEvent, ReactNode } from 'react';
import type { TimelineEvent } from '@livediagram/api-schema';
import type { TimelineStack } from './stacking';

export type { TimelineEvent };

export type TimelineCardRender = {
  // The event's glyph. Drawn small in the reason line, and large in the
  // preview box when the renderer supplies no preview.
  icon: ReactNode;
  // The card title: the SUBJECT of the event (a diagram's name, a
  // team's name). Falls back to the event's title when a renderer has
  // nothing more specific to say.
  subject?: ReactNode;
  // The reason line: why this card is on the feed. Falls back to the
  // stored event title, which is a Title Case category by contract
  // ("Diagram Created"); an override must keep that casing so cards and
  // collapsed stacks read the same.
  label?: ReactNode;
  // Free text under the reason line (a comment's words). `undefined`
  // means "use the stored description"; `null` means "show nothing".
  description?: ReactNode;
  // Quiet detail after the time: "by Priya", "Now: New name".
  meta?: ReactNode;
  // Fills the card's preview box (a diagram snapshot, say). Sized by the
  // card, so it should stretch to `h-full w-full`. When absent the box
  // shows the glyph on the event's tone tint instead, so every card in
  // a row is the same height whatever mix of kinds it holds.
  preview?: ReactNode;
  // Makes the whole card clickable. Preferred over a button for "open
  // the thing this is about": a card that navigates somewhere should
  // be one big target, not a small one.
  onClick?: () => void;
};

// The parts a HOST can add to a card that a renderer can't (spec/138
// §2.8): the ⋯ menu, which needs more than the event; a right-click
// handler that opens the same menu; the subject as the host knows it
// NOW (a diagram renamed since the event still shows its current name);
// and a full replacement for the title row's text (an inline rename
// input). All optional; a card with none is just a card.
export type TimelineCardSlots = {
  /** Replaces the subject text, keeping the card's own styling. */
  subject?: ReactNode;
  /** Replaces the whole subject node, styling included. */
  title?: ReactNode;
  menu?: ReactNode;
  onContextMenu?: (e: MouseEvent) => void;
};

export type TimelineCardSlotsFor = (event: TimelineEvent) => TimelineCardSlots | undefined;

// The same for a collapsed run (spec/138 §2.9): the host's ⋯ menu on a
// stack card, which acts on every member at once. Only the menu and the
// right-click apply — a stack's subject is the generic headline and is
// not the host's to replace.
export type TimelineStackSlotsFor = (
  stack: TimelineStack,
) => Pick<TimelineCardSlots, 'menu' | 'onContextMenu'> | undefined;

export type TimelineRendererContext = {
  // The owner id of whoever is looking. Renderers compare it against
  // `event.actorId` to choose "by you" over "by Priya", which is what
  // lets one stored row serve the whole audience.
  viewerId: string | null;
};

export type TimelineRenderer = (
  event: TimelineEvent,
  ctx: TimelineRendererContext,
) => TimelineCardRender;

export type TimelineRendererRegistry = Record<string, TimelineRenderer>;

// List or month grid. There is no week mode (it went with the card
// redesign, spec/138 §2.2) and no 'favourites' mode: starring is out of
// scope for v1 (spec/138 non-goals).
export type TimelineMode = 'list' | 'calendar';
