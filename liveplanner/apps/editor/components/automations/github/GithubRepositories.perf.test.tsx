// @vitest-environment jsdom
// The chooser at 1,000 repositories (Work Tracker 769; blueprint "Part 6" "Performance and limits"): an installation
// lists up to 1,000 (REPOSITORY_PAGES_MAX x 100). Before the window, jsdom spent 266 to 334 ms of CPU opening the list
// and 67 to 102 ms on one flip (every row redrawn); windowed, opening is about 10 to 20 ms and draws under 30 rows
// whatever the list's length. The budgets hold each step well under a long task.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { GithubConnectionView } from '@liveplanner/api-schema';
import { GithubRepositories } from './GithubRepositories';
import { REPOSITORY_ROW_PX } from './RepositoryWindow';

vi.mock('./github-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./github-client')>()),
  chooseGithubRepositories: vi.fn(),
}));
afterEach(cleanup);

const connectionOf = (n: number): GithubConnectionView =>
  ({
    installationId: 7,
    account: 'acme',
    connectedBy: { id: 'u1', name: 'Ana Costa', color: '#7c3aed' },
    connectedAt: 1,
    repositories: Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      fullName: `acme/repository-with-a-long-name-${i}`,
      private: i % 3 === 0,
      chosen: i < 5,
    })),
  }) as GithubConnectionView;

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };

it('opens, scrolls, searches and flips 1,000 repositories within a CPU budget, drawing a window of rows', () => {
  const c = connectionOf(1000);
  // Warm the modules and React once, so the budget measures the list and not the first import.
  const warm = render(
    <GithubRepositories scope={SCOPE} connection={connectionOf(30)} phone={false} />,
  );
  fireEvent.click(screen.getAllByRole('switch')[3]!);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'x' } });
  warm.unmount();

  const open = cpuMsOf(() => {
    render(<GithubRepositories scope={SCOPE} connection={c} phone />);
  });
  expect(document.querySelectorAll('[data-github-repository]').length).toBeLessThan(30);
  const box = document.querySelector<HTMLElement>('[data-github-repository-window]')!;
  // A scroll as a wheel or a finger makes it, a few rows an event, down 300 rows; and one jump to the foot.
  const steps: number[] = [];
  for (let row = 0; row <= 300; row += 3)
    steps.push(
      cpuMsOf(() => {
        box.scrollTop = row * REPOSITORY_ROW_PX;
        fireEvent.scroll(box);
      }),
    );
  const jump = cpuMsOf(() => {
    box.scrollTop = 1000 * REPOSITORY_ROW_PX;
    fireEvent.scroll(box);
  });
  const scroll = steps.reduce((a, b) => a + b, 0) / steps.length;
  // The first flip also shows Undo Changes and Save Repositories; the next redraws one row.
  const firstFlip = cpuMsOf(() => {
    fireEvent.click(screen.getAllByRole('switch')[3]!);
  });
  const flip = cpuMsOf(() => {
    fireEvent.click(screen.getAllByRole('switch')[4]!);
  });
  const searching = cpuMsOf(() => {
    const field = screen.getByRole('searchbox', { name: 'Search Repositories' });
    for (const q of ['r', 're', 'rep', 'repo', 'name-9', 'name-99', 'name-999', ''])
      fireEvent.change(field, { target: { value: q } });
  });
  expect(document.querySelectorAll('[data-github-repository]').length).toBeLessThan(30);

  // Measured on an M-series Mac under load: open 10 to 20, a scroll event 4, a jump 3 to 5, a flip 15 to 28 and the
  // eight keystrokes 54 to 77 ms.
  expect(open).toBeLessThan(cpuBudgetMs(60));
  // A scroll event's average, and a jump that draws a whole new window.
  expect(scroll).toBeLessThan(cpuBudgetMs(12));
  expect(jump).toBeLessThan(cpuBudgetMs(40));
  expect(firstFlip).toBeLessThan(cpuBudgetMs(80));
  expect(flip).toBeLessThan(cpuBudgetMs(60));
  // Eight keystrokes.
  expect(searching).toBeLessThan(cpuBudgetMs(200));
});
