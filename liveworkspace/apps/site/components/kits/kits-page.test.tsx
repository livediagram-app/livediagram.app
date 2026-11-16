// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexError, KITS, type KitRun, type KitStartInput } from '@liveworkspace/index-client';
import { KitsPage } from './KitsPage';

// Start a Project in every state (liveworkspace/docs/specs/010-site/site.md "Start a Project"): the kits as a radio
// group, the setup and its role, signed out, a run ready, partly made with Retry and Remove What Was Made, nothing made,
// and a refused run.
let session: { state: 'checking' | 'out' | 'in' } = { state: 'in' };
vi.mock('@/lib/session', () => ({ useSession: () => session }));
vi.mock('@/components/Header', () => ({ Header: () => <header /> }));
vi.mock('@/components/Footer', () => ({ Footer: () => <footer /> }));

afterEach(() => {
  cleanup();
  session = { state: 'in' };
});

const software = KITS[0]!;
const runOf = (made: (string | null)[], connections = { made: 12, failed: 0 }): KitRun => ({
  folderId: 'F1',
  parts: software.parts.map((p, i) => ({ slot: p.slot, app: p.app, itemId: made[i] ?? null })),
  connections,
  complete: made.every(Boolean) && connections.failed === 0,
});

function draw(answers: (KitRun | Error)[] = []) {
  const queue = [...answers];
  const next = async () => {
    const a = queue.shift();
    if (a instanceof Error) throw a;
    return a!;
  };
  const client = {
    startKit: vi.fn((_input: KitStartInput) => next()),
    removeKit: vi.fn(async () => {
      const a = queue.shift();
      if (a instanceof Error) throw a;
    }),
  };
  render(<KitsPage client={client} />);
  return client;
}

const create = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Create/ }));
  });
};

