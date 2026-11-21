// @vitest-environment jsdom
// docs/specs/013-workspace/automations.md "Triggers of its own", "The screen": Component Changed's panel offers Any
// Component or one main of the library, read as this person; picking one saves its id and name; a main since deleted
// reads "(No Longer Here)", a copy's empty pick asks for one, and a failed read offers Try Again.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KINDS, type ComponentChangedTrigger } from '@livedesign/design/automations';
import {
  buildOutline,
  type ItemUiOutline,
  type ItemView,
} from '@liveworkspace/automations-ui/item';

type Main = { id: string; name: string; archived?: boolean };
const read = vi.fn<(url: string) => Promise<{ components: Main[] }>>();
vi.mock('@/lib/api/core', () => ({
  API_BASE: '/api',
  apiHeaders: async () => ({}),
  apiFetch: async (url: string) => ({ url }),
  expectOk: (res: { url: string }) => read(res.url),
}));

const { ANY_MAIN, ComponentChangedPanel, goneMain, mainLabel, pickMain } =
  await import('./component-panel');
const { mainsOf } = await import('./use-library-mains');

const ITEM: ItemView = {
  id: 'd/1',
  name: 'Brand',
  tabs: [{ id: 't1', name: 'Logo' }],
  currentTabId: 't1',
  people: [],
  shareCode: 'sc1',
  signedIn: true,
  openTab: () => {},
};

const outline = (): ItemUiOutline =>
  buildOutline({
    kinds: KINDS,
    item: ITEM,
    templates: [],
    snapshots: { status: 'idle', list: [], ask: () => {}, retry: () => {} },
    connections: { status: 'idle', list: [] },
  });

const LIBRARY: Main[] = [
  { id: 'c2', name: 'Card' },
  { id: 'c3', name: 'Old Badge', archived: true },
  { id: 'c1', name: 'Button' },
];

const select = () => screen.getByRole<HTMLSelectElement>('combobox', { name: 'Component' });
const options = () => [...select().options].map((o) => o.textContent);

async function shown(trigger: ComponentChangedTrigger, onChange = vi.fn()) {
  const view = render(
    <ComponentChangedPanel
      trigger={trigger}
      onChange={onChange}
      outline={outline()}
      timeZone="UTC"
      conditions={0}
    />,
  );
  await act(async () => {});
  return { ...view, onChange };
}

beforeEach(() => {
  read.mockReset();
  read.mockResolvedValue({ components: LIBRARY });
});
afterEach(cleanup);

describe('Component Changed’s panel', () => {
  it('reads the design’s library once, and lists Any Component then its mains, archived ones last', async () => {
    await shown({ kind: 'component_changed' });
    expect(read).toHaveBeenCalledExactlyOnceWith('/api/designs/d%2F1/components');
    expect(options()).toEqual(['Any Component', 'Button', 'Card', 'Old Badge (Archived)']);
    expect(select().value).toBe(ANY_MAIN);
    expect(select().getAttribute('aria-invalid')).toBeNull();
    // It says it waits for the library to be quiet.
    expect(screen.getByText(/quiet for 2 minutes/)).toBeTruthy();
  });

  it('saves a main’s id and name, and Any Component as no pick', async () => {
    const { onChange } = await shown({ kind: 'component_changed' });
    fireEvent.change(select(), { target: { value: 'c1' } });
    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'component_changed',
      component: 'c1',
      name: 'Button',
    });
    await shown({ kind: 'component_changed', component: 'c1', name: 'Button' }, onChange);
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Component' })[1]!, {
      target: { value: ANY_MAIN },
    });
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'component_changed' });
  });

  it('keeps a deleted main as gone until another is picked', async () => {
    await shown({ kind: 'component_changed', component: 'c9', name: 'Hero' });
    expect(options()).toEqual([
      'Any Component',
      'Hero (No Longer Here)',
      'Button',
      'Card',
      'Old Badge (Archived)',
    ]);
    expect(select().value).toBe('c9');
  });

  it('asks a copy’s rule for its component', async () => {
    const { onChange } = await shown({ kind: 'component_changed', component: '' });
    expect(options()[0]).toBe('Pick a component');
    expect(select().getAttribute('aria-invalid')).toBe('true');
    // The placeholder itself picks nothing.
    fireEvent.change(select(), { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the saved name while the library loads', async () => {
    let answer!: (v: { components: Main[] }) => void;
    read.mockReturnValueOnce(new Promise((r) => (answer = r)));
    render(
      <ComponentChangedPanel
        trigger={{ kind: 'component_changed', component: 'c1', name: 'Button' }}
        onChange={() => {}}
        outline={outline()}
        timeZone="UTC"
        conditions={0}
      />,
    );
    expect(select().disabled).toBe(true);
    expect(options()).toEqual(['Any Component', 'Button']);
    await act(async () => answer({ components: LIBRARY }));
    expect(select().disabled).toBe(false);
  });

  it('says a library with no mains has none yet', async () => {
    read.mockResolvedValueOnce({ components: [] });
    await shown({ kind: 'component_changed' });
    expect(options()).toEqual(['Any Component']);
    expect(screen.getByText(/no components yet/)).toBeTruthy();
  });

  it('offers Try Again when the read fails, and reads again', async () => {
    read.mockRejectedValueOnce(new Error('offline'));
    await shown({ kind: 'component_changed' });
    expect(screen.getByText(/Couldn’t load this design’s components/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await act(async () => {});
    expect(read).toHaveBeenCalledTimes(2);
    expect(options()).toContain('Button');
  });
});

describe('the panel’s words', () => {
  it('says a gone main, an archived one, and a pick from the list', () => {
    expect(goneMain('Hero')).toBe('Hero (No Longer Here)');
    expect(goneMain(null)).toBe('A component (No Longer Here)');
    expect(mainLabel({ id: 'c', name: 'Pill', archived: true })).toBe('Pill (Archived)');
    expect(pickMain('c7', [])).toEqual({ kind: 'component_changed', component: 'c7' });
    expect(mainsOf([{ id: 'x' } as never, ...(LIBRARY as never[])]).map((m) => m.id)).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
  });
});
