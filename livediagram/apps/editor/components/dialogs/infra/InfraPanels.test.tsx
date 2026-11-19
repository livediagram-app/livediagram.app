// @vitest-environment jsdom

// The infrastructure panels in the Import dialog (docs/specs/020-import-export/infrastructure-import.md "The editor"
// and "Updating a tab from its files"): several files as rows, the paste, the Wrangler environment, Import; the From
// Its Files card, the update panel's row states and actions, and Update Diagram.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramSources } from '@livediagram/document';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportTabDialog, type InfraDialogApi } from '../ImportTabDialog';
import { namesLine } from './InfraSourcesCard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const picks = vi.hoisted(() => ({ one: vi.fn(), many: vi.fn() }));
vi.mock('@/lib/import-tab', async (load) => ({
  ...(await load<typeof import('@/lib/import-tab')>()),
  pickTabFile: picks.one,
  pickTabFiles: picks.many,
}));

afterEach(() => vi.clearAllMocks());

const WRANGLER =
  'name = "api"\n[env.staging]\nname = "api-staging"\n[env.prod]\nname = "api-prod"\n';
const TF = 'resource "aws_s3_bucket" "assets" {}\n';
const COMPOSE = 'services:\n  web: {}\n';

function open(infra: Partial<InfraDialogApi> = {}) {
  const api: InfraDialogApi = {
    sources: null,
    importFiles: vi.fn(async (): Promise<ImportOutcome> => ({ status: 'done' })),
    update: vi.fn(async (): Promise<ImportOutcome> => ({ status: 'done' })),
    ...infra,
  };
  const onClose = vi.fn();
  render(
    <ImportTabDialog
      tabName="Arch"
      onImportFile={vi.fn()}
      onImportText={vi.fn()}
      infra={api}
      onClose={onClose}
    />,
  );
  return { api, onClose };
}

const drop = (target: HTMLElement, files: File[]) =>
  fireEvent.drop(target, { dataTransfer: { files } });

const dropZone = () =>
  screen.getByRole('button', { name: /Drop wrangler\.toml, Compose, Terraform or Kubernetes/ });

describe('the Infrastructure panel', () => {
  it('takes several files as rows, offers their environments, and imports them together', async () => {
    const { api } = open();
    fireEvent.click(screen.getByRole('button', { name: /^Infrastructure/ }));
    expect(screen.getByText('Add your infrastructure files, or paste one.')).toBeTruthy();
    const importButton = screen.getByRole<HTMLButtonElement>('button', { name: 'Import' });
    expect(importButton.disabled).toBe(true);
    drop(dropZone(), [
      new File([WRANGLER], 'wrangler.toml'),
      new File([TF], 'main.tf'),
      new File([COMPOSE], 'compose.yml'),
    ]);
    const list = await screen.findByRole('list', { name: 'Files to import' });
    await waitFor(() => expect(within(list).getByText('Terraform')).toBeTruthy());
    expect(within(list).getByText('Wrangler')).toBeTruthy();
    expect(within(list).getByText('compose.yml')).toBeTruthy();
    // The same file again is one row.
    drop(dropZone(), [new File([TF], 'main.tf')]);
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3));
    // The environments the wrangler.toml names, the top level first.
    const env = await screen.findByLabelText<HTMLSelectElement>('Wrangler environment');
    expect([...env.options].map((o) => o.textContent)).toEqual(['Top level', 'staging', 'prod']);
    fireEvent.change(env, { target: { value: 'staging' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove compose.yml' }));
    expect(within(list).queryByText('compose.yml')).toBeNull();
    fireEvent.click(importButton);
    await waitFor(() => expect(api.importFiles).toHaveBeenCalledOnce());
    expect(api.importFiles).toHaveBeenCalledWith(
      [
        { name: 'wrangler.toml', text: WRANGLER },
        { name: 'main.tf', text: TF },
      ],
      'staging',
    );
  });

  it('reads a paste with the files, and says an error without losing them', async () => {
    const { api } = open({
      importFiles: vi.fn(async (): Promise<ImportOutcome> => ({
        status: 'error',
        error: "main.tf: Couldn't read the HCL: The string is not closed (line 1).",
      })),
    });
    fireEvent.click(screen.getByRole('button', { name: /^Infrastructure/ }));
    fireEvent.change(screen.getByLabelText('Or paste a file'), { target: { value: COMPOSE } });
    const importButton = screen.getByRole<HTMLButtonElement>('button', { name: 'Import' });
    expect(importButton.disabled).toBe(false);
    fireEvent.click(importButton);
    expect((await screen.findByRole('alert')).textContent).toContain('main.tf: ');
    expect(api.importFiles).toHaveBeenCalledWith([{ text: COMPOSE }], undefined);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Or paste a file').value).toBe(COMPOSE);
  });

  it('hands the panel back when the import throws', async () => {
    open({ importFiles: vi.fn(async () => Promise.reject(new Error('boom'))) });
    fireEvent.click(screen.getByRole('button', { name: /^Infrastructure/ }));
    fireEvent.change(screen.getByLabelText('Or paste a file'), { target: { value: COMPOSE } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't import that. Check the files and try again.",
    );
    expect(screen.getByRole('button', { name: 'Import' }).getAttribute('aria-busy')).toBeNull();
  });

  it('refuses a file past the cap unread, naming it, and adds the chosen ones', async () => {
    picks.many.mockResolvedValueOnce([
      { name: 'main.tf', text: TF, file: {} },
      { name: 'huge.yaml', text: '', file: {}, tooBig: true },
    ]);
    open();
    fireEvent.click(screen.getByRole('button', { name: /^Infrastructure/ }));
    fireEvent.click(dropZone());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'huge.yaml: That file is over 1 MB, larger than any infrastructure file. Pick the file itself.',
    );
    expect(await screen.findByText('main.tf')).toBeTruthy();
    expect(screen.getByLabelText('Paste one more file')).toBeTruthy();
    // A dropped file past the cap is refused the same way.
    drop(dropZone(), [new File(['#'.repeat(1_000_001)], 'big.tf')]);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/^big\.tf: /));
    // A dismissed picker changes nothing.
    picks.many.mockResolvedValueOnce(null);
    fireEvent.click(dropZone());
    await waitFor(() => expect(picks.many).toHaveBeenCalledTimes(2));
    expect(screen.getByText('main.tf')).toBeTruthy();
  });
});

