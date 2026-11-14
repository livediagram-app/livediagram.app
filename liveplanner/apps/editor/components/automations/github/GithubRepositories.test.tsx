// @vitest-environment jsdom
// The chooser with a long list (docs/specs/026-plan/automations.md "The GitHub view": Connected; Work Tracker 769): with
// more than 20 listed, Search Repositories narrows by name, the count says how many show, no match says so and clears,
// picks are kept while searching, and only a window of rows is drawn. 20 or fewer: every row, no search.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubConnectionView } from '@liveplanner/api-schema';
import { GithubRepositories, repositoriesMatching } from './GithubRepositories';
import {
  REPOSITORY_OVERSCAN,
  REPOSITORY_ROW_PX,
  REPOSITORY_WINDOW_ROWS,
  REPOSITORY_WINDOW_ROWS_PHONE,
} from './RepositoryWindow';
import { resetGithubForTests } from './use-github-connection';

const client = vi.hoisted(() => ({ chooseGithubRepositories: vi.fn() }));
vi.mock('./github-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./github-client')>()),
  ...client,
}));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const connectionOf = (n: number, chosen = 0): GithubConnectionView =>
  ({
    installationId: 7,
    account: 'acme',
    connectedBy: { id: 'u1', name: 'Ana Costa', color: '#7c3aed' },
    connectedAt: 1,
    repositories: Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      fullName: `acme/repo-${i}`,
      private: i % 3 === 0,
      chosen: i < chosen,
    })),
  }) as GithubConnectionView;

const chooser = (c: GithubConnectionView, phone = false) =>
  render(<GithubRepositories scope={SCOPE} connection={c} phone={phone} />);
const rows = () => [...document.querySelectorAll('[data-github-repository]')];
const search = () => screen.getByRole('searchbox', { name: 'Search Repositories' });

