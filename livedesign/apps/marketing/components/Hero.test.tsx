// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECENT_DIAGRAMS_KEY, RECENT_FAN_MIN } from '@livedesign/api-schema';
import { renderToStaticMarkup } from 'react-dom/server';
import { seededRandom } from '@livedesign/design';
import { HERO_FAN_OPENING, HERO_FAN_SLOTS, heroTemplate, shuffleFan } from '@/lib/hero-starts';
import { Hero } from './Hero';
import { HERO_FAN_SWAP_MS } from './HeroFan';
import { PHONE_RECENT } from './HeroFanMine';

// docs/specs/019-marketing/marketing-site.md "Hero": the badge and the question, the template search
// with Start Blank in its bar, a returning visitor's recent designs, and the dealing fan.

let reduceMotion = false;
// Whether the window is wider than a phone (the fan's outer pair shows).
let wideScreen = true;
let observed: ((entries: { isIntersecting: boolean }[]) => void) | null = null;

beforeEach(() => {
  reduceMotion = false;
  wideScreen = true;
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('reduce')
          ? reduceMotion
          : query.includes('640px')
            ? wideScreen
            : true,
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
    .map((a) => a.textContent?.replace(/^Create an? /, ''));

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
    fireEvent.change(box, { target: { value: 'website' } });
    const list = screen.getByRole('list', { name: 'Matching templates' });
    const links = within(list).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]!.getAttribute('href')).toBe(
      '/new?template=wireframe-website&via=Home.HeroSearch',
    );
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
    fireEvent.change(box, { target: { value: 'logo design' } });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    const first = within(screen.getByRole('list', { name: 'Matching templates' })).getAllByRole(
      'link',
    )[0]!;
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(box);
    fireEvent.submit(box.form!);
    expect(assign).toHaveBeenCalledWith('/new?template=logo-design&via=Home.HeroSearch');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(box.value).toBe('');
  });

  it('closes the matches when focus moves to Start Blank in the bar', () => {
    render(<Hero />);
    const box = screen.getByLabelText('Search templates');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'website' } });
    expect(screen.getByRole('list', { name: 'Matching templates' })).toBeTruthy();
    const blank = within(screen.getByRole('search')).getByRole('link', { name: 'Start Blank' });
    fireEvent.focus(blank);
    expect(screen.queryByRole('list', { name: 'Matching templates' })).toBeNull();
    fireEvent.focus(box);
    expect(screen.getByRole('list', { name: 'Matching templates' })).toBeTruthy();
  });

  it('scrolls the search up when its matches would open below what a phone shows', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const rect = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ bottom: window.innerHeight + 100 } as DOMRect);
    render(<Hero />);
    const box = screen.getByLabelText('Search templates');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'website' } });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    rect.mockReturnValue({ bottom: 10 } as DOMRect);
    scrollIntoView.mockClear();
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.change(box, { target: { value: 'logo design' } });
    expect(scrollIntoView).not.toHaveBeenCalled();
    rect.mockRestore();
  });

  it('says so when nothing matches', () => {
    render(<Hero />);
    const box = screen.getByLabelText('Search templates');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'zzqqxx' } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('sends Start Blank to the wizard with no start screen after it, as the hero’s own funnel slot', () => {
    render(<Hero />);
    const link = within(screen.getByRole('search')).getByRole('link', { name: 'Start Blank' });
    expect(link.getAttribute('href')).toBe('/new?start=blank&via=Home.HeroBlank');
    expect(within(screen.getByRole('search')).queryAllByRole('menuitem', { hidden: true })).toEqual(
      [],
    );
  });

  it('keeps the template fan below RECENT_FAN_MIN recent designs, then deals theirs and Explorer Home', () => {
    const note = (n: number) =>
      JSON.stringify({
        v: 1,
        diagrams: Array.from({ length: n }, (_, i) => ({
          id: `d${i + 1}`,
          name: `Design ${i + 1}`,
          savedAt: Date.now() - (i + 1) * 3600e3,
          mode: 'pages',
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
      .filter((h) => h?.startsWith('/design/'));
    expect(docs).toEqual(['/design/d1', '/design/d2', '/design/d3', '/design/d4']);
    // The save time sits at the card's foot, after its preview (out of sight until the card lifts).
    const card = screen
      .getAllByRole('link')
      .find((l) => l.getAttribute('href') === '/design/d1')!;
    expect(card.lastElementChild?.textContent).toMatch(/ago$/);
    expect(card.firstElementChild?.textContent).toBe('Design 1');
    expect(screen.getByRole('link', { name: /Explorer Home/ }).getAttribute('href')).toBe(
      '/explorer/home',
    );
    // A phone shows the PHONE_RECENT most recent designs and leaves Explorer Home off.
    const onPhone = screen
      .getAllByRole('link')
      .filter((a) => /^\/(design|explorer)\//.test(a.getAttribute('href') ?? ''))
      .filter((a) => !a.parentElement!.className.split(' ').includes('max-sm:hidden'))
      .map((a) => a.getAttribute('href'));
    expect(onPhone).toEqual(['/design/d1', '/design/d2', '/design/d3']);
    expect(onPhone).toHaveLength(PHONE_RECENT);
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

  it('shows all five only wider than a phone, and never swaps a card out of sight', () => {
    wideScreen = false;
    vi.useFakeTimers();
    render(<Hero />);
    const cards = () =>
      screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href')?.includes('via=Home.HeroFan'));
    // The outer pair hides on a phone.
    const hides = cards().map((a) => {
      const words = a.parentElement!.className.split(' ');
      return words.includes('max-sm:hidden') ? 'phone' : 'always';
    });
    expect(hides).toEqual(['phone', 'always', 'always', 'always', 'phone']);
    const first = fanTitles();
    act(() => {
      vi.advanceTimersByTime(HERO_FAN_SWAP_MS * 12);
    });
    const after = fanTitles();
    expect([after[0], after[4]]).toEqual([first[0], first[4]]);
    expect(after.slice(1, 4)).not.toEqual(first.slice(1, 4));
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
