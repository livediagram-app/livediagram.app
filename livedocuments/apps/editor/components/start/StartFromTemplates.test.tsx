// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartFromTemplates } from './StartFromTemplates';
import { closeStartForBlank } from './close-start-for-blank';

// docs/specs/007-editor/start-diagramming.md
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = (onTemplate = vi.fn(), tabId = 't1') =>
  render(<StartFromTemplates tabId={tabId} onTemplate={onTemplate} />);

describe('StartFromTemplates', () => {
  it('names its start', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
  });

  it('lands a chosen template', () => {
    const onTemplate = vi.fn();
    mount(onTemplate);
    fireEvent.click(document.querySelector('[data-start-card="blank-slide-deck"]')!);
    expect(onTemplate).toHaveBeenCalledWith('blank-slide-deck');
  });

  it('cannot be closed: no ×, no grab handle, and Escape only clears a search', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(document.querySelector('[data-sheet-handle]')).toBeNull();
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'slide' } });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
  });

  it('opens closed only for an explicit blank, per tab', () => {
    closeStartForBlank('t-blank', 'blank');
    mount(vi.fn(), 't-blank');
    expect(screen.queryByRole('heading', { name: 'Start Making Pages' })).toBeNull();
    cleanup();
    mount(vi.fn(), 't2');
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
  });
});

// docs/specs/007-editor/start-diagramming.md "On a phone": the sheet stands on the tab bar while it shows, so the tabs
// stay in reach; with the bars folded away (a sideways phone) there is nothing to stand on.
describe('StartFromTemplates on a phone', () => {
  const frameOf = () =>
    screen.getByRole('heading', { name: 'Start Making Pages' }).closest('section')!.parentElement!;

  it('stands on the edge with no tab bar showing', () => {
    mount();
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
      mount();
      expect(frameOf().style.getPropertyValue('--start-floor')).toBe('56px');
    } finally {
      vi.unstubAllGlobals();
      bar.remove();
    }
  });
});

describe('StartFromTemplates, switching category', () => {
  it('opens the picked category at the top of its cards', () => {
    mount();
    const scroller = document.querySelector('[data-start-card]')!.closest('.overflow-y-auto')!;
    scroller.scrollTop = 300;
    fireEvent.click(document.querySelector('[data-rail="team"]')!);
    expect(scroller.scrollTop).toBe(0);
  });
});
