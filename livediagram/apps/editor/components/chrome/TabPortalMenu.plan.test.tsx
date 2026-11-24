// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PortalMenu } from './TabPortalMenu';

vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', () => ({
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// Make Plan Cards in the tab menu (docs/specs/013-workspace/make-plan-cards.md "Where"): a row after Export, only when
// the tab bar offers it (the tab shown, with a shape that has words, in a session that may send).
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
  onCopyTo: noop,
  onToggleLock: noop,
  locked: false,
  selfId: 'me',
  otherDocuments: [],
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

describe('Make Plan Cards in the tab menu', () => {
  it('is a row when offered, and asks when chosen', () => {
    const onMakePlanCards = vi.fn();
    render(<PortalMenu {...props({ onMakePlanCards })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make Plan Cards' }));
    expect(onMakePlanCards).toHaveBeenCalledOnce();
  });

  it('is absent when not offered', () => {
    render(<PortalMenu {...props()} />);
    expect(screen.queryByRole('button', { name: 'Make Plan Cards' })).toBeNull();
  });
});
