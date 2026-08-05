import { describe, expect, it } from 'vitest';
import { TIMELINE_EVENT_TYPES } from '@livediagram/api-schema';
import { eventTone, toneColor, toneSoftColor } from './eventTone';

// Colour is the fastest thing a reader takes from this feed, so the
// mapping is worth pinning. The failure mode these guard against is
// quiet: a new event type ships, nobody classifies it, and it renders
// in a tone that says the wrong thing about what happened.

describe('eventTone', () => {
  // The map is Record<KnownTimelineEventType, …>, so a missing entry is a build
  // failure now, not a test failure. This still earns its place: it catches the
  // OTHER way to leave an event unclassified, which is to write `'neutral'`
  // beside it and move on. Neutral is the right answer for an event type from a
  // newer worker; it is never the right answer for one this build knows about.
  it('classifies every event type it knows, deliberately — none left neutral', () => {
    const unclassified = TIMELINE_EVENT_TYPES.filter((type) => eventTone(type) === 'neutral');
    expect(unclassified).toEqual([]);
  });

  it('reads the list from the schema, not a copy of it', () => {
    // Guards the guard: this file used to hold its own hand-typed list of all
    // 38 types, which could only prove it agreed with itself.
    expect(TIMELINE_EVENT_TYPES.length).toBeGreaterThan(30);
  });

  it('reserves danger for destruction and lost access', () => {
    expect(eventTone('diagram_deleted')).toBe('danger');
    expect(eventTone('team_member_removed')).toBe('danger');
    expect(eventTone('team_deleted')).toBe('danger');
    // Revoking a token breaks whatever was using it — the same shape of
    // surprise as a deletion, even though nothing was destroyed.
    expect(eventTone('token_revoked')).toBe('danger');
  });

  // If everything worrying is red, nothing is. These are the near
  // misses that would dilute it.
  it('keeps ordinary and merely-structural events out of danger', () => {
    expect(eventTone('team_member_left')).toBe('structural');
    expect(eventTone('team_invite_declined')).toBe('structural');
    expect(eventTone('comment_resolved')).toBe('create');
    expect(eventTone('diagram_moved')).toBe('structural');
  });

  it('treats renames and team changes as structural', () => {
    expect(eventTone('diagram_renamed')).toBe('structural');
    expect(eventTone('team_member_joined')).toBe('structural');
    expect(eventTone('team_role_changed')).toBe('structural');
    expect(eventTone('share_link_created')).toBe('structural');
  });

  it('treats making and editing as create', () => {
    expect(eventTone('diagram_created')).toBe('create');
    expect(eventTone('diagram_edited')).toBe('create');
    expect(eventTone('comment_added')).toBe('create');
  });

  // The important half of the fallback: an event type from a newer
  // worker must not render as a deletion.
  it('falls to neutral for anything unmapped', () => {
    expect(eventTone('some_future_event')).toBe('neutral');
    expect(eventTone('')).toBe('neutral');
  });
});

describe('tone colours', () => {
  // The var lets the host theme light and dark; the fallback keeps the
  // components renderable with no CSS at all.
  it('reads a CSS variable with a literal fallback', () => {
    expect(toneColor('danger')).toMatch(/^var\(--ld-timeline-danger, #[0-9a-f]{6}\)$/);
    expect(toneSoftColor('create')).toMatch(/^var\(--ld-timeline-create-soft, rgba\(/);
  });
});
