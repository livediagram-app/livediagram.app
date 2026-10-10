// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAG_HOVER_TOGGLE_MS, useDocumentDropTarget } from './useDocumentDropTarget';
import { DOCUMENT_DRAG_MIME, DOCUMENT_LOCAL_ONLY_DRAG_MIME } from './explorer-drag-mime';

function Target(
  props: Parameters<typeof useDocumentDropTarget>[1] & { onDrop?: (id: string) => void },
) {
  const { onDrop, ...opts } = props;
  const drop = useDocumentDropTarget(onDrop, opts);
  return (
    <div data-testid="target" data-over={drop.isDragOver} {...drop.handlers}>
      <span data-testid="child">Folder</span>
    </div>
  );
}

function transfer(types: string[], data: Record<string, string> = {}) {
  return { types, getData: (t: string) => data[t] ?? '', dropEffect: 'none' };
}
const docDrag = (id = 'd1', extra: string[] = []) =>
  transfer([DOCUMENT_DRAG_MIME, ...extra], { [DOCUMENT_DRAG_MIME]: id });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDocumentDropTarget', () => {
  it('rings while a document is over it and files it on drop', () => {
    const onDrop = vi.fn();
    render(<Target onDrop={onDrop} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: docDrag() });
    expect(target.dataset.over).toBe('true');
    fireEvent.drop(target, { dataTransfer: docDrag('d7') });
    expect(onDrop).toHaveBeenCalledWith('d7');
    expect(target.dataset.over).toBe('false');
  });

  it('ignores a drag that carries no document', () => {
    const onDrop = vi.fn();
    render(<Target onDrop={onDrop} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: transfer(['text/plain']) });
    expect(target.dataset.over).toBe('false');
    fireEvent.drop(target, { dataTransfer: transfer(['text/plain']) });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('refuses a document that lives only in this browser when asked to', () => {
    const onDrop = vi.fn();
    render(<Target onDrop={onDrop} refuseLocalOnly />);
    const target = screen.getByTestId('target');
    const drag = docDrag('d1', [DOCUMENT_LOCAL_ONLY_DRAG_MIME]);
    fireEvent.dragOver(target, { dataTransfer: drag });
    expect(target.dataset.over).toBe('false');
    fireEvent.drop(target, { dataTransfer: drag });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('toggles once after a long hover, not again while the hover lasts', () => {
    const onLongHover = vi.fn();
    render(<Target onDrop={vi.fn()} onLongHover={onLongHover} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: docDrag() });
    act(() => vi.advanceTimersByTime(DRAG_HOVER_TOGGLE_MS - 1));
    expect(onLongHover).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLongHover).toHaveBeenCalledTimes(1);
    fireEvent.dragOver(target, { dataTransfer: docDrag() });
    act(() => vi.advanceTimersByTime(DRAG_HOVER_TOGGLE_MS * 3));
    expect(onLongHover).toHaveBeenCalledTimes(1);
  });

  it('toggles again on the next long hover after the drag left', () => {
    const onLongHover = vi.fn();
    render(<Target onDrop={vi.fn()} onLongHover={onLongHover} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: docDrag() });
    act(() => vi.advanceTimersByTime(DRAG_HOVER_TOGGLE_MS));
    fireEvent.dragLeave(target);
    fireEvent.dragOver(target, { dataTransfer: docDrag() });
    act(() => vi.advanceTimersByTime(DRAG_HOVER_TOGGLE_MS));
    expect(onLongHover).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending toggle when the drag leaves early', () => {
    const onLongHover = vi.fn();
    render(<Target onDrop={vi.fn()} onLongHover={onLongHover} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: docDrag() });
    act(() => vi.advanceTimersByTime(DRAG_HOVER_TOGGLE_MS / 2));
    fireEvent.dragLeave(target);
    act(() => vi.advanceTimersByTime(DRAG_HOVER_TOGGLE_MS));
    expect(onLongHover).not.toHaveBeenCalled();
    expect(target.dataset.over).toBe('false');
  });

  it('keeps the hover while the drag only crosses into its own children', () => {
    const onLongHover = vi.fn();
    render(<Target onDrop={vi.fn()} onLongHover={onLongHover} />);
    const target = screen.getByTestId('target');
    fireEvent.dragEnter(target, { dataTransfer: docDrag() });
    fireEvent.dragOver(target, { dataTransfer: docDrag() });
    // Into the child: it enters the child (bubbling here) before it leaves the row itself.
    fireEvent.dragEnter(screen.getByTestId('child'), { dataTransfer: docDrag() });
    fireEvent.dragLeave(target);
    act(() => vi.advanceTimersByTime(DRAG_HOVER_TOGGLE_MS));
    expect(onLongHover).toHaveBeenCalledTimes(1);
    expect(target.dataset.over).toBe('true');
    // Out of the child and out of the row: now it has left.
    fireEvent.dragLeave(screen.getByTestId('child'));
    expect(target.dataset.over).toBe('false');
  });

  it('cancels a pending toggle on drop', () => {
    const onLongHover = vi.fn();
    render(<Target onDrop={vi.fn()} onLongHover={onLongHover} />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: docDrag() });
    fireEvent.drop(target, { dataTransfer: docDrag() });
    act(() => vi.advanceTimersByTime(DRAG_HOVER_TOGGLE_MS));
    expect(onLongHover).not.toHaveBeenCalled();
  });

  it('accepts nothing without a drop callback', () => {
    render(<Target />);
    const target = screen.getByTestId('target');
    fireEvent.dragOver(target, { dataTransfer: docDrag() });
    expect(target.dataset.over).toBe('false');
  });
});