describe('the kits and the setup', () => {
  it('chooses the first kit, and walks the kits with the arrows', () => {
    draw();
    const group = screen.getByRole('radiogroup', { name: 'Kit' });
    const kits = within(group).getAllByRole('radio');
    expect(kits).toHaveLength(KITS.length);
    expect(kits[0]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(within(group).getAllByRole('radio')[1]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(group, { key: 'End' });
    fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(within(group).getAllByRole('radio')[0]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'Home' });
    fireEvent.keyDown(group, { key: 'Tab' });
    fireEvent.click(kits[3]!);
    expect(kits[3]!.getAttribute('aria-checked')).toBe('true');
  });

  it('starts on Editor, saying what the role shares and what livehuddle gives instead', () => {
    draw();
    const role = screen.getByRole('radiogroup', { name: 'Role the connections give' });
    expect(within(role).getByRole('radio', { name: 'Editor' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      screen.getByText('Anyone who can open one of these files can edit the others.'),
    ).toBeTruthy();
    fireEvent.click(within(role).getByRole('radio', { name: 'Viewer' }));
    expect(
      screen.getByText('livehuddle has no Viewer role, so Team Space opens to Participants.'),
    ).toBeTruthy();
  });

  it('asks a signed-out visitor to sign in, and waits while the session is checked', () => {
    session = { state: 'out' };
    const client = draw();
    const link = screen.getByRole('link', { name: 'Sign In to Create' });
    expect(link.getAttribute('href')).toContain(encodeURIComponent('/kits'));
    cleanup();
    session = { state: 'checking' };
    draw();
    const button = screen.getByRole<HTMLButtonElement>('button', { name: /Create/ });
    expect(button.disabled).toBe(true);
    fireEvent.submit(button.closest('form')!);
    expect(client.startKit).not.toHaveBeenCalled();
  });
});

describe('a run', () => {
  it('makes the project with the name and role chosen, then opens its folder or starts another', async () => {
    const client = draw([runOf(['a', 'b', 'c', 'd'])]);
    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: ' Apollo ' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Participant' }));
    await create();
    expect(client.startKit).toHaveBeenCalledWith({
      kit: 'software-project',
      level: 'participate',
      name: 'Apollo',
    });
    expect(screen.getByRole('heading', { name: 'Your project is ready.' })).toBeTruthy();
    expect(screen.getByText('12 connections, Participant')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Apollo Plan' }).getAttribute('href')).toContain(
      '/a',
    );
    expect(screen.getByRole('link', { name: 'Open Folder' }).getAttribute('href')).toBe(
      '/explorer/folder?id=F1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start Another' }));
    expect(screen.getByLabelText<HTMLInputElement>('Project Name').value).toBe('');
  });

  it('names the project after the kit when left empty, and spins while it works', async () => {
    let finish: (run: KitRun) => void = () => {};
    const client = {
      startKit: vi.fn((_input: KitStartInput) => new Promise<KitRun>((r) => (finish = r))),
      removeKit: vi.fn(),
    };
    render(<KitsPage client={client} />);
    await create();
    expect(client.startKit.mock.calls[0]![0].name).toBe(software.title);
    expect(screen.getByRole('heading', { name: `Creating ${software.title}…` })).toBeTruthy();
    expect(screen.getByText('Connecting 4 files…')).toBeTruthy();
    await act(async () => finish(runOf(['a', 'b', 'c', 'd'])));
    expect(screen.getByRole('heading', { name: 'Your project is ready.' })).toBeTruthy();
  });

  it('offers Retry when partly made, which sends the folder and what was made', async () => {
    const client = draw([
      runOf(['a', 'b', 'c', null], { made: 6, failed: 0 }),
      runOf(['a', 'b', 'c', 'd'], { made: 6, failed: 0 }),
    ]);
    await create();
    expect(
      screen.getByRole('heading', { name: 'Some of your project couldn’t be made.' }),
    ).toBeTruthy();
    expect(screen.getByText('Couldn’t be made in livehuddle')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(client.startKit.mock.calls[1]![0]).toMatchObject({
      folderId: 'F1',
      made: { plan: 'a', architecture: 'b', 'design-doc': 'c' },
    });
    expect(screen.getByRole('heading', { name: 'Your project is ready.' })).toBeTruthy();
  });

  it('removes what was made after asking once, and Cancel keeps it', async () => {
    const client = draw([runOf(['a', null, null, null], { made: 0, failed: 0 })]);
    await create();
    fireEvent.click(screen.getByRole('button', { name: 'Remove What Was Made' }));
    expect(screen.getByText('Delete the files this made? This can’t be undone.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove What Was Made' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Them' }));
    });
    expect(client.removeKit).toHaveBeenCalledWith({ folderId: 'F1', made: { plan: 'a' } });
    expect(screen.getByRole('button', { name: /Create/ })).toBeTruthy();
  });

  it('says why a removal was refused, keeping the run', async () => {
    draw([runOf(['a', null, null, null], { made: 0, failed: 0 }), new IndexError(500, 'x')]);
    await create();
    fireEvent.click(screen.getByRole('button', { name: 'Remove What Was Made' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Them' }));
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'Couldn’t delete those files. Try again in a moment.',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('offers Try Again alone when nothing was made', async () => {
    draw([runOf([null, null, null, null], { made: 0, failed: 0 })]);
    await create();
    expect(screen.getByRole('heading', { name: 'Couldn’t start your project.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove What Was Made' })).toBeNull();
  });

  it('keeps the setup with the reason when the run is refused, and a refused Retry keeps the run', async () => {
    draw([new TypeError('offline')]);
    await create();
    expect(screen.getByRole('alert').textContent).toBe(
      'Couldn’t reach liveworkspace. Check your connection and try again.',
    );
    cleanup();
    draw([runOf(['a', null, null, null], { made: 0, failed: 0 }), new IndexError(503, 'x')]);
    await create();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'Couldn’t create your project. Try again in a moment.',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
