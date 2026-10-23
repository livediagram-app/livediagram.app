// @vitest-environment jsdom
// A tab window's menu reaches its Tab Window section (docs/specs/009-elements/tab-window.md "The menu"): the section
// lives in the Tools flyout, which the menu once never offered for a tab window, so a chosen tab could not be changed.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ShapeElement, Tab } from '@livedesign/design';

const editor = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/app/design/[id]/EditorContext', () => ({ useEditorContext: () => editor.value }));
vi.mock('@/app/design/[id]/useSelectTab', () => ({ useSelectTab: () => vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { ElementDataSections } from './ElementDataSections';

afterEach(cleanup);

const tabs = [
  { id: 'slides', name: 'Slides', elements: [] },
  { id: 'flow', name: 'Flow', elements: [] },
  { id: 'notes', name: 'Notes', elements: [] },
] as unknown as Tab[];

const flags = {
  isProgress: false,
  isRating: false,
  isChart: false,
  isLine: false,
  isCodeBlock: false,
  isChecklist: false,
  isLegend: false,
  isSankey: false,
  isMindNode: false,
  isEntity: false,
  isModeButton: false,
  isPortal: false,
  isSessionButton: false,
  isReveal: false,
  isPicker: false,
  isReactionPad: false,
  isEstimate: false,
  isAgenda: false,
  isDecision: false,
};

it("offers a tab window's Shows list, so its tab can be changed", () => {
  editor.value = {
    tabs,
    activeTab: tabs[0],
    can: { level: 'edit' },
    activeTabLocked: false,
    isOutOfScope: () => false,
  };
  const target = {
    id: 'w',
    type: 'shape',
    shape: 'tab-window',
    x: 0,
    y: 0,
    width: 640,
    height: 360,
    windowTabId: 'flow',
  } as ShapeElement;
  const open = () => ({ open: true, onToggle: () => {}, flush: true });
  render(
    <ElementDataSections
      props={{ elementStyle: { commit: vi.fn() } } as never}
      target={target}
      {...flags}
      sectionProps={open}
      flyoutProps={open}
    />,
  );
  expect(screen.getByText('Shows')).toBeTruthy();
  expect(screen.getByText('Notes')).toBeTruthy();
});
