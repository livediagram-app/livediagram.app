// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type ElementAction } from '@livediagram/document';
import { elementIndicatorItems, useElementIndicators } from './useElementIndicators';

// docs/specs/008-canvas/element-indicators.md: which indicators an element carries, and which
// elements show theirs on their own face instead.

const handlers = () => ({
  onFollowLink: vi.fn(),
  onOpenComments: vi.fn(),
  onOpenAction: vi.fn(),
  onOpenNote: vi.fn(),
  tabSummaries: [],
});
const action = (status: 'open' | 'done', name: string | null = 'Sam Reed'): ElementAction => ({
  id: 'a',
  name: 'Follow up',
  description: '',
  assignee: { userId: 'u_sam', name },
  teamId: null,
  assignerId: 'me',
  assignerName: null,
  status,
  createdAt: 0,
  updatedAt: 0,
});
const thread = (n: number, resolved = false) => ({
  resolved,
  comments: Array.from({ length: n }, (_, i) => ({
    id: String(i),
    text: 'c',
    authorId: 'me',
    authorName: 'Me',
    authorColor: '#000',
    createdAt: 0,
  })),
});
const kinds = (el: BoxedElement, mind?: { editOutline: () => void; tidy: () => void }) =>
  elementIndicatorItems(el, handlers(), mind).map((i) => i.kind);

describe('elementIndicatorItems', () => {
  it('lists everything a shape carries, with a mind root’s commands first', () => {
    const el = {
      ...createShape('square', 0, 0),
      link: { kind: 'url', url: 'https://example.com' },
      note: 'A note',
      action: action('open'),
      commentThread: thread(2),
    } as BoxedElement;
    expect(kinds(el, { editOutline: vi.fn(), tidy: vi.fn() })).toEqual([
      'outline',
      'tidy',
      'link',
      'note',
      'action',
      'comment',
    ]);
  });

  it('opens what each one stands for', () => {
    const h = handlers();
    const link = { kind: 'url', url: 'https://example.com' } as const;
    const el = {
      ...createShape('square', 0, 0),
      link,
      note: 'n',
      action: action('open'),
      commentThread: thread(1),
    } as BoxedElement;
    for (const item of elementIndicatorItems(el, h)) item.onClick();
    expect(h.onFollowLink).toHaveBeenCalledWith(link);
    expect(h.onOpenNote).toHaveBeenCalledWith(el.id);
    expect(h.onOpenAction).toHaveBeenCalledWith(el.id);
    expect(h.onOpenComments).toHaveBeenCalledWith(el.id);
  });

  it('leaves out a done action, resolved comments and an unlinked kind', () => {
    const el = {
      ...createShape('square', 0, 0),
      link: { kind: 'element', elementId: 'x' },
      action: action('done'),
      commentThread: thread(3, true),
    } as unknown as BoxedElement;
    expect(kinds(el)).toEqual([]);
  });

  it('names an unnamed assignee and still colours their disc', () => {
    const el = { ...createShape('square', 0, 0), action: action('open', '  ') } as BoxedElement;
    const item = elementIndicatorItems(el, handlers())[0]!;
    expect(item.hoverCard?.description).toBe('Assigned to a teammate');
    expect(item.assignee?.initials).toBeTruthy();
    expect(item.assignee?.color).toMatch(/^#|^hsl|^rgb/);
  });

  it('colours an invited member by their member id, and a nameless one by the name', () => {
    const invited = {
      ...createShape('square', 0, 0),
      action: { ...action('open', 'Ada'), assignee: { userId: null, memberId: 'm1', name: 'Ada' } },
    } as BoxedElement;
    const unclaimed = {
      ...createShape('square', 0, 0),
      action: { ...action('open', 'Ada'), assignee: { userId: null, name: 'Ada' } },
    } as BoxedElement;
    const a = elementIndicatorItems(invited, handlers())[0]!.assignee!.color;
    const b = elementIndicatorItems(unclaimed, handlers())[0]!.assignee!.color;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
  });

  it('skips what an element already shows on its own face', () => {
    const pin = { ...createShape('comment-pin', 0, 0), commentThread: thread(2) } as BoxedElement;
    expect(kinds(pin)).toEqual([]);
    const panel = { ...createShape('action-card', 0, 0), action: action('open') } as BoxedElement;
    expect(kinds(panel)).toEqual([]);
    const card = {
      id: 'c',
      type: 'link-card',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      link: { kind: 'url', url: 'https://example.com' },
    } as unknown as BoxedElement;
    expect(kinds(card)).toEqual([]);
  });

  it('gives an annotation no note indicator, and a margin note nothing at all', () => {
    const annotation = {
      id: 'n',
      type: 'annotation',
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      note: 'Its marker is the note',
      commentThread: thread(1),
    } as unknown as BoxedElement;
    expect(kinds(annotation)).toEqual(['comment']);
    const margin = { ...annotation, articleNote: { flow: 'f' } } as unknown as BoxedElement;
    expect(kinds(margin)).toEqual([]);
  });

  it('shows no note without a way to open it', () => {
    const el = { ...createShape('square', 0, 0), note: 'n' } as BoxedElement;
    expect(elementIndicatorItems(el, { ...handlers(), onOpenNote: undefined })).toEqual([]);
  });
});

describe('useElementIndicators', () => {
  const label = {
    text: 'Cloud',
    textSize: 'md',
    padding: 14,
    alignX: 'center',
    alignY: 'middle',
  } as const;

  it('places the cluster and moves an icon-and-label block out of its way', () => {
    const el = {
      ...createShape('cloud', 0, 0),
      width: 270,
      height: 180,
      iconId: 'cloud',
      iconPosition: 'above',
      note: 'n',
      action: action('open'),
      commentThread: thread(2),
      link: { kind: 'url', url: 'https://example.com' },
    } as BoxedElement;
    const { result } = renderHook(() =>
      useElementIndicators(el, handlers(), { ...label, inlineIcon: true }, 8),
    );
    expect(result.current.items).toHaveLength(4);
    expect(result.current.layout?.form).toBe('top');
    expect(result.current.layout?.inset.top).toBeGreaterThan(0);
  });

  it('treats a circle as fully round and lays out nothing without indicators', () => {
    const el = { ...createShape('circle', 0, 0), width: 200, height: 200 } as BoxedElement;
    const { result } = renderHook(() =>
      useElementIndicators(el, handlers(), { ...label, inlineIcon: false }, 8),
    );
    expect(result.current.cornerPx).toBe(Infinity);
    expect(result.current.items).toEqual([]);
    expect(result.current.layout).toBeNull();
  });

  it('defaults a side icon to the left of the label', () => {
    const el = {
      ...createShape('square', 0, 0),
      width: 260,
      height: 120,
      iconId: 'star',
      note: 'n',
    } as BoxedElement;
    const { result } = renderHook(() =>
      useElementIndicators(el, handlers(), { ...label, text: 'Box', inlineIcon: true }, 8),
    );
    expect(result.current.layout?.form).toBe('top');
  });

  it('lays out indicators on an element that is not a shape', () => {
    const text = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      width: 300,
      height: 120,
      label: 'Notes',
      note: 'n',
    } as unknown as BoxedElement;
    const { result } = renderHook(() =>
      useElementIndicators(text, handlers(), { ...label, text: 'Notes', inlineIcon: false }, 0),
    );
    expect(result.current.cornerPx).toBe(0);
    expect(result.current.layout?.form).toBe('top');
  });
});
