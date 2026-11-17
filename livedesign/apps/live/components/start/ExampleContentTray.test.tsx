// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markTemplateExamples, type Element } from '@livedesign/design';
import { ExampleContentTray } from './ExampleContentTray';

// docs/specs/006-design/template-examples.md "Who sees it": an Editor's tray while the tab holds untouched example
// values; never a Participant's or a Viewer's (both read-only to the editor's structure), nor zen, an embed or a
// locked tab.

const clearExampleContent = vi.fn();
const keepExampleContent = vi.fn();
const marked = markTemplateExamples([
  { id: 's', type: 'sticky', x: 0, y: 0, width: 120, height: 120, label: 'Call the venue' },
] as Element[]);
let ctx: Record<string, unknown> = {};

vi.mock('@/app/design/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));

const editor = (over: Record<string, unknown> = {}) => ({
  hydrated: true,
  zenMode: false,
  embedMode: false,
  isReadOnly: false,
  can: { level: 'edit' },
  activeTab: { id: 't1', name: 'Tab 1', elements: marked },
  clearExampleContent,
  keepExampleContent,
  ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExampleContentTray', () => {
  it("offers an Editor Clear Example Content and Keep It, each the editor's own action", () => {
    ctx = editor();
    render(<ExampleContentTray />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Example Content' }));
    expect(clearExampleContent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Keep It' }));
    expect(keepExampleContent).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a Participant', { isReadOnly: true, can: { level: 'participate' } }],
    ['a Viewer', { isReadOnly: true, can: { level: 'view' } }],
    ['a session whose role is not edit, read-only or not', { can: { level: 'participate' } }],
    ['zen', { zenMode: true }],
    ['an embed', { embedMode: true }],
    ['before the editor hydrates', { hydrated: false }],
    ['a locked tab', { activeTab: { id: 't1', name: 'Tab 1', elements: marked, locked: true } }],
    [
      'a tab whose examples were changed',
      { activeTab: { id: 't1', name: 'Tab 1', elements: [{ ...marked[0]!, label: 'Mine' }] } },
    ],
  ])('shows nothing to %s', (_who, over) => {
    ctx = editor(over);
    render(<ExampleContentTray />);
    expect(screen.queryByRole('button', { name: 'Clear Example Content' })).toBeNull();
  });
});
