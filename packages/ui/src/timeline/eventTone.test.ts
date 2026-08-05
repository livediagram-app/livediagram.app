import { describe, expect, it } from 'vitest';
import { eventTone, toneColor, toneSoftColor } from './eventTone';

// Colour is the fastest thing a reader takes from this feed, so the
// mapping is worth pinning. The failure mode these guard against is
// quiet: a new event type ships, nobody classifies it, and it renders
// in a tone that says the wrong thing about what happened.

// Every event type the worker emits (spec/138 §4). Keep in step with
// TimelineEventType — an unclassified one falling to neutral is fine,
// but it should be a decision, not a surprise.
const EMITTED = [
  'diagram_created',
  'diagram_renamed',
  'diagram_duplicated',
  'diagram_deleted',
  'diagram_moved',
  'diagram_edited',
  'diagram_offline',
  'diagram_synced',
  'comment_added',
  'comment_resolved',
  'action_assigned',
  'action_completed',
  'share_link_created',
  'share_link_expiring',
  'diagram_opened_by_visitor',
  'diagram_copied_by_visitor',
  'folder_created',
  'folder_deleted',
  'team_created',
  'team_invite_received',
  'team_invite_accepted',
  'team_invite_declined',
  'team_member_joined',
  'team_member_left',
  'team_member_removed',
  'team_role_changed',
  'team_diagram_added',
  'team_diagram_removed',
  'team_renamed',
  'team_deleted',
  'team_invite_link_enabled',
  'team_invite_link_disabled',
  'token_created',
  'token_revoked',
  'token_expiring',
  'theme_saved',
  'theme_deleted',
  'image_uploaded',
];

describe('eventTone', () => {
  it('classifies every event type the worker emits', () => {
    const unclassified = EMITTED.filter((type) => eventTone(type) === 'neutral');
    expect(unclassified).toEqual([]);
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
