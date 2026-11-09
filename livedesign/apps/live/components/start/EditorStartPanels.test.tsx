// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyCardDismissed } from '@liveworkspace/workbench/components/canvas/empty-card-dismissed';
import type { TemplateKind } from '@livedesign/templates';
import { EditorStartPanels } from './EditorStartPanels';

// docs/specs/007-editor/start-diagramming.md "The first page": Blank Illustration lands nothing, so picking it closes
// the start as the × does; a template with content leaves the start to go with the emptiness.

const chooseTemplate = vi.fn(async (_kind: TemplateKind) => {});

vi.mock('@/app/design/[id]/EditorContext', () => ({
  useEditorContext: () => ({
    hydrated: true,
    zenMode: false,
    embedMode: false,
    pendingDraw: null,
    isReadOnly: false,
    activeTabConnected: false,
    editorMode: { mode: 'pages' },
    designId: 'd1',
    activeTab: { id: 't1', name: 'Tab 1', elements: [] },
    chooseTemplate,
  }),
}));

vi.mock('@/components/start/useTemplatePickMove', () => ({
  useTemplatePickMove: () => () => {},
}));

vi.mock('@/components/start/StartAgainTray', () => ({ StartAgainTray: () => null }));

// The start itself is loaded lazily (next/dynamic); a stand-in exposes its onTemplate.
vi.mock('next/dynamic', () => ({
  default: () =>
    function Start(props: { onTemplate: (kind: TemplateKind) => void }): ReactNode {
      return (
        <>
          <button onClick={() => props.onTemplate('blank-illustration')}>Blank Illustration</button>
          <button onClick={() => props.onTemplate('logo-design')}>Logo Design</button>
        </>
      );
    },
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  chooseTemplate.mockClear();
});

describe('EditorStartPanels picking a template', () => {
  it('Blank Illustration closes the start and still applies the pick', () => {
    render(<EditorStartPanels />);
    fireEvent.click(screen.getByText('Blank Illustration'));
    expect(emptyCardDismissed('t1:pages')).toBe(true);
    expect(chooseTemplate).toHaveBeenCalledWith('blank-illustration');
  });

  it('a template with content leaves the start open, for its content to close', () => {
    render(<EditorStartPanels />);
    fireEvent.click(screen.getByText('Logo Design'));
    expect(emptyCardDismissed('t1:pages')).toBe(false);
    expect(chooseTemplate).toHaveBeenCalledWith('logo-design');
  });
});
