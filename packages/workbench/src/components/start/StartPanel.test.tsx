// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideSearch } from '@liveworkspace/icons/lucide';
import { setPalettePopoverOpen } from '../../lib/palette-popover-open';
import { handStartQuery } from './start-query';
import { noteStartPanelLeft } from './start-panel-open';
import {
  createStartPanel,
  type StartPanelCategory,
  type StartPanelProps,
  type StartPanelResult,
} from './StartPanel';

// The shared start panel each editor binds (its components/start/StartPanel.tsx, whose own tests drive it through
// that editor's real start). These cases cover what the panel does with fake cards, grid and help link.

type Palette = {
  surface: string;
  border: string;
  column: string;
  card: string;
  text: string;
  muted: string;
  focus: string;
};
type Card = { id: string; name: string };
type Group = { mode: 'other'; cards: readonly Card[] };

const PALETTE: Palette = {
  surface: '#ffffff',
  border: '#dddddd',
  column: '#f4f4f4',
  card: '#ffffff',
  text: '#111111',
  muted: '#555555',
  focus: '#3366ff',
};

function CardGrid({
  cards,
  cascade,
  onChoose,
}: {
  cards: readonly Card[];
  palette: Palette;
  cascade: boolean;
  onChoose: (id: string) => void;
}) {
  return (
    <div data-cascade={cascade ? 'yes' : 'no'}>
      {cards.map((c) => (
        <button key={c.id} type="button" data-start-card onClick={() => onChoose(c.id)}>
          {c.name}
        </button>
      ))}
    </div>
  );
}

function HelpLink({ article }: { article: string; variant: 'icon' }) {
  return <a href={`/help/${article}`}>Help</a>;
}

function OtherModes({
  groups,
  divided,
  onChoose,
}: {
  groups: readonly Group[];
  palette: Palette;
  divided: boolean;
  cascade: boolean;
  onChoose: (mode: 'other', id: string) => void;
}) {
  return (
    <section aria-label="In Other Modes" data-divided={divided ? 'yes' : 'no'}>
      {groups.flatMap((g) =>
        g.cards.map((c) => (
          <button key={c.id} type="button" data-start-card onClick={() => onChoose(g.mode, c.id)}>
            {c.name}
          </button>
        )),
      )}
    </section>
  );
}

const tint = (_p: Palette, pct: number) => `tint-${pct}`;
const Icon = lucideGlyph(lucideSearch, 15);

type Cat = 'basic' | 'more' | 'whole';
const CATEGORIES: StartPanelCategory<Cat>[] = [
  { id: 'basic', name: 'Basic', line: 'The basics.', icon: Icon },
  { id: 'more', name: 'More', line: 'More of them.', icon: Icon },
  { id: 'whole', name: 'Whole', line: 'A whole way of working.', icon: Icon, below: true },
];
const CARDS: Record<Cat, Card[]> = {
  basic: [
    { id: 'blank', name: 'Blank' },
    { id: 'board', name: 'Board' },
  ],
  more: [{ id: 'retro', name: 'Retro' }],
  whole: [{ id: 'kit', name: 'Kit' }],
};
const search = (q: string): StartPanelResult<Cat, Card>[] =>
  (Object.keys(CARDS) as Cat[])
    .map((category) => ({
      category,
      cards: CARDS[category].filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
    }))
    .filter((g) => g.cards.length > 0);

const Sheet = createStartPanel({
  app: 'livediagram',
  HelpLink,
  CardGrid,
  tint,
  chosenInk: (p: Palette) => (p.focus === '#3366ff' ? '#000000' : p.focus),
  OtherModes,
  sheet: true,
});
const Fixed = createStartPanel({
  app: 'livedocuments',
  HelpLink,
  CardGrid,
  tint,
  sheet: false,
  hideEmptyFooter: true,
});

type Props = StartPanelProps<Cat, Palette, Card, string, Group, 'other'>;
const base = (over: Partial<Props> = {}): Props => ({
  titleId: 'start-title',
  title: 'Start',
  line: 'Pick one.',
  searchLabel: 'Find a template',
  noMatchNoun: 'templates',
  helpArticle: 'start',
  palette: PALETTE,
  categories: CATEGORIES,
  initialCategory: 'basic',
  cardsIn: (c) => CARDS[c],
  search,
  onChoose: vi.fn(),
  ...over,
});

const box = () => screen.getByRole('textbox', { name: 'Find a template' });
const rail = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

