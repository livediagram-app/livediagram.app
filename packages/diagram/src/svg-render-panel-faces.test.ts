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
    expect(svg).toContain('>Resolved<');
    expect(svg).toContain('Reopen Thread');
    expect(svg).not.toContain('Reply…');
  });
});

describe('Action panel export', () => {
  it('offers Add Action with no actions', () => {
    const svg = svgOf(createShape('action-card', 0, 0) as ShapeElement);
    expect(svg).toContain('No Actions Yet');
    expect(svg).toContain('Add Action');
  });

  it('draws a row per action with its assignee, and the open count', () => {
    const svg = svgOf({
      ...(createShape('action-card', 0, 0) as ShapeElement),
      actions: [action('open'), { ...action('done'), id: 'b', name: 'Load test' }],
    });
    for (const s of ['Confirm the retry', 'Load test', 'Sam Lee', '1 OPEN', '>Add Action<'])
      expect(svg).toContain(s);
  });

  it('reads a card saved with a single action, and says All done once finished', () => {
    const svg = svgOf({
      ...(createShape('action-card', 0, 0) as ShapeElement),
      action: action('done'),
    });
    expect(svg).toContain('Confirm the retry');
    expect(svg).toContain('>All Done<');
    expect(svg).toMatch(/text-decoration="line-through">Confirm the retry budget</);
  });
});