const SOURCES: DiagramSources = {
  bridge: 'infra',
  files: [
    { name: 'wrangler.toml', format: 'wrangler', hash: 'x', text: WRANGLER },
    { name: 'infra/main.tf', format: 'terraform', hash: 'y' },
  ],
  env: 'prod',
  readAt: Date.now() - 2 * 60 * 60 * 1000,
  nodes: {},
  edges: {},
};

const row = (name: string) =>
  screen.getByText(name, { selector: 'span' }).closest('li') as HTMLElement;

describe('the From Its Files card and the update', () => {
  it('is offered only on a tab with files to update from', () => {
    open();
    expect(screen.queryByRole('region', { name: 'From its files' })).toBeNull();
  });

  it('names the files and when they were read, and opens the update panel', async () => {
    const { api, onClose } = open({ sources: SOURCES });
    const card = screen.getByRole('region', { name: 'From its files' });
    expect(card.textContent).toContain('wrangler.toml, main.tf');
    expect(card.textContent).toContain('(prod)');
    expect(card.textContent).toContain('read 2 hours ago');
    fireEvent.click(within(card).getByRole('button', { name: 'Update From Files' }));
    expect(screen.getByText('Update this tab from new versions of its files.')).toBeTruthy();
    // No replace warning: an update keeps the tab.
    expect(screen.queryByText(/This replaces everything/)).toBeNull();
    expect(within(row('wrangler.toml')).getByText('Kept')).toBeTruthy();
    expect(within(row('infra/main.tf')).getByText('Needed')).toBeTruthy();
    expect(
      screen.getByText('Choose infra/main.tf again, or remove it: it was too large to remember.'),
    ).toBeTruthy();
    const update = screen.getByRole<HTMLButtonElement>('button', { name: 'Update Diagram' });
    expect(update.disabled).toBe(true);
    expect(screen.getByText('Choose or remove each file marked Needed first.')).toBeTruthy();
    // The remembered environment is chosen.
    const env = await screen.findByLabelText<HTMLSelectElement>('Wrangler environment');
    await waitFor(() => expect(env.options).toHaveLength(3));
    expect(env.value).toBe('prod');

    // Paste the Needed file's text.
    fireEvent.click(screen.getByRole('button', { name: 'Paste infra/main.tf' }));
    const box = screen.getByLabelText('New text for infra/main.tf');
    // Escape closes the box, not the dialog.
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByLabelText('New text for infra/main.tf')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Paste infra/main.tf' }));
    fireEvent.change(screen.getByLabelText('New text for infra/main.tf'), {
      target: { value: TF },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use This Text' }));
    expect(within(row('infra/main.tf')).getByText('Replaced')).toBeTruthy();
    expect(update.disabled).toBe(false);

    // Remove, then Keep, the wrangler.toml.
    fireEvent.click(screen.getByRole('button', { name: 'Remove wrangler.toml' }));
    expect(within(row('wrangler.toml')).getByText('Removed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep wrangler.toml' }));
    expect(within(row('wrangler.toml')).getByText('Kept')).toBeTruthy();

    // A dropped new version replaces the file of the same name; another is added.
    drop(screen.getByTestId('infra-update-drop'), [
      new File([WRANGLER], 'wrangler.toml'),
      new File([COMPOSE], 'compose.yml'),
    ]);
    await waitFor(() => expect(within(row('compose.yml')).getByText('New')).toBeTruthy());
    // The same text as remembered says so (its fingerprint matches once the parsers load).
    expect(within(row('wrangler.toml')).getByText(/Replaced|No changes/)).toBeTruthy();
    // A new row is removed outright.
    fireEvent.click(screen.getByRole('button', { name: 'Remove compose.yml' }));
    expect(screen.queryByText('compose.yml', { selector: 'span' })).toBeNull();

    fireEvent.click(update);
    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    expect(api.update).toHaveBeenCalledWith(
      [
        { name: 'wrangler.toml', text: WRANGLER },
        { name: 'infra/main.tf', text: TF },
      ],
      'prod',
    );
  });

  it('says No changes for a replacement that reads as remembered, and shows the update report', async () => {
    const { fingerprint } = await import('@livediagram/document/infra-code');
    const sources = {
      ...SOURCES,
      env: undefined,
      files: [
        { name: 'compose.yml', format: 'compose', hash: fingerprint(COMPOSE), text: COMPOSE },
      ],
    };
    open({
      sources,
      update: vi.fn(async (): Promise<ImportOutcome> => ({
        status: 'done',
        title: 'Update complete',
        subtitle: 'Updated from 1 file.',
        scene: {
          landed: { shape: 2, connector: 1 },
          degraded: [{ rule: 'Boxes kept where they were', count: 2 }],
          skipped: [],
        },
      })),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update From Files' }));
    picks.one.mockResolvedValueOnce({ name: 'compose.yml', text: COMPOSE, file: {} });
    fireEvent.click(screen.getByRole('button', { name: 'Choose compose.yml' }));
    expect(await within(row('compose.yml')).findByText('No changes')).toBeTruthy();
    // A chosen file past the cap is refused, naming it; a dismissed picker changes nothing.
    picks.one.mockResolvedValueOnce({ name: 'compose.yml', text: '', file: {}, tooBig: true });
    fireEvent.click(screen.getByRole('button', { name: 'Choose compose.yml' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /^compose\.yml: That file is over 1 MB/,
    );
    picks.one.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'Choose compose.yml' }));
    // Add Files goes through the several-files picker.
    picks.many.mockResolvedValueOnce([{ name: 'main.tf', text: TF, file: {} }]);
    fireEvent.click(screen.getByRole('button', { name: 'Add Files' }));
    await screen.findByText('main.tf', { selector: 'span' });
    expect(within(row('main.tf')).getByText('New')).toBeTruthy();
    expect(screen.queryByLabelText('Wrangler environment')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Update Diagram' }));
    const report = await screen.findByTestId('import-image-report');
    expect(report.textContent).toContain('Update complete');
    expect(report.textContent).toContain('Boxes kept where they were');
    expect(screen.getByText('Updated from 1 file.')).toBeTruthy();
  });

  it('goes back to the formats from the update', () => {
    open({ sources: SOURCES });
    fireEvent.click(screen.getByRole('button', { name: 'Update From Files' }));
    fireEvent.click(screen.getByRole('button', { name: /All Formats/ }));
    expect(screen.getByRole('region', { name: 'From its files' })).toBeTruthy();
  });

  it('shortens a long list of names', () => {
    expect(namesLine(['a', 'b', 'c'])).toBe('a, b, c');
    expect(namesLine(['a', 'b', 'c', 'd'])).toBe('a, b and 2 more');
  });
});
