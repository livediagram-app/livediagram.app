// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECENT_DIAGRAMS_KEY, RECENT_FAN_MIN } from '@livediagram/api-schema';
import { renderToStaticMarkup } from 'react-dom/server';
import { seededRandom } from '@livediagram/document';
import { HERO_FAN_OPENING, HERO_FAN_SLOTS, heroTemplate, shuffleFan } from '@/lib/hero-starts';
import { Hero } from './Hero';
import { HERO_FAN_SWAP_MS } from './HeroFan';

// docs/specs/019-marketing/marketing-site.md "Hero": the badge and the question, the template search
// with the Start Blank menu in its bar, a returning visitor's recent diagrams, and the dealing fan.

let reduceMotion = false;
let observed: ((entries: { isIntersecting: boolean }[]) => void) | null = null;

beforeEach(() => {
  reduceMotion = false;
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('reduce') ? reduceMotion : true,
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        observed = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const fanTitles = () =>
  screen
    .getAllByRole('link')
    .filter((a) => a.getAttribute('href')?.includes('via=Home.HeroFan'))
    .map((a) => a.textContent?.replace('Create a ', ''));

describe('the hero', () => {
  it('asks the question under its two promise badges', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'What are you making today?',
    );
    const promises = within(screen.getByRole('list', { name: 'Our promises' })).getAllByRole(
      'listitem',
    );
    expect(promises.map((p) => p.textContent)).toEqual([
      'Free and open source',
      'No sign-up to start',
    ]);
  });

  it('lists the best matches as links that create them, once something is typed', () => {
    render(<Hero />);
    const box = screen.getByLabelText('Search templates');
    fireEvent.focus(box);
    expect(screen.queryByRole('list', { name: 'Matching templates' })).toBeNull();
    fireEvent.change(box, { target: { value: 'retro' } });
    const list = screen.getByRole('list', { name: 'Matching templates' });
    const links = within(list).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]!.getAttribute('href')).toBe('/new?template=retrospective&via=Home.HeroSearch');
    expect(screen.getByRole('link', { name: /Browse every template/ }).getAttribute('href')).toBe(
      '#templates',
    );
  });

  it('opens the top match on Enter, walks the list with the arrows, and clears on Escape', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(<Hero />);
    const box = screen.getByLabelText('Search templates') as HTMLInputElement;
    box.focus();
    fireEvent.change(box, { target: { value: 'kanban' } });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    const first = within(screen.getByRole('list', { name: 'Matching templates' })).getAllByRole(
      'link',
    )[0]!;
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(box);
    fireEvent.submit(box.form!);
    expect(assign).toHaveBeenCalledWith('/new?template=kanban&via=Home.HeroSearch');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(box.value).toBe('');
  });

  it('closes the matches when focus moves to the Start Blank menu in the bar', () => {
    render(<Hero />);
    const box = screen.getByLabelText('Search templates');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'retro' } });
    expect(screen.getByRole('list', { name: 'Matching templates' })).toBeTruthy();
    const blank = within(screen.getByRole('search')).getByRole('button', { name: /Start Blank/ });
    fireEvent.focus(blank);
    expect(screen.queryByRole('list', { name: 'Matching templates' })).toBeNull();
    fireEvent.focus(box);
    expect(screen.getByRole('list', { name: 'Matching templates' })).toBeTruthy();
  });

  it('says so when nothing matches', () => {
    render(<Hero />);
    const box = screen.getByLabelText('Search templates');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'zzqqxx' } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('offers every blank from its Start Blank menu, as the hero’s own funnel slots', () => {
    render(<Hero />);
    const form = screen.getByRole('search');
    const hrefs = within(form)
      .getAllByRole('menuitem', { hidden: true })
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/new?blank=1&via=Home.HeroBlankDraw',
      '/new?template=whiteboard&via=Home.HeroBlankWhiteboard',
      '/new?template=blank-session&via=Home.HeroBlankSession',
      '/new?template=blank-illustration&via=Home.HeroBlankIllustration',
      '/new?template=blank-plan&via=Home.HeroBlankPlan',
    ]);
  });

  it('keeps the template fan below RECENT_FAN_MIN recent diagrams, then deals theirs and Explorer Home', () => {
    const note = (n: number) =>
      JSON.stringify({
        v: 1,
        diagrams: Array.from({ length: n }, (_, i) => ({
          id: `d${i + 1}`,
          name: `Diagram ${i + 1}`,
          savedAt: Date.now() - (i + 1) * 3600e3,
          mode: 'diagram',
        })),
      });
    localStorage.setItem(RECENT_DIAGRAMS_KEY, note(RECENT_FAN_MIN - 1));
    const few = render(<Hero />);
    expect(fanTitles()).toHaveLength(HERO_FAN_SLOTS);
    expect(screen.queryByRole('link', { name: /Explorer Home/ })).toBeNull();
    few.unmount();

    localStorage.setItem(RECENT_DIAGRAMS_KEY, note(6));
    render(<Hero />);
    expect(fanTitles()).toEqual([]);
    const docs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((h) => h?.startsWith('/document/'));
    expect(docs).toEqual(['/document/d1', '/document/d2', '/document/d3', '/document/d4']);
    // The save time sits at the card's foot, after its preview (out of sight until the card lifts).
    const card = screen
      .getAllByRole('link')
      .find((l) => l.getAttribute('href') === '/document/d1')!;
    expect(card.lastElementChild?.textContent).toMatch(/ago$/);
    expect(card.firstElementChild?.textContent).toBe('Diagram 1');
    expect(screen.getByRole('link', { name: /Explorer Home/ }).getAttribute('href')).toBe(
      '/explorer/home',
    );
  });
});

