// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartFromTemplates } from './StartFromTemplates';

// docs/specs/007-editor/start-diagramming.md
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = (mode: 'workshop', onTemplate = vi.fn()) =>
  render(<StartFromTemplates key={mode} mode={mode} tabId="t1" onTemplate={onTemplate} />);

describe('StartFromTemplates', () => {
  it('names each mode its own start', () => {
    mount('workshop');
    expect(screen.getByRole('heading', { name: 'Start a Workshop' })).toBeTruthy();
    cleanup();
    mount('workshop');
    expect(screen.getByRole('heading', { name: 'Start a Workshop' })).toBeTruthy();
  });

  it('lands a chosen template, and a blank closes the panel', () => {
    const onTemplate = vi.fn();
    mount('workshop', onTemplate);
    fireEvent.click(document.querySelector('[data-start-card="sailboat"]')!);
    expect(onTemplate).toHaveBeenCalledWith('sailboat');
    fireEvent.click(document.querySelector('[data-start-card="blank-session"]')!);
    expect(onTemplate).toHaveBeenCalledWith('blank-session');
    expect(screen.queryByRole('heading', { name: 'Start a Workshop' })).toBeNull();
  });

  it('remembers a close on its tab', () => {
    mount('workshop');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Start a Workshop' })).toBeNull();
    cleanup();
    mount('workshop');
    expect(screen.queryByRole('heading', { name: 'Start a Workshop' })).toBeNull();
  });

  it('closes on Escape once its search has nothing to clear', () => {
    mount('workshop');
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'mind' } });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { name: 'Start a Workshop' })).toBeTruthy();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Start a Workshop' })).toBeNull();
  });
});

// docs/specs/007-editor/start-diagramming.md "On a phone": the sheet stands on the tab bar while it shows, so the tabs
// stay in reach; with the bars folded away (a sideways phone) there is nothing to stand on.
describe('StartFromTemplates on a phone', () => {
  const frameOf = () =>
    screen.getByRole('heading', { name: 'Start a Workshop' }).closest('section')!.parentElement!;

  it('stands on the edge with no tab bar showing', () => {
    mount('workshop');
    expect(frameOf().className).toContain('max-sm:pb-[calc(var(--start-floor)-8px)]');
    expect(frameOf().style.getPropertyValue('--start-floor')).toBe('16px');
  });

  it('stands on the tab bar where it shows', () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-editor-tabbar', '');
    bar.getBoundingClientRect = () =>
      ({ top: 616, left: 0, right: 390, width: 390, height: 48 }) as DOMRect;
    document.body.appendChild(bar);
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('innerHeight', 664);
    try {
      mount('workshop');
      expect(frameOf().style.getPropertyValue('--start-floor')).toBe('56px');
    } finally {
      vi.unstubAllGlobals();
      bar.remove();
    }
  });
});

describe('StartFromTemplates, switching category', () => {
  it('opens the picked category at the top of its cards', () => {
    mount('workshop');
    const scroller = document.querySelector('[data-start-card]')!.closest('.overflow-y-auto')!;
    scroller.scrollTop = 300;
    fireEvent.click(document.querySelector('[data-rail="planning"]')!);
    expect(scroller.scrollTop).toBe(0);
  });
});
