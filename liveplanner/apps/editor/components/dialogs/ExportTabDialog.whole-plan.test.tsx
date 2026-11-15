// @vitest-environment jsdom

// The Export dialog's Whole Plan (docs/specs/026-plan/plan-tabs.md "Whole Plan"): the plan's .liveplanner file,
// offered on every tab kind to an Editor of the whole plan on a plan saved to an account (the host passes
// `wholePlan` only then), downloaded from the api as `<plan name>.liveplanner`, a failure said under the button.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';

const { exportFile, download, track } = vi.hoisted(() => ({
  exportFile: vi.fn(),
  download: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/lib/api/project-file', () => ({ apiExportProjectFile: exportFile }));
vi.mock('@/lib/export-tab', async (original) => ({
  ...(await original<typeof import('@/lib/export-tab')>()),
  downloadBlob: download,
}));

import { ExportTabDialog } from './ExportTabDialog';
import { WHOLE_PLAN_FAILED } from './WholePlanExportPanel';

const WHOLE = { projectId: 'P1', ownerId: 'user_ada' };
const tabOf = (kind?: Tab['kind']): Tab => ({
  id: 't',
  name: 'Tab',
  elements: [],
  ...(kind ? { kind } : {}),
});

function open(tab: Tab = tabOf('board'), whole = true) {
  const onClose = vi.fn();
  render(
    <ExportTabDialog
      tab={tab}
      projectName="Road/map"
      onClose={onClose}
      {...(whole ? { wholePlan: WHOLE } : {})}
    />,
  );
  return { onClose };
}

const card = () => screen.queryByRole('button', { name: /Whole Plan/ });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExportTabDialog: Whole Plan', () => {
  it('ends every tab kind’s formats with Whole Plan, given the plan', () => {
    for (const kind of ['board', 'sheet', 'dashboard', 'form', undefined] as const) {
      open(tabOf(kind));
      const cards = screen.getAllByRole('button').filter((b) => b.textContent);
      expect(card()).toBeTruthy();
      expect(cards.at(-1)!.textContent).toContain('Whole Plan');
      cleanup();
    }
  });

  it('is not offered without the plan (a Participant, a Viewer, a tab-scoped link, a This Browser plan)', () => {
    open(tabOf('board'), false);
    expect(card()).toBeNull();
  });

  it('opens its panel, then downloads the file named for the plan and closes', async () => {
    exportFile.mockResolvedValueOnce('{"kind":"liveplanner.project"}');
    const { onClose } = open();
    fireEvent.click(card()!);
    expect(screen.getByText('Download the whole plan as one file.')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'What the file holds' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download .liveplanner' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(exportFile).toHaveBeenCalledWith('user_ada', 'P1');
    const [blob, name] = download.mock.calls[0] as [Blob, string];
    expect(name).toMatch(/^Road.map\.liveplanner$/);
    expect(blob.type).toBe('application/vnd.liveplanner+json');
    expect(track).toHaveBeenCalledWith('Project', 'Exported', 'Plan');
  });

  it('says a failure under the button, held while it prepares, and goes back to the formats', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let fail: (e: Error) => void = () => {};
    exportFile.mockImplementationOnce(() => new Promise<string>((_, reject) => (fail = reject)));
    const { onClose } = open();
    fireEvent.click(card()!);
    fireEvent.click(screen.getByRole('button', { name: 'Download .liveplanner' }));
    expect(await screen.findByRole('button', { name: 'Preparing…' })).toBeTruthy();
    fail(new Error('403'));
    expect(await screen.findByText(WHOLE_PLAN_FAILED)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /All formats/ }));
    expect(card()).toBeTruthy();
  });
});
