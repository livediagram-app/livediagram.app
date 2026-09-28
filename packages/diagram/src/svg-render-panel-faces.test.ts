import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import { createShape } from './factories';
import type { ShapeElement, Tab } from './index';

// The Comment and Action panels export the way they look on the canvas
// (docs/specs/012-collaboration/comment-pin.md "The look", docs/specs/012-collaboration/action-panel.md "The card").

const svgOf = (el: ShapeElement) =>
  renderElementsToSvg({ id: 't', name: 'Tab', elements: [el] } as unknown as Tab);

const comment = (i: number, name: string, text: string) => ({
  id: `c${i}`,
  text,
  createdAt: 1_700_000_000_000 + i,
  authorName: name,
  authorColor: '#2563eb',
});

const action = (status: 'open' | 'done') => ({
  id: 'a',
  name: 'Confirm the retry budget',
  description: 'Check p99 latency first.',
  assignee: { userId: 'u', name: 'Sam Lee' },
  teamId: null,
  assignerId: 'x',
  assignerName: 'Priya',
  status,
  createdAt: 0,
  updatedAt: 0,
});

describe('Comment panel export', () => {
  it('invites a first comment when the thread is empty', () => {
    const svg = svgOf(createShape('comment-pin', 0, 0) as ShapeElement);
    expect(svg).toContain('Start the Conversation');
    expect(svg).toContain('Write a comment…');
  });

  it('draws the thread as authored bubbles with the composer', () => {
    const el = {
      ...(createShape('comment-pin', 0, 0) as ShapeElement),
      commentThread: {
        resolved: false,
        comments: [comment(1, 'Tom', 'Should this be async?'), comment(2, 'Priya', 'Agreed.')],
      },
    };
    const svg = svgOf(el);
    for (const s of ['Tom', 'Priya', 'Should this be async?', 'Agreed.', 'Reply…'])
      expect(svg).toContain(s);
  });

  it('drops the composer and says Resolved once resolved', () => {
    const el = {
      ...(createShape('comment-pin', 0, 0) as ShapeElement),
      commentThread: { resolved: true, comments: [comment(1, 'Tom', 'Done here.')] },
    };
    const svg = svgOf(el);
    expect(svg).toContain('RESOLVED');
    expect(svg).not.toContain('Reply…');
  });
});

describe('Action panel export', () => {
  it('offers Set Up Action with no action', () => {
    const svg = svgOf(createShape('action-card', 0, 0) as ShapeElement);
    expect(svg).toContain('No Action Yet');
    expect(svg).toContain('Set Up Action');
  });

  it('shows the name, the Open chip, the assignee and Mark Complete', () => {
    const svg = svgOf({
      ...(createShape('action-card', 0, 0) as ShapeElement),
      action: action('open'),
    });
    for (const s of [
      'Confirm the retry',
      'Open',
      'Assigned to Sam Lee',
      'from Priya',
      'Mark Complete',
    ])
      expect(svg).toContain(s);
  });

  it('turns to Done and Reopen once complete', () => {
    const svg = svgOf({
      ...(createShape('action-card', 0, 0) as ShapeElement),
      action: action('done'),
    });
    expect(svg).toContain('Done');
    expect(svg).toContain('Reopen');
    expect(svg).not.toContain('Mark Complete');
  });
});