afterEach(() => {
  setPalettePopoverOpen(false);
  vi.unstubAllGlobals();
});

describe('the start panel', () => {
  it('draws the chosen category with its cards, and steps aside for a palette popover', () => {
    const onChoose = vi.fn();
    const { container } = render(<Sheet {...base({ onChoose, countIn: () => 9 })} />);
    expect(screen.getByRole('heading', { name: 'Basic' })).toBeTruthy();
    expect(rail('Basic').getAttribute('aria-current')).toBe('true');
    expect(rail('Basic').style.color).toBe('rgb(0, 0, 0)');
    expect(rail('More').getAttribute('aria-current')).toBeNull();
    expect(within(rail('More')).getByText('9')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(onChoose).toHaveBeenCalledWith('board');
    // The hairline before the categories below it.
    expect(container.querySelector('nav span[aria-hidden]')).not.toBeNull();
    act(() => setPalettePopoverOpen(true));
    expect(container.querySelector('[data-start-stepped-aside]')).not.toBeNull();
  });

  it('picks a category from the rail, and walks it with Up and Down', () => {
    render(<Sheet {...base()} />);
    fireEvent.click(rail('More'));
    expect(screen.getByRole('heading', { name: 'More' })).toBeTruthy();
    fireEvent.keyDown(rail('More'), { key: 'ArrowDown' });
    expect(screen.getByRole('heading', { name: 'Whole' })).toBeTruthy();
    fireEvent.keyDown(rail('Whole'), { key: 'ArrowDown' });
    expect(screen.getByRole('heading', { name: 'Basic' })).toBeTruthy();
    fireEvent.keyDown(rail('Basic'), { key: 'ArrowUp' });
    expect(screen.getByRole('heading', { name: 'Whole' })).toBeTruthy();
    fireEvent.keyDown(rail('Whole'), { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Whole' })).toBeTruthy();
  });

  it('leads a search with its Best Match, names a group the rail does not show, and clears', () => {
    render(
      <Sheet
        {...base({
          search: (q) => [
            ...search(q),
            { category: 'more', name: 'Community', cards: [{ id: 'c1', name: 'Rob' }] },
          ],
        })}
      />,
    );
    fireEvent.change(box(), { target: { value: 'b' } });
    expect(screen.getByRole('region', { name: 'Best Match' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Community' })).toBeTruthy();
    expect(rail('Basic').getAttribute('aria-current')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect((box() as HTMLInputElement).value).toBe('');
    fireEvent.change(box(), { target: { value: 'o' } });
    expect(screen.getByRole('region', { name: 'Basic' })).toBeTruthy();
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect((box() as HTMLInputElement).value).toBe('');
    // An empty box's Escape is left to the panel.
    fireEvent.keyDown(box(), { key: 'Escape' });
  });

  it('says when nothing matches, and when only other modes match', () => {
    const onChooseElsewhere = vi.fn();
    render(
      <Sheet
        {...base({
          elsewhere: (q) =>
            q === 'sail' ? [{ mode: 'other', cards: [{ id: 'sail', name: 'Sailboat' }] }] : [],
          onChooseElsewhere,
        })}
      />,
    );
    fireEvent.change(box(), { target: { value: 'zzz' } });
    expect(screen.getByText('Try another word.')).toBeTruthy();
    fireEvent.change(box(), { target: { value: 'sail' } });
    expect(screen.getByRole('status').textContent).toContain('Found in other modes.');
    const others = screen.getByRole('region', { name: 'In Other Modes' });
    expect(others.getAttribute('data-divided')).toBe('no');
    fireEvent.click(within(others).getByRole('button', { name: 'Sailboat' }));
    expect(onChooseElsewhere).toHaveBeenCalledWith('other', 'sail');
  });

  it('shows other modes under its own matches, divided', () => {
    render(
      <Sheet
        {...base({
          elsewhere: () => [{ mode: 'other', cards: [{ id: 'bx', name: 'Box' }] }],
          onChooseElsewhere: vi.fn(),
        })}
      />,
    );
    fireEvent.change(box(), { target: { value: 'board' } });
    expect(
      screen.getByRole('region', { name: 'In Other Modes' }).getAttribute('data-divided'),
    ).toBe('yes');
  });

  it('moves among the cards with the arrow keys, Down from the search and Up back to it', () => {
    render(<Sheet {...base()} />);
    fireEvent.change(box(), { target: { value: 'b' } });
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    const first = document.activeElement as HTMLElement;
    expect(first.hasAttribute('data-start-card')).toBe(true);
    // The fake grid's cards all stand at the origin, so Right is the next in order.
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).not.toBe(first);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(document.activeElement!, { key: 'x' });
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(box());
    // Not from a card: nothing moves.
    fireEvent.keyDown(screen.getByRole('region', { name: 'Best Match' }), { key: 'ArrowDown' });
    // A search with no cards: Down stays in the box.
    fireEvent.change(box(), { target: { value: 'zzz' } });
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(box());
  });

  it('closes on its × and on Escape, not from inside a menu or once handled', () => {
    const onClose = vi.fn();
    render(
      <Sheet
        {...base({
          onClose,
          lead: (
            <div role="menu">
              <button type="button">Mode</button>
            </div>
          ),
        })}
      />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Mode' }), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    const section = screen.getByRole('region', { name: 'Start' });
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    section.dispatchEvent(handled);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(section, { key: 'a' });
    fireEvent.keyDown(section, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('offers Connect File with the foot actions under it, and its list in the cards’ place', () => {
    const onPick = vi.fn();
    render(
      <Sheet
        {...base({
          connect: () => <p>Connect list</p>,
          footer: () => <span>Sync</span>,
          footActions: [
            { id: 'import', name: 'Import', icon: <Icon />, onPick },
            { id: 'other', name: 'Other', icon: <Icon />, onPick },
          ],
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Connect File/ }));
    expect(screen.getByText('Connect list')).toBeTruthy();
    expect(rail('Basic').getAttribute('aria-current')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Import/ }));
    expect(onPick).toHaveBeenCalled();
    fireEvent.click(rail('Basic'));
    expect(screen.queryByText('Connect list')).toBeNull();
    expect(screen.getByText('Sync').closest('footer')!.className).not.toContain('empty:hidden');
  });

  it('is no sheet where it never closes: no handle, no ×, its own foot and footer', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container } = render(
      <Fixed
        {...(base({
          categories: CATEGORIES.slice(0, 2),
          footer: () => null,
          footActions: [{ id: 'import', name: 'Import', icon: <Icon />, onPick: vi.fn() }],
        }) as Omit<Props, 'elsewhere' | 'onChooseElsewhere'>)}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(container.querySelector('header')!.className).toContain('pr-14');
    expect(container.querySelector('nav span[aria-hidden]')).toBeNull();
    // The chosen row's label is the accent itself.
    expect(rail('Basic').style.color).toBe('rgb(51, 102, 255)');
    expect(screen.getByRole('button', { name: /^Import/ })).toBeTruthy();
    expect(container.querySelector('footer')!.className).toContain('empty:hidden');
    // On a desktop the search is ready to type into.
    expect(document.activeElement).toBe(box());
    fireEvent.keyDown(screen.getByRole('region', { name: 'Start' }), { key: 'Escape' });
  });

  it('arrives calm after another start, with a search handed over', () => {
    noteStartPanelLeft();
    handStartQuery('board');
    const { container } = render(<Sheet {...base()} />);
    expect((box() as HTMLInputElement).value).toBe('board');
    expect(container.querySelector('[data-cascade="no"]')).not.toBeNull();
    expect(container.querySelector('.animate-dialog-in')).toBeNull();
  });

  it("falls back to the first category when the chosen one is gone, and to a group's own id", () => {
    render(
      <Sheet
        {...base({
          initialCategory: 'gone' as Cat,
          search: () => [{ category: 'gone' as Cat, cards: [{ id: 'x', name: 'Xylo' }] }],
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Basic' })).toBeTruthy();
    fireEvent.change(box(), { target: { value: 'y' } });
    expect(screen.getByRole('region', { name: 'gone' })).toBeTruthy();
  });

  it('keeps Up on the first row of a category, outside a search', () => {
    render(<Sheet {...base()} />);
    const blank = screen.getByRole('button', { name: 'Blank' });
    blank.focus();
    fireEvent.keyDown(blank, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(blank);
  });

  it('settles back when dragged down where it cannot close', () => {
    const { container } = render(<Sheet {...base()} />);
    const handle = container.querySelector<HTMLElement>('[data-sheet-handle]')!;
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 400, pointerId: 1 });
    expect(screen.getByRole('region', { name: 'Start' })).toBeTruthy();
  });
});
