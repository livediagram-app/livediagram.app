import { describe, expect, it, vi } from 'vitest';
import {
  describeElementLink,
  elementResourceOptions,
  resourceLinkModes,
  type ResourceTarget,
} from './element-resources';

// Each product's docs/specs/008-canvas/element-menu-quick-bar.md "Resources".
const MODES = resourceLinkModes({ mode: 'file', label: 'Canvas', detail: 'Another canvas' });
const SQUARE: ResourceTarget = { id: 'sq', type: 'shape' };

describe('elementResourceOptions', () => {
  it('offers only what the app hands a handler for, in order', () => {
    const all = {
      onAssignAction: vi.fn(),
      onOpenComments: vi.fn(),
      onLinkElement: vi.fn(),
      onOpenNote: vi.fn(),
    };
    expect(elementResourceOptions(SQUARE, all).map((o) => o.key)).toEqual([
      'action',
      'comment',
      'link',
      'note',
    ]);
    expect(
      elementResourceOptions(SQUARE, { onAssignAction: vi.fn(), onOpenNote: vi.fn() }).map(
        (o) => o.name,
      ),
    ).toEqual(['Action', 'Note']);
    expect(elementResourceOptions(SQUARE, {})).toEqual([]);
  });

  it('leaves Link to a link card and a video, whose link is their own category', () => {
    for (const type of ['link-card', 'video'])
      expect(
        elementResourceOptions({ id: 'x', type }, { onLinkElement: vi.fn() }).map((o) => o.key),
      ).toEqual([]);
  });

  it('says what the element has now', () => {
    const has: ResourceTarget = {
      ...SQUARE,
      action: { name: 'Confirm the budget', status: 'done' },
      commentThread: { comments: [{}, {}] },
      link: { kind: 'url', url: 'https://example.com/' },
      note: '  First line\nSecond  ',
    };
    const options = elementResourceOptions(has, {
      onAssignAction: vi.fn(),
      onOpenComments: vi.fn(),
      onLinkElement: vi.fn(),
      onOpenNote: vi.fn(),
    });
    expect(options.map((o) => [o.label, o.on, o.state])).toEqual([
      ['View Action', true, 'Done: Confirm the budget'],
      ['View Comments', true, '2 comments'],
      ['Edit Link', true, 'example.com'],
      ['Edit Note', true, 'First line'],
    ]);
    expect(
      elementResourceOptions(
        { ...SQUARE, commentThread: { comments: [{}] } },
        { onOpenComments: vi.fn() },
      )[0]?.state,
    ).toBe('1 comment');
  });

  it('gives a link its places, marks the one it has, and a way to take it off', () => {
    const onLinkElement = vi.fn();
    const onRemoveLink = vi.fn();
    const h = { onLinkElement, onRemoveLink, linkModes: MODES };
    const bare = elementResourceOptions(SQUARE, h)[0]!;
    expect(bare.choices?.map((c) => c.key)).toEqual(['url', 'tab', 'file']);
    const linked = elementResourceOptions(
      { ...SQUARE, link: { kind: 'element', tabId: 't', elementId: 'e' } },
      h,
    )[0]!;
    expect(linked.choices?.map((c) => [c.key, !!c.current, !!c.removes])).toEqual([
      ['url', false, false],
      ['tab', true, false],
      ['file', false, false],
      ['remove', false, true],
    ]);
    linked.choices?.find((c) => c.key === 'file')?.run();
    expect(onLinkElement).toHaveBeenCalledWith('sq', 'file');
    linked.choices?.find((c) => c.key === 'remove')?.run();
    expect(onRemoveLink).toHaveBeenCalledTimes(1);
    // The row itself still opens the picker as it stands, as it always did.
    linked.run();
    expect(onLinkElement).toHaveBeenLastCalledWith('sq');
  });

  it('keeps a link of a kind no place names editable where it was made', () => {
    const onLinkElement = vi.fn();
    const screenLink = elementResourceOptions(
      { ...SQUARE, link: { kind: 'screen' } },
      { onLinkElement, linkModes: MODES },
    )[0]!;
    expect(screenLink.choices?.[0]?.key).toBe('edit');
    screenLink.choices?.[0]?.run();
    expect(onLinkElement).toHaveBeenCalledWith('sq');
  });

  it('has no screen for a link without places, or for a note not written or not removable', () => {
    expect(elementResourceOptions(SQUARE, { onLinkElement: vi.fn() })[0]?.choices).toBeUndefined();
    const onOpenNote = vi.fn();
    const onRemoveNote = vi.fn();
    expect(
      elementResourceOptions(SQUARE, { onOpenNote, onRemoveNote })[0]?.choices,
    ).toBeUndefined();
    expect(
      elementResourceOptions({ ...SQUARE, note: 'Words' }, { onOpenNote })[0]?.choices,
    ).toBeUndefined();
    const note = elementResourceOptions(
      { ...SQUARE, note: 'Words' },
      { onOpenNote, onRemoveNote },
    )[0]!;
    expect(note.choices?.map((c) => c.key)).toEqual(['edit', 'remove']);
    note.choices?.[1]?.run();
    expect(onRemoveNote).toHaveBeenCalledWith('sq');
  });
});

describe('describeElementLink', () => {
  const tabs = [{ id: 't', name: 'Roadmap' }];
  it('reads each kind in a line', () => {
    expect(describeElementLink({ kind: 'url', url: 'http://a.example/b/' })).toBe('a.example/b');
    expect(describeElementLink({ kind: 'tab', tabId: 't' }, tabs)).toBe('Tab: Roadmap');
    expect(describeElementLink({ kind: 'tab', tabId: 'gone' }, tabs)).toBe('A tab');
    expect(describeElementLink({ kind: 'element', tabId: 't', elementId: 'e' }, tabs)).toBe(
      'An element on Roadmap',
    );
    expect(describeElementLink({ kind: 'project', projectId: 'p', name: 'Launch' })).toBe('Launch');
    expect(describeElementLink({ kind: 'screen' })).toBe('Linked');
  });
});
