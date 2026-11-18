// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createText, type BoxedElement, type Tab } from '@livediagram/document';
import { BoxedElementView } from '@/components/canvas/BoxedElementView';
import { renderTabToSvg } from '@/lib/export-tab';

// docs/specs/008-canvas/canvas-and-palette.md "Text element": an empty text draws a faint "Text" prompt for an
// Editor only, never as content: not for a Participant or a Viewer, not on a locked tab or text, not exported.
afterEach(cleanup);

const PROMPT = '[data-empty-text-prompt]';

function viewOf(
  label: string,
  props: { readOnly?: boolean; tabLocked?: boolean; locked?: boolean } = {},
) {
  const element = { ...createText(0, 0), id: 't1', label, locked: props.locked } as BoxedElement;
  const { container } = render(
    <BoxedElementView
      element={element}
      isSelected={false}
      isEditing={false}
      isPaintMode={false}
      showHandles={false}
      showAnchors={false}
      onBeginDrag={vi.fn()}
      onBeginEdit={vi.fn()}
      onCommitLabel={vi.fn()}
      onCommitTable={vi.fn()}
      onCancelEdit={vi.fn()}
      onFollowLink={vi.fn()}
      onOpenComments={vi.fn()}
      onOpenAction={vi.fn()}
      onOpenNote={vi.fn()}
      isoDepth={0}
      onSetPageHeading={vi.fn()}
      onContextSelect={vi.fn()}
      tabLocked={props.tabLocked ?? false}
      tabSummaries={[]}
      readOnly={props.readOnly ?? false}
      remoteSelectors={[]}
    />,
  );
  return container;
}

describe('the empty text prompt', () => {
  it('shows an Editor where an empty text goes, hidden from screen readers', () => {
    const prompt = viewOf('').querySelector(PROMPT);
    expect(prompt?.textContent).toBe('Text');
    expect(prompt?.getAttribute('aria-hidden')).toBe('true');
    expect(viewOf('   ').querySelector(PROMPT)).not.toBeNull();
  });

  it('never shows over a text with words', () => {
    expect(viewOf('Our own words').querySelector(PROMPT)).toBeNull();
  });

  it('never shows to a Participant or a Viewer, on a locked tab or on a locked text', () => {
    expect(viewOf('', { readOnly: true }).querySelector(PROMPT)).toBeNull();
    expect(viewOf('', { tabLocked: true }).querySelector(PROMPT)).toBeNull();
    expect(viewOf('', { locked: true }).querySelector(PROMPT)).toBeNull();
  });

  it('is never exported', () => {
    const withLabel = (label: string): Tab => ({
      id: 'tab',
      name: 'Tab',
      elements: [{ ...createText(0, 0), label }],
    });
    // The control: a text whose words are "Text" exports them.
    expect(renderTabToSvg(withLabel('Text'))).toContain('>Text<');
    expect(renderTabToSvg(withLabel(''))).not.toContain('>Text<');
  });
});