describe('the fan', () => {
  // A fixed random source, so this visit's shuffle is known.
  const deck = () => shuffleFan(seededRandom(7));
  const titles = (kinds: readonly string[]) => kinds.map((k) => heroTemplate(k as never).title);
  beforeEach(() => {
    const random = seededRandom(7);
    vi.spyOn(Math, 'random').mockImplementation(random);
  });

  it("serves a fixed opening hand, then deals this visit's shuffled one over it", () => {
    const html = renderToStaticMarkup(<Hero />);
    for (const t of titles(HERO_FAN_OPENING)) expect(html).toContain(t);
    render(<Hero />);
    expect(fanTitles()).toEqual(titles(deck().slice(0, HERO_FAN_SLOTS)));
  });

  it('deals the next of the shuffled pool into one slot every few seconds', () => {
    vi.useFakeTimers();
    render(<Hero />);
    const first = fanTitles();
    act(() => {
      vi.advanceTimersByTime(HERO_FAN_SWAP_MS + 500);
    });
    const after = fanTitles();
    expect(after.filter((t, i) => t !== first[i])).toEqual(titles([deck()[HERO_FAN_SLOTS]!]));
  });

  it('holds while the pointer is on it, and off screen', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Hero />);
    const first = fanTitles();
    const card = screen.getAllByRole('link').find((a) => a.textContent?.includes(first[2]!))!;
    fireEvent.pointerEnter(card.closest('div')!.parentElement!);
    act(() => {
      vi.advanceTimersByTime(HERO_FAN_SWAP_MS * 3);
    });
    expect(fanTitles()).toEqual(first);
    unmount();

    render(<Hero />);
    const again = fanTitles();
    act(() => observed?.([{ isIntersecting: false }]));
    act(() => {
      vi.advanceTimersByTime(HERO_FAN_SWAP_MS * 3);
    });
    expect(fanTitles()).toEqual(again);
  });

  it('never swaps under reduced motion', () => {
    reduceMotion = true;
    vi.useFakeTimers();
    render(<Hero />);
    const first = fanTitles();
    act(() => {
      vi.advanceTimersByTime(HERO_FAN_SWAP_MS * 3);
    });
    expect(fanTitles()).toEqual(first);
  });
});
