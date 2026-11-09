import { afterEach, describe, expect, it } from 'vitest';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { modalClosed, modalOpened, openModalCount } from '@liveworkspace/workbench/lib/modal-guard';
import { walkInputBlocked } from './walk-guard';

// docs/specs/008-canvas/avatar-mode.md "Not over a start": a dialog or a start screen in front of the canvas holds
// every walking input back.
describe('walkInputBlocked', () => {
  afterEach(() => {
    setStartPanelOpen(false);
    while (openModalCount() > 0) modalClosed();
  });

  it('lets the walk through with nothing in front of the canvas', () => {
    expect(walkInputBlocked()).toBe(false);
  });

  it('holds the walk while a start screen (Start a Space) is open, and lets it go once it closes', () => {
    setStartPanelOpen(true);
    expect(walkInputBlocked()).toBe(true);
    setStartPanelOpen(false);
    expect(walkInputBlocked()).toBe(false);
  });

  it('holds the walk while a modal dialog is open', () => {
    modalOpened();
    expect(walkInputBlocked()).toBe(true);
    modalClosed();
    expect(walkInputBlocked()).toBe(false);
  });
});
