// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  elementResourceOptions,
  resourceLinkModes,
  type ResourceTarget,
} from '../palette/element-resources';
import { ResourcesDialog } from './ResourcesDialog';

// Each product's docs/specs/008-canvas/element-menu-quick-bar.md "Resources".
afterEach(cleanup);

const MODES = resourceLinkModes({ mode: 'file', label: 'Canvas', detail: 'Another canvas' });
const handlers = () => ({
  onAssignAction: vi.fn(),
  onOpenComments: vi.fn(),
  onLinkElement: vi.fn(),
  onOpenNote: vi.fn(),
  onRemoveLink: vi.fn(),
  onRemoveNote: vi.fn(),
  linkModes: MODES,
  tabs: [{ id: 't2', name: 'Roadmap' }],
});
const LINKED: ResourceTarget = {
  id: 'sq',
  type: 'shape',
  link: { kind: 'tab', tabId: 't2' },
  note: 'Remember\nthe rest',
};

function open(target: ResourceTarget = { id: 'sq', type: 'shape' }, h = handlers()) {
  // What ran, in order, so "the dialog closes first" can be read off it.
  const order: string[] = [];
  const onClose = vi.fn(() => order.push('close'));
  for (const fn of [h.onAssignAction, h.onOpenComments, h.onLinkElement, h.onOpenNote])
    fn.mockImplementation(() => order.push('run'));
  const ui = (t: ResourceTarget) => (
    <ResourcesDialog
      elementName="Square"
      options={elementResourceOptions(t, h)}
      onClose={onClose}
    />
  );
  const view = render(ui(target));
  return { h, onClose, order, show: (t: ResourceTarget) => view.rerender(ui(t)) };
}
const option = (key: string) =>
  document.querySelector<HTMLButtonElement>(`[data-element-resources] [data-option="${key}"]`)!;
const choice = (key: string) =>
  document.querySelector<HTMLButtonElement>(`[data-choice="${key}"]`)!;
const screenName = () =>
  document.querySelector('[data-resources-screen]')?.getAttribute('data-resources-screen');

describe('ResourcesDialog', () => {
  it('wears the hero header and lists each option with what it is and what the element has', () => {
    open(LINKED);
    expect(screen.getByRole('heading', { name: 'Resources' })).toBeTruthy();
    expect(document.querySelector('[data-dialog-hero="resources"]')).toBeTruthy();
    expect(screen.getByText('What is attached to this Square.')).toBeTruthy();
    const rows = [...document.querySelectorAll('[data-element-resources] [data-option]')];
    expect(rows.map((r) => r.getAttribute('data-option'))).toEqual([
      'action',
      'comment',
      'link',
      'note',
    ]);
    expect(rows.map((r) => r.querySelector('[data-resource-state]')?.textContent)).toEqual([
      // What it has, once it has one; until then, what it is.
      'Work assigned to someone',
      'A thread to talk it over',
      'Tab: Roadmap',
      'Remember',
    ]);
    // Only what the element has is marked.
    expect(rows.map((r) => !!r.querySelector('[data-resource-on]'))).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(option('link').querySelector('[data-resource-verb]')?.textContent).toBe('Edit Link');
  });

  it('runs an option with no options of its own, closing the dialog first', () => {
    const { h, order } = open();
    expect(option('action').querySelector('[data-resource-verb]')?.textContent).toBe(
      'Assign Action',
    );
    fireEvent.click(option('action'));
    expect(h.onAssignAction).toHaveBeenCalledWith('sq');
    expect(order).toEqual(['close', 'run']);
  });

  it('opens a note not written yet straight away, and a written one on its own screen', () => {
    const { h, onClose } = open();
    fireEvent.click(option('note'));
    expect(h.onOpenNote).toHaveBeenCalledWith('sq');
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
    const linked = open(LINKED);
    fireEvent.click(option('note'));
    expect(linked.onClose).not.toHaveBeenCalled();
    expect(screenName()).toBe('note');
    // The whole note, not only its first line.
    expect(document.querySelector('[data-resource-summary]')?.textContent).toContain('the rest');
  });

  it('drills into Link under a back bar, and goes back to the list with focus on its row', () => {
    const { onClose } = open(LINKED);
    fireEvent.click(option('link'));
    expect(screenName()).toBe('link');
    expect(document.querySelector('[data-element-resources]')).toBeNull();
    const back = screen.getByRole('button', { name: /^Resources/ });
    // The bar names where it leads and where this is.
    expect(back.textContent).toBe('ResourcesLink');
    expect(document.activeElement).toBe(back);
    expect(
      [...document.querySelectorAll('[data-choice]')].map((c) => [
        c.getAttribute('data-choice'),
        !!c.querySelector('[data-choice-current]'),
      ]),
    ).toEqual([
      ['url', false],
      ['tab', true],
      ['file', false],
      ['remove', false],
    ]);
    fireEvent.click(back);
    expect(screenName()).toBe('list');
    expect(document.activeElement).toBe(option('link'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens the link picker on the chosen place, closing the dialog first', () => {
    const { h, order } = open(LINKED);
    fireEvent.click(option('link'));
    fireEvent.click(choice('url'));
    expect(h.onLinkElement).toHaveBeenCalledWith('sq', 'url');
    expect(order).toEqual(['close', 'run']);
  });

  it('removes inside the dialog and goes back to the list', () => {
    const { h, onClose, show } = open(LINKED);
    fireEvent.click(option('link'));
    fireEvent.click(choice('remove'));
    expect(h.onRemoveLink).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screenName()).toBe('list');
    // The element comes back without its link: the row reads as empty.
    show({ ...LINKED, link: undefined });
    expect(option('link').querySelector('[data-resource-state]')?.textContent).toBe(
      'A page or tab it opens',
    );
    expect(option('link').querySelector('[data-resource-on]')).toBeNull();
  });

  it('falls back to the list when the open option loses its options', () => {
    const { show } = open(LINKED);
    fireEvent.click(option('note'));
    expect(screenName()).toBe('note');
    // A collaborator removes the note while its screen is open.
    show({ ...LINKED, note: undefined });
    expect(screenName()).toBe('list');
  });

  it('moves between rows with the arrow keys, Home and End', () => {
    open(LINKED);
    option('action').focus();
    fireEvent.keyDown(option('action'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(option('comment'));
    fireEvent.keyDown(option('comment'), { key: 'End' });
    expect(document.activeElement).toBe(option('note'));
    fireEvent.keyDown(option('note'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(option('note'));
    fireEvent.keyDown(option('note'), { key: 'Home' });
    expect(document.activeElement).toBe(option('action'));
  });

  it('closes from the header', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