beforeEach(() => {
  resetGithubForTests();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('repositoriesMatching', () => {
  it('matches owner/name by words in any case, trimmed; every one for none', () => {
    const list = connectionOf(30).repositories;
    expect(repositoriesMatching(list, '')).toBe(list);
    expect(repositoriesMatching(list, '   ')).toBe(list);
    expect(repositoriesMatching(list, ' REPO-2 ').map((r) => r.fullName)).toEqual([
      'acme/repo-2',
      ...Array.from({ length: 10 }, (_, i) => `acme/repo-2${i}`),
    ]);
    expect(repositoriesMatching(list, 'nothing')).toEqual([]);
  });
});

describe('GithubRepositories: 20 or fewer', () => {
  it('lists every one, with no search and no window', () => {
    chooser(connectionOf(20, 2));
    expect(rows()).toHaveLength(20);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(document.querySelector('[data-github-repository-window]')).toBeNull();
    expect(screen.getByText('2 of 20 heard')).toBeTruthy();
  });
});

describe('GithubRepositories: a long list', () => {
  it('draws only the rows in view and the overscan, with their place in the whole list', () => {
    chooser(connectionOf(1000));
    const drawn = rows();
    expect(drawn).toHaveLength(Math.ceil(REPOSITORY_WINDOW_ROWS) + REPOSITORY_OVERSCAN);
    expect(drawn[0]!.getAttribute('aria-posinset')).toBe('1');
    expect(drawn[0]!.getAttribute('aria-setsize')).toBe('1000');
    const box = document.querySelector<HTMLElement>('[data-github-repository-window]')!;
    expect(box.style.maxHeight).toBe(`${REPOSITORY_WINDOW_ROWS * REPOSITORY_ROW_PX}px`);
    expect(screen.getByText('0 of 1,000 heard')).toBeTruthy();
    expect(screen.getByText('Pick up to 20 repositories for this plan to hear.')).toBeTruthy();
  });

  it('draws the rows a scroll brings into view, and keeps the list’s full height', () => {
    chooser(connectionOf(1000));
    const box = document.querySelector<HTMLElement>('[data-github-repository-window]')!;
    box.scrollTop = 500 * REPOSITORY_ROW_PX + 10;
    fireEvent.scroll(box);
    const drawn = rows();
    expect(drawn[0]!.getAttribute('aria-posinset')).toBe(String(500 - REPOSITORY_OVERSCAN + 1));
    expect(drawn.at(-1)!.getAttribute('aria-posinset')).toBe(
      String(500 + Math.ceil(REPOSITORY_WINDOW_ROWS) + REPOSITORY_OVERSCAN),
    );
    const list = box.querySelector<HTMLElement>('ul')!;
    const above = parseInt(list.style.paddingTop, 10);
    const below = parseInt(list.style.paddingBottom, 10);
    expect(above + below + drawn.length * REPOSITORY_ROW_PX).toBe(1000 * REPOSITORY_ROW_PX);
    // The foot of the list: nothing past the last row.
    box.scrollTop = 1000 * REPOSITORY_ROW_PX;
    fireEvent.scroll(box);
    expect(rows().at(-1)!.textContent).toContain('acme/repo-999');
  });

  it('shows fewer rows at a time on a phone', () => {
    chooser(connectionOf(1000), true);
    const box = document.querySelector<HTMLElement>('[data-github-repository-window]')!;
    expect(box.style.maxHeight).toBe(`${REPOSITORY_WINDOW_ROWS_PHONE * REPOSITORY_ROW_PX}px`);
  });

  it('searches by name, says how many show, and keeps picks made while searching', () => {
    chooser(connectionOf(1000, 1));
    fireEvent.change(search(), { target: { value: 'repo-99' } });
    expect(rows().map((r) => r.textContent?.replace('Private', ''))).toEqual([
      'acme/repo-99',
      ...Array.from({ length: 10 }, (_, i) => `acme/repo-99${i}`),
    ]);
    expect(screen.getByText('11 of 1,000 shown')).toBeTruthy();
    // A short match list's box is only as tall as its rows.
    const box = document.querySelector<HTMLElement>('[data-github-repository-window]')!;
    expect(box.style.maxHeight).toBe(`${REPOSITORY_WINDOW_ROWS * REPOSITORY_ROW_PX}px`);
    fireEvent.click(screen.getByRole('switch', { name: /acme\/repo-995/ }));
    fireEvent.change(search(), { target: { value: '' } });
    expect(screen.getByText('2 of 1,000 heard')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save Repositories' })).toBeTruthy();
  });

  it('says when nothing matches, and Clear Search shows every one again', () => {
    chooser(connectionOf(40));
    fireEvent.change(search(), { target: { value: 'zebra' } });
    expect(screen.getByText('No repositories match “zebra”')).toBeTruthy();
    expect(rows()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));
    expect((search() as HTMLInputElement).value).toBe('');
    expect(rows()).toHaveLength(Math.ceil(REPOSITORY_WINDOW_ROWS) + REPOSITORY_OVERSCAN);
  });

  it('pins the heard ones first, then the rest by name; a search keeps a pinned one only if it matches', () => {
    const c = connectionOf(30);
    // Listed out of order, two heard ones in the middle.
    c.repositories = [...c.repositories].reverse().map((r) => ({
      ...r,
      chosen: r.fullName === 'acme/repo-17' || r.fullName === 'acme/repo-4',
    }));
    chooser(c);
    const names = () => rows().map((r) => r.textContent?.replace('Private', ''));
    expect(names().slice(0, 4)).toEqual([
      'acme/repo-4',
      'acme/repo-17',
      'acme/repo-0',
      'acme/repo-1',
    ]);
    // A flip never moves a row: the order is what is saved.
    fireEvent.click(screen.getByRole('switch', { name: 'acme/repo-1' }));
    expect(names().slice(0, 4)).toEqual([
      'acme/repo-4',
      'acme/repo-17',
      'acme/repo-0',
      'acme/repo-1',
    ]);
    fireEvent.change(search(), { target: { value: 'repo-1' } });
    expect(names()).toEqual([
      'acme/repo-17',
      'acme/repo-1',
      ...['10', '11', '12', '13', '14', '15', '16', '18', '19'].map((n) => `acme/repo-${n}`),
    ]);
  });

  it('saves the picks made in the window', async () => {
    client.chooseGithubRepositories.mockResolvedValue(connectionOf(40, 0));
    chooser(connectionOf(40));
    fireEvent.click(screen.getByRole('switch', { name: 'acme/repo-4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Repositories' }));
    await vi.waitFor(() =>
      expect(client.chooseGithubRepositories).toHaveBeenCalledWith(SCOPE, [5]),
    );
  });
});
