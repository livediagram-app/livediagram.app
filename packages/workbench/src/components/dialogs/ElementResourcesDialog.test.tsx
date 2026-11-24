// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResourceOption } from '../palette/element-resources';
import {
  ElementResourcesDialog,
  type ElementResourcesLinkParts,
  type ElementResourcesLinks,
} from './ElementResourcesDialog';
import type { ResourceLinkPick } from './ResourceLinkPanel';

// Each editor's docs/specs/008-canvas/element-menu-quick-bar.md "Resources": the workbench's one copy of the dialog,
// as livedesign, livediagram and liveplanner (links) and livedocuments (no links) hand it in. The list itself is
// ResourcesDialog's (its own tests); the link place's step is ResourceLinkPanel's: both stand in here as what they
// were handed.
vi.mock('./ResourcesDialog', () => ({
  ResourcesDialog: ({
    elementName,
    options,
    onClose,
  }: {
    elementName: string;
    options: readonly ResourceOption[];
    onClose: () => void;
  }) => (
    <div data-testid="resources" data-name={elementName}>
      {options.map((o) => o.key).join(',')}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));
const PICKS: ResourceLinkPick[] = [
  { kind: 'url', url: 'https://example.com' },
  { kind: 'tab', tabId: 't2' },
  { kind: 'file', app: 'livedesign', id: 'd9', name: 'Poster' },
  { kind: 'file', app: 'liveplanner', id: 'p4', name: 'Launch' },
];
vi.mock('./ResourceLinkPanel', () => ({
  ResourceLinkPanel: (props: {
    mode: unknown;
    current: unknown;
    tabs: unknown;
    currentTabId: string;
    hostId: string;
    onPick: (pick: ResourceLinkPick) => void;
  }) => (
    <div
      data-testid="panel"
      data-mode={JSON.stringify(props.mode)}
      data-current={JSON.stringify(props.current)}
      data-tabs={JSON.stringify(props.tabs)}
      data-tab={props.currentTabId}
      data-host={props.hostId}
    >
      {PICKS.map((pick, i) => (
        <button key={i} type="button" onClick={() => props.onPick(pick)}>
          Pick {i}
        </button>
      ))}
    </div>
  ),
}));

afterEach(cleanup);

type Link =
  | { kind: 'url'; url: string }
  | { kind: 'tab'; tabId: string }
  | { kind: 'element'; tabId: string; elementId: string }
  | { kind: 'design'; designId: string; name: string };
type Box = { id: string; link?: Link };

const OPTIONS: ResourceOption[] = [
  { key: 'comment', label: 'Comment', detail: '', verb: 'Add Comment', run: () => {} },
  { key: 'link', label: 'Link', detail: '', verb: 'Add Link', run: () => {} },
] as unknown as ResourceOption[];

function links(): ElementResourcesLinks<'design'> {
  return {
    app: 'livedesign',
    kind: 'design',
    hostId: 'host',
    tabs: [
      { id: 't1', name: 'Home' },
      { id: 't2', name: 'Roadmap' },
    ],
    currentTabId: 't1',
    onLink: vi.fn(),
    track: vi.fn(),
  };
}

function open(
  over: {
    openId?: string | null;
    target?: Box | undefined;
    withLinks?: ElementResourcesLinks<'design'> | undefined;
    options?: ResourceOption[];
  } = {},
) {
  // A key given as undefined means none, not the default.
  const openId = 'openId' in over ? (over.openId ?? null) : 'sq';
  const target = 'target' in over ? over.target : { id: 'sq' };
  const withLinks = 'withLinks' in over ? over.withLinks : links();
  const options = over.options ?? OPTIONS;
  const onClose = vi.fn();
  const handed: { parts?: ElementResourcesLinkParts } = {};
  const optionsOf = vi.fn((_t: Box, parts: ElementResourcesLinkParts | undefined) => {
    handed.parts = parts;
    return options;
  });
  render(
    <ElementResourcesDialog
      openId={openId}
      target={target}
      name={(t) => `Kind of ${t.id}`}
      options={optionsOf}
      links={withLinks}
      onClose={onClose}
    />,
  );
  return { onClose, optionsOf, handed, links: withLinks };
}

/** The link place's step, as the dialog draws it for `mode`. */
function step(parts: ElementResourcesLinkParts, mode: string) {
  const done = vi.fn();
  render(<>{parts.linkPanel(mode, done)}</>);
  const panel = screen.getByTestId('panel');
  const read = (key: string) => JSON.parse(panel.getAttribute(`data-${key}`)!) as unknown;
  return { done, panel, read };
}

describe('ElementResourcesDialog', () => {
  it("lists the editor's options for the element, under its kind's name", () => {
    const { optionsOf } = open();
    const dialog = screen.getByTestId('resources');
    expect(dialog.getAttribute('data-name')).toBe('Kind of sq');
    expect(dialog.textContent).toContain('comment,link');
    expect(optionsOf).toHaveBeenCalledWith({ id: 'sq' }, expect.any(Object));
  });

  it('closes through the editor', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes itself when its element is gone, and draws nothing', () => {
    const { onClose } = open({ target: undefined });
    expect(screen.queryByTestId('resources')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('draws nothing and stays put while it is closed', () => {
    const { onClose } = open({ openId: null, target: undefined });
    expect(screen.queryByTestId('resources')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('draws nothing when the element has no options', () => {
    const { onClose } = open({ options: [] });
    expect(screen.queryByTestId('resources')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hands an editor without links no link parts (livedocuments)', () => {
    const { handed } = open({ withLinks: undefined });
    expect(handed.parts).toBeUndefined();
  });

  it("hands the editor's tabs on, and removes a link with its telemetry", () => {
    const { handed, links } = open();
    expect(handed.parts!.tabs).toBe(links!.tabs);
    handed.parts!.onRemoveLink();
    expect(links!.onLink).toHaveBeenCalledWith(null);
    expect(links!.track).toHaveBeenCalledWith('Unlinked');
  });

  it('opens a web address step on the link it has', () => {
    const { handed } = open({ target: { id: 'sq', link: { kind: 'url', url: 'https://a.test' } } });
    const { read, panel } = step(handed.parts!, 'url');
    expect(read('mode')).toBe('url');
    expect(read('current')).toEqual({ url: 'https://a.test' });
    expect(read('tabs')).toEqual([
      { id: 't1', name: 'Home' },
      { id: 't2', name: 'Roadmap' },
    ]);
    expect(panel.getAttribute('data-tab')).toBe('t1');
    expect(panel.getAttribute('data-host')).toBe('host');
  });

  it('reads no address off a web link that holds none', () => {
    const { handed } = open({ target: { id: 'sq', link: { kind: 'url' } as Link } });
    expect(step(handed.parts!, 'url').read('current')).toEqual({});
  });

  it("opens the tabs step on a tab's link, and on an element's", () => {
    const tab = open({ target: { id: 'sq', link: { kind: 'tab', tabId: 't2' } } });
    expect(step(tab.handed.parts!, 'tab').read('current')).toEqual({ tabId: 't2' });
    cleanup();
    const element = open({
      target: { id: 'sq', link: { kind: 'element', tabId: 't2', elementId: 'e1' } },
    });
    expect(step(element.handed.parts!, 'tab').read('current')).toEqual({ tabId: 't2' });
  });

  it("opens this app's own files on its own link kind", () => {
    const { handed } = open({
      target: { id: 'sq', link: { kind: 'design', designId: 'd9', name: 'Poster' } },
    });
    const { read } = step(handed.parts!, 'design');
    expect(read('mode')).toEqual({ app: 'livedesign' });
    expect(read('current')).toEqual({ fileId: 'd9' });
  });

  it("opens another app's files on no current file", () => {
    const { handed } = open({ target: { id: 'sq' } });
    const { read } = step(handed.parts!, 'app:liveplanner');
    expect(read('mode')).toEqual({ app: 'liveplanner' });
    expect(read('current')).toEqual({});
  });

  it('sets each pick as its link, tracks it and returns to the list', () => {
    const { handed, links } = open();
    const { done } = step(handed.parts!, 'url');
    for (let i = 0; i < PICKS.length; i++)
      fireEvent.click(screen.getByRole('button', { name: `Pick ${i}` }));
    expect(vi.mocked(links!.onLink).mock.calls).toEqual([
      [{ kind: 'url', url: 'https://example.com' }],
      [{ kind: 'tab', tabId: 't2' }],
      // This app's own file keeps its own link kind; another product's is linked by its address.
      [{ kind: 'design', designId: 'd9', name: 'Poster' }],
      [{ kind: 'url', url: expect.stringContaining('p4') }],
    ]);
    expect(vi.mocked(links!.track).mock.calls).toEqual([
      ['Linked', 'Url'],
      ['Linked', 'Tab'],
      ['Linked', 'Design'],
      ['Linked', 'App'],
    ]);
    expect(done).toHaveBeenCalledTimes(4);
  });
});
