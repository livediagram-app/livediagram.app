// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';
import { HINT_CLOSE_GRACE_MS, TOOLTIP_OPEN_DELAY_MS } from './hint/hint-constants';
import { resetHintRegistry } from './hint/hint-registry';

const mouse = { pointerType: 'mouse' };
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hint = () => screen.queryByRole('tooltip');

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetHintRegistry();
});

describe('Tooltip', () => {
  it('names the control after a 1 s hover, as an inverse pill', () => {
    render(
      <Tooltip label="Zoom in">
        <button type="button" aria-label="Zoom in" />
      </Tooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS - 1);
    expect(hint()).toBeNull();
    advance(1);
    expect(hint()).toHaveProperty('textContent', 'Zoom in');
    expect(hint()?.dataset.hint).toBe('tooltip');
    expect(hint()?.className).toContain('bg-slate-900');
    expect(hint()?.className).toContain('dark:bg-slate-700');
  });

  it('adds no box to the layout around its control', () => {
    const { container } = render(
      <Tooltip label="Zoom in">
        <button type="button" aria-label="Zoom in" />
      </Tooltip>,
    );
    expect((container.firstElementChild as HTMLElement).className).toBe('contents');
  });

  it('opens at once on keyboard focus', () => {
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ':focus-visible' || matches.call(this, selector);
    });
    render(
      <Tooltip label="Zoom in">
        <button type="button" aria-label="Zoom in" />
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button'));
    expect(hint()).not.toBeNull();
  });

  it('opens the next tooltip at once while warm', () => {
    render(
      <>
        <Tooltip label="Zoom in">
          <button type="button" aria-label="Zoom in" />
        </Tooltip>
        <Tooltip label="Zoom out">
          <button type="button" aria-label="Zoom out" />
        </Tooltip>
      </>,
    );
    const [zoomIn, zoomOut] = screen.getAllByRole('button') as [HTMLElement, HTMLElement];
    fireEvent.pointerEnter(zoomIn, mouse);
    advance(TOOLTIP_OPEN_DELAY_MS);
    fireEvent.pointerLeave(zoomIn, mouse);
    fireEvent.pointerEnter(zoomOut, mouse);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(hint()?.textContent).toBe('Zoom out');
  });

  it('waits the full delay again once the warm-up has passed', () => {
    render(
      <>
        <Tooltip label="Zoom in">
          <button type="button" aria-label="Zoom in" />
        </Tooltip>
        <Tooltip label="Zoom out">
          <button type="button" aria-label="Zoom out" />
        </Tooltip>
      </>,
    );
    const [zoomIn, zoomOut] = screen.getAllByRole('button') as [HTMLElement, HTMLElement];
    fireEvent.pointerEnter(zoomIn, mouse);
    advance(TOOLTIP_OPEN_DELAY_MS);
    fireEvent.pointerLeave(zoomIn, mouse);
    advance(HINT_CLOSE_GRACE_MS + 1000);
    fireEvent.pointerEnter(zoomOut, mouse);
    expect(hint()).toBeNull();
    advance(TOOLTIP_OPEN_DELAY_MS);
    expect(hint()?.textContent).toBe('Zoom out');
  });

  it('warns when the label is not the control name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Tooltip label="Hotspot">
        <button type="button" aria-label="Make this a pivotal event" />
      </Tooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS);
    expect(warn).toHaveBeenCalledWith('[tooltip] label is not the accessible name', {
      label: 'Hotspot',
      name: 'Make this a pivotal event',
    });
  });

  it('stays quiet when the label is the control name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Tooltip label="Untitled token">
        <p>Untitled token</p>
      </Tooltip>,
    );
    fireEvent.pointerEnter(screen.getByText('Untitled token'), mouse);
    advance(TOOLTIP_OPEN_DELAY_MS);
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders the child alone for an empty label', () => {
    const { container } = render(
      <Tooltip label="">
        <button type="button" aria-label="Zoom in" />
      </Tooltip>,
    );
    expect(container.firstElementChild?.tagName).toBe('BUTTON');
  });
});
