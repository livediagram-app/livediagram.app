// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartFromTemplates } from './StartFromTemplates';

// docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const mount = (onChoose = vi.fn(), foot: { onDescribe?: () => void; onImport?: () => void } = {}) =>
  render(<StartFromTemplates onChoose={onChoose} {...foot} />);
const TITLE = 'Start Your Knowledgebase';

describe('StartFromTemplates', () => {
  it('names its start', () => {
    mount();
    expect(screen.getByRole('heading', { name: TITLE })).toBeTruthy();
  });

  it('leads with Blank Knowledgebase, and offers whole knowledgebases, never a page kind', () => {
    const onChoose = vi.fn();
    mount(onChoose);
    expect(document.querySelector('[data-rail]')!.getAttribute('data-rail')).toBe('start');
    expect(document.querySelector('[data-start-card]')!.textContent).toContain(
      'Blank Knowledgebase',
    );
    fireEvent.click(screen.getByRole('button', { name: /^Blank Knowledgebase/ }));
    expect(onChoose).toHaveBeenCalledWith('blank');
    expect(
      [...document.querySelectorAll('[data-rail]')].map((r) => r.getAttribute('data-rail')),
    ).toEqual([
      'start',
      'team',
      'engineering',
      'product',
      'support',
      'operations',
      'community',
      'education',
      'personal',
    ]);
    for (const word of ['Slide', 'Infographic', 'Canvas'])
      expect(document.body.textContent).not.toContain(`Blank ${word}`);
  });

  it('shows a structure as its knowledgebase and page count, and chooses it by id', () => {
    const onChoose = vi.fn();
    mount(onChoose);
    fireEvent.click(document.querySelector('[data-rail="engineering"]')!);
    const card = document.querySelector<HTMLElement>('[data-start-card="engineering-handbook"]')!;
    expect(card.textContent).toContain('Engineering Handbook');
    expect(card.textContent).toContain('13 Pages');
    // Its picture: its top pages in the tree, Architecture chosen and opened, in Engineering's colour.
    expect(
      card.querySelector('[data-structure-art="engineering-handbook"]')?.textContent,
    ).toContain('OverviewArchitectureServicesData');
    fireEvent.click(card);
    expect(onChoose).toHaveBeenCalledWith('engineering-handbook');
  });

  it('offers Describe to Set Up as a Start card where it is offered', () => {
    const onChoose = vi.fn();
    mount(onChoose, { onDescribe: vi.fn() });
    const card = document.querySelector<HTMLElement>('[data-start-card="describe"]')!;
    expect(card.textContent).toContain('Describe to Set Up');
    fireEvent.click(card);
    expect(onChoose).toHaveBeenCalledWith('describe');
    cleanup();
    mount();
    expect(document.querySelector('[data-start-card="describe"]')).toBeNull();
  });

  it('finds a structure by a page title inside it', () => {
    mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a knowledgebase' }), {
      target: { value: 'common errors' },
    });
    expect(
      [...document.querySelectorAll('[data-start-card]')].map((c) =>
        c.getAttribute('data-start-card'),
      ),
    ).toEqual(['support-knowledgebase']);
  });

  it('offers Describe to Set Up and Import at the rail foot when given, each opening its dialog', () => {
    const onDescribe = vi.fn();
    const onImport = vi.fn();
    mount(vi.fn(), { onDescribe, onImport });
    fireEvent.click(document.querySelector('[data-rail="describe"]')!);
    expect(onDescribe).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector('[data-rail="import"]')!);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('offers neither where they are not given', () => {
    mount();
    expect(document.querySelector('[data-rail="describe"]')).toBeNull();
    expect(document.querySelector('[data-rail="import"]')).toBeNull();
  });

  it('cannot be closed: no ×, no grab handle, and Escape only clears a search', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(document.querySelector('[data-sheet-handle]')).toBeNull();
    const search = screen.getByRole('textbox', { name: 'Find a knowledgebase' });
    fireEvent.change(search, { target: { value: 'wiki' } });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.getByRole('heading', { name: TITLE })).toBeTruthy();
  });
});

// docs/specs/007-editor/start-diagramming.md "On a phone": the sheet stands on the tab bar while it shows, so the tabs
// stay in reach; with the bars folded away (a sideways phone) there is nothing to stand on.
describe('StartFromTemplates on a phone', () => {
  const frameOf = () =>
    screen.getByRole('heading', { name: TITLE }).closest('section')!.parentElement!;

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
    fireEvent.click(document.querySelector('[data-rail="engineering"]')!);
    expect(scroller.scrollTop).toBe(0);
  });
});
