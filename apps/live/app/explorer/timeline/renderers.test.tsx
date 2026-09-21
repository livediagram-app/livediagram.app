// @vitest-environment jsdom

// The renderers are the product's half of the Timeline (spec/138 §7):
// what a card is titled, what its reason line says, what sits under it,
// and where it goes on click. These pin the copy rules of §2 rather than
// any one string: subject is the thing, reason is the stored Title Case
// category, and the detail worth reading lands in the description.

import { describe, expect, it, vi } from 'vitest';
import type { TimelineEvent } from '@livediagram/ui';
import { TIMELINE_RENDERERS } from './renderers';

vi.mock('@/components/panels/DiagramThumbnail', () => ({
  DiagramThumbnail: () => null,
}));

const ME = 'me';
const ctx = { viewerId: ME };

function event(over: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 'e',
    sourceType: 'diagram',
    sourceId: 'd1',
    eventType: 'diagram_created',
    title: 'Diagram Created',
    description: 'stored description',
    occurredAt: 1_700_000_000_000,
    actorId: ME,
    snapshot: { diagramId: 'd1', diagramName: 'Payments' },
    ...over,
  } as TimelineEvent;
}

function render(e: TimelineEvent) {
  return TIMELINE_RENDERERS[e.sourceType]!(e, ctx);
}

describe('diagram cards', () => {
  it('titles the card with the diagram and leaves the reason to the stored title', () => {
    const r = render(event({}));
    expect(r.subject).toBe('Payments');
    expect(r.label).toBeUndefined();
    // The stored description repeats what the title and reason already
    // say, so it's cleared rather than left to fall through.
    expect(r.description).toBeNull();
    expect(r.preview).toBeTruthy();
  });

  it('opens the diagram on click, except for a tombstone with no id', () => {
    expect(render(event({})).onClick).toBeTypeOf('function');
    const gone = render(
      event({
        eventType: 'diagram_deleted',
        title: 'Diagram Deleted',
        snapshot: { diagramName: 'Old' },
      }),
    );
    expect(gone.onClick).toBeUndefined();
    expect(gone.preview).toBeUndefined();
  });

  it('keeps a comment’s words as the description and puts the person in the meta', () => {
    const added = render(
      event({
        eventType: 'comment_added',
        title: 'Comment Added',
        description: 'Per-shard or global?',
        actorId: 'priya',
        snapshot: { diagramId: 'd1', diagramName: 'Payments', authorName: 'Priya' },
      }),
    );
    expect(added.description).toBeUndefined();
    expect(added.meta).toBe('Priya');
    const resolved = render(
      event({
        eventType: 'comment_resolved',
        title: 'Comment Resolved',
        description: 'Per-shard?',
      }),
    );
    expect(resolved.description).toBeUndefined();
    expect(resolved.meta).toBe('You');
  });

  it('gives an action card the action’s name as its description', () => {
    const assigned = render(
      event({
        eventType: 'action_assigned',
        title: 'Action Assigned',
        snapshot: {
          diagramId: 'd1',
          diagramName: 'Payments',
          actionName: 'Add the fallback path',
          assigneeName: 'Sam',
        },
      }),
    );
    expect(assigned.description).toBe('Add the fallback path');
    expect(assigned.meta).toBe('To Sam');
    const completed = render(
      event({
        eventType: 'action_completed',
        title: 'Action Completed',
        actorId: 'sam',
        snapshot: { diagramId: 'd1', diagramName: 'Payments', actionName: 'Wire up webhooks' },
      }),
    );
    expect(completed.description).toBe('Wire up webhooks');
    expect(completed.meta).toBe('by Someone');
  });

  it('says "by you" for the reader’s own edits and names anyone else', () => {
    const mine = render(event({ eventType: 'diagram_edited', title: 'Diagram Updated' }));
    expect(mine.meta).toBe('by you');
    const theirs = render(
      event({
        eventType: 'diagram_edited',
        title: 'Diagram Updated',
        actorId: 'priya',
        snapshot: { diagramId: 'd1', diagramName: 'Payments', authorName: 'Priya' },
      }),
    );
    expect(theirs.meta).toBe('by Priya');
  });
});

describe('team and account cards', () => {
  it('titles a team card with the team and opens the team page', () => {
    const r = render(
      event({
        sourceType: 'team',
        eventType: 'team_member_joined',
        title: 'Member Joined',
        actorId: 'priya',
        snapshot: { teamId: 't1', teamName: 'Platform Guild', memberName: 'Priya' },
      }),
    );
    expect(r.subject).toBe('Platform Guild');
    expect(r.meta).toBe('Priya');
    expect(r.onClick).toBeTypeOf('function');
    expect(r.preview).toBeUndefined();
  });

  it('opens a created folder, and leaves a deleted one inert', () => {
    const created = render(
      event({
        sourceType: 'account',
        eventType: 'folder_created',
        title: 'Folder Created',
        snapshot: { folderId: 'f1', folderName: 'Q3 planning' },
      }),
    );
    expect(created.subject).toBe('Q3 planning');
    expect(created.onClick).toBeTypeOf('function');
    const deleted = render(
      event({
        sourceType: 'account',
        eventType: 'folder_deleted',
        title: 'Folder Deleted',
        snapshot: { folderName: 'Archive' },
      }),
    );
    expect(deleted.onClick).toBeUndefined();
  });

  it('counts uploaded images in the subject', () => {
    const r = render(
      event({
        sourceType: 'account',
        eventType: 'image_uploaded',
        title: 'Images Uploaded',
        snapshot: { count: 3 },
      }),
    );
    expect(r.subject).toBe('3 images');
  });
});
