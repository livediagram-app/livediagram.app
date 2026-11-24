// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PortalMenu } from './TabPortalMenu';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', () => ({
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// View As Diagram in a Board tab's menu (docs/specs/026-plan/view-as-diagram.md "Where"): a row after Export, only when
// the tab bar offers it (a Board tab, for those who may change tabs).
type Props = ComponentProps<typeof PortalMenu>;
const noop = () => {};
const anchor = () => document.body.appendChild(document.createElement('button'));
const props = (over: Partial<Props> = {}): Props => ({
  anchor: anchor(),
  onClose: noop,
  onRename: noop,
  onDuplicate: noop,
  onClearContent: noop,
  onImport: noop,
  onExport: noop,
  onToggleLock: noop,
  locked: false,
  folders: [],
  currentFolder: null,
  onMoveToFolder: noop,
  onRemoveFromFolder: noop,
  onSetFolderColour: noop,
  onDelete: noop,
  canDelete: true,
  canClearContent: true,
  ...over,
});

afterEach(() => cleanup());

describe('View As Diagram in the tab menu', () => {
  it('is a row when offered, and asks when chosen', () => {
    const onViewAsDiagram = vi.fn();
    render(<PortalMenu {...props({ onViewAsDiagram })} />);
    fireEvent.click(screen.getByRole('button', { name: 'View As Diagram' }));
    expect(onViewAsDiagram).toHaveBeenCalledOnce();
  });

  it('is absent when not offered', () => {
    render(<PortalMenu {...props()} />);
    expect(screen.queryByRole('button', { name: 'View As Diagram' })).toBeNull();
  });
});
