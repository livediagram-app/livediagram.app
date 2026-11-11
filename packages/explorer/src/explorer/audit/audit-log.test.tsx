// A team's Audit Log on its view (liveworkspace/docs/specs/004-index/team-audit-log.md "The Audit Log on a team's
// view"): the team's admins alone see it; closed until opened; every filter sent as the read takes it; Show More and
// its failure; empty, nothing matching, refused and failed; Export CSV across files, the cap and a failure.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IndexError,
  type TeamAuditEvent,
  type TeamAuditEventType,
} from '@liveworkspace/index-client';
import type { TeamDetails, TeamsHost } from '../../data/teams';
import { createFakeIndex } from '../../test/fakeClient';
import { Explorer } from '../Explorer';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { AUDIT_EXPORT_FILES_MAX, exportAuditCsv } from './useAuditLog';

const saved = vi.hoisted(() => ({ files: [] as { blob: Blob; name: string }[] }));
vi.mock('@liveworkspace/ui/download-blob', () => ({
  downloadBlob: (blob: Blob, name: string) => saved.files.push({ blob, name }),
}));

beforeEach(() => {
  saved.files = [];
});

const details = (myRole: 'admin' | 'member' = 'admin'): TeamDetails => ({
  team: { id: 't1', name: 'Design Ops', organisation: null, myRole, myMemberId: 'm1' },
  members: [
    {
      id: 'm1',
      userId: 'user_me',
      email: 'me@x.test',
      name: 'Sam Doe',
      role: myRole,
      status: 'joined',
    },
    {
      id: 'm2',
      userId: 'user_ann',
      email: 'ann@x.test',
      name: 'Ann Lee',
      role: 'admin',
      status: 'joined',
    },
    { id: 'm3', userId: null, email: 'kai@x.test', name: null, role: 'member', status: 'invited' },
  ],
  inviteLink: null,
});

function host(team: TeamDetails): TeamsHost {
  const ok = vi.fn(async () => ({ ok: true as const, value: null }));
  return {
    myTeams: vi.fn(async () => ({
      teams: [{ id: 't1', name: team.team.name, memberCount: 2 }],
      invitations: [],
    })),
    team: vi.fn(async () => team),
    create: vi.fn(),
    update: vi.fn(),
    remove: ok,
    invite: vi.fn(),
    setRole: ok,
    removeMember: vi.fn(),
    resetInviteLink: vi.fn(),
    clearInviteLink: ok,
    answer: vi.fn(),
  } as unknown as TeamsHost;
}

// Noon UTC on a day of November 2026.
const at = (day: number) => Date.UTC(2026, 10, day, 12);

function row(
  n: number,
  type: TeamAuditEventType,
  over: Partial<TeamAuditEvent> = {},
): TeamAuditEvent & { team: string } {
  return {
    team: 't1',
    id: `e${n}`,
    type,
    app: 'liveplanner',
    actor: { id: 'user_ann', name: 'Ann Lee' },
    subject: null,
    itemId: `i${n}`,
    title: `Plan ${n}`,
    detail: null,
    occurredAt: at(30) - n * 60_000,
    ...over,
  };
}

function renderTeam(
  index: ReturnType<typeof createFakeIndex>,
  team: TeamDetails = details(),
  helpHref?: (view: { kind: string }) => string | undefined,
) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'team', id: 't1' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
      teams={[{ id: 't1', name: team.team.name }]}
      teamsHost={host(team)}
      helpHref={helpHref}
    />,
  );
}

const toggle = () => screen.findByRole('button', { name: /Audit Log/ });
const reads = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.filter((c) => c.method === 'teamAudit').map((c) => c.args[0]);
const rows = () => document.querySelectorAll('[data-audit-event]');

async function open(index: ReturnType<typeof createFakeIndex>, team?: TeamDetails) {
  renderTeam(index, team);
  fireEvent.click(await toggle());
}

describe('the Audit Log', () => {
  it('is an admin’s alone: a member sees no section and reads nothing', async () => {
    const index = createFakeIndex({ audit: [row(1, 'shared')] });
    renderTeam(index, details('member'));
    // The card has loaded (its headline says the reader's not an admin), and still no section.
    await screen.findByText(/2 members/);
    expect(screen.queryByRole('button', { name: /Audit Log/ })).toBeNull();
    expect(reads(index)).toEqual([]);
  });

  it('is closed until opened, then reads the first page and words each row', async () => {
    const index = createFakeIndex({
      audit: [
        row(1, 'shared', { detail: { level: 'edit' } }),
        row(2, 'team_member_removed', {
          app: 'liveworkspace',
          itemId: null,
          title: 'Design Ops',
          subject: { id: 'user_bo', name: 'Bo Chen' },
        }),
        row(3, 'webhook_added', {
          app: 'liveworkspace',
          title: 'Alerts',
          detail: { kind: 'slack', host: 'hooks.slack.com' },
          occurredAt: at(29),
        }),
        { ...row(4, 'shared'), team: 't2' },
      ],
    });
    renderTeam(index);
    const button = await toggle();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toContain('Admins only · kept a year');
    expect(reads(index)).toEqual([]);
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    // Placeholder rows while the first page is read.
    expect(document.querySelector('[data-audit-loading]')).toBeTruthy();
    await waitFor(() => expect(rows().length).toBe(3));
    expect(reads(index)).toEqual([{ team: 't1', limit: 50 }]);
    const [first, second, third] = [...rows()] as HTMLElement[];
    expect(first!.textContent).toContain('Ann Lee made a share link on Plan 1');
    expect(first!.textContent).toContain('Share Link Made');
    expect(first!.textContent).toContain('Anyone with the link can edit');
    expect(first!.querySelector('[data-app-mark="liveplanner"]')).toBeTruthy();
    expect(second!.textContent).toContain('Ann Lee removed Bo Chen');
    expect(second!.textContent).toContain('liveworkspace');
    expect(third!.textContent).toContain('Ann Lee added the webhook hooks.slack.com');
    expect(third!.textContent).toContain('Slack');
    // Two days, two bands; the UTC time is the row's tooltip.
    expect(document.querySelectorAll('[data-audit-day]').length).toBe(2);
    expect(first!.querySelector('time')!.getAttribute('title')).toBe('2026-11-30 11:59 UTC');
    expect(screen.getByText('3 events')).toBeTruthy();
    fireEvent.click(button);
    expect(rows().length).toBe(0);
  });

  it('sends every filter as the read takes it, and Clear Filters reads everything again', async () => {
    const index = createFakeIndex({
      audit: [
        row(1, 'shared'),
        row(2, 'trashed', { actor: { id: 'user_gone', name: 'Cy Old' } }),
        row(3, 'moved', { occurredAt: at(10) }),
      ],
    });
    await open(index);
    await waitFor(() => expect(rows().length).toBe(3));
    const person = screen.getByLabelText('Person') as HTMLSelectElement;
    // Joined members by name, then someone the rows name who is no longer in the team.
    expect([...person.options].map((o) => o.textContent)).toEqual([
      'Everyone',
      'Ann Lee',
      'Sam Doe',
      'Cy Old (not in the team)',
    ]);
    fireEvent.change(person, { target: { value: 'user_gone' } });
    await waitFor(() => expect(rows().length).toBe(1));
    expect(reads(index).at(-1)).toEqual({ team: 't1', person: 'user_gone', limit: 50 });
    expect(person.value).toBe('user_gone');
    expect(screen.getByText('1 event match')).toBeTruthy();
    // Their name stays offered when no loaded row names them any more.
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'deleted' } });
    expect(await screen.findByText('No Events Match')).toBeTruthy();
    expect(person.value).toBe('user_gone');
    expect(person.selectedOptions[0]!.textContent).toBe('Cy Old (not in the team)');

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear Filters' })[0]!);
    await waitFor(() => expect(rows().length).toBe(3));

    const kind = screen.getByLabelText('Event') as HTMLSelectElement;
    const groups = [...kind.querySelectorAll('optgroup')].map((g) => g.label);
    // liveplanner's word for its items names the middle group.
    expect(groups).toEqual(['People', 'Plans', 'Webhooks']);
    // No token or OAuth app kind is offered.
    expect([...kind.options].some((o) => /token|oauth/i.test(o.value))).toBe(false);
    fireEvent.change(kind, { target: { value: 'moved' } });
    await waitFor(() => expect(rows().length).toBe(1));
    expect(reads(index).at(-1)).toEqual({ team: 't1', kind: 'moved', limit: 50 });

    // From and To are whole local days, both included; one after the other is turned round.
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-05' } });
    await waitFor(() =>
      expect(reads(index).at(-1)).toEqual({
        team: 't1',
        kind: 'moved',
        from: new Date(2026, 10, 5).getTime(),
        to: new Date(2026, 10, 13).getTime(),
        limit: 50,
      }),
    );
    await waitFor(() => expect(rows().length).toBe(1));
  });

  it('says when nothing matches, and offers to clear the filters', async () => {
    const index = createFakeIndex({ audit: [row(1, 'shared')] });
    await open(index);
    await waitFor(() => expect(rows().length).toBe(1));
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'deleted' } });
    expect(await screen.findByText('No Events Match')).toBeTruthy();
    const empty = screen.getByText('No Events Match').closest('[data-empty-state]') as HTMLElement;
    fireEvent.click(within(empty).getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => expect(rows().length).toBe(1));
  });

  it('says so when the team has no events yet', async () => {
    await open(createFakeIndex());
    expect(await screen.findByText('No Audit Events Yet')).toBeTruthy();
    expect(screen.getByText('No events')).toBeTruthy();
  });

  it('pages with Show More, and keeps the rows when the next page fails', async () => {
    const audit = Array.from({ length: 120 }, (_, i) => row(i + 1, 'shared'));
    const index = createFakeIndex({ audit });
    await open(index);
    await waitFor(() => expect(rows().length).toBe(50));
    expect(screen.getByText('50+ events')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show More' }));
    await waitFor(() => expect(rows().length).toBe(100));
    expect(reads(index).at(-1)).toEqual({ team: 't1', limit: 50, cursor: '50' });
    index.fail.set('teamAudit', new IndexError(500, 'internal'));
    fireEvent.click(screen.getByRole('button', { name: 'Show More' }));
    expect(await screen.findByText(/Couldn’t load the rest of this list/)).toBeTruthy();
    expect(rows().length).toBe(100);
    index.fail.delete('teamAudit');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(rows().length).toBe(120));
    expect(screen.queryByRole('button', { name: 'Show More' })).toBeNull();
  });

  it('tells an admin who has just stepped down that it is the admins’ alone', async () => {
    const index = createFakeIndex();
    index.fail.set('teamAudit', new IndexError(403, 'not_team_admin'));
    await open(index);
    expect(await screen.findByText('Only the team’s admins can see its audit log.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Export CSV/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('offers Try again when accounts can’t say who runs the team (503)', async () => {
    const index = createFakeIndex({ audit: [row(1, 'restored')] });
    index.fail.set('teamAudit', new IndexError(503, 'team_audit_unavailable'));
    await open(index);
    expect(await screen.findByText('Couldn’t load the audit log')).toBeTruthy();
    index.fail.delete('teamAudit');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(rows().length).toBe(1));
  });

  it('links its help article in the same help centre as the team’s', async () => {
    renderTeam(createFakeIndex(), details(), () => 'https://x.test/help/explorer/team-spaces/');
    fireEvent.click(await toggle());
    const help = await screen.findByRole('link', { name: 'Help: the audit log' });
    expect(help.getAttribute('href')).toBe('https://x.test/help/collaboration/teams/audit-log/');
  });

  it('exports every file the filters match as one CSV under one header', async () => {
    const index = createFakeIndex({
      audit: [row(1, 'shared')],
      auditFiles: ['\uFEFFTime,Event\r\na,1\r\nb,"two\r\nlines"\r\n', 'Time,Event\r\nc,3\r\n'],
    });
    await open(index);
    await waitFor(() => expect(rows().length).toBe(1));
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'shared' } });
    await waitFor(() => expect(reads(index).length).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(saved.files.length).toBe(1));
    const calls = index.calls.filter((c) => c.method === 'teamAuditCsv').map((c) => c.args[0]);
    expect(calls).toEqual([
      { team: 't1', kind: 'shared' },
      { team: 't1', kind: 'shared', cursor: '1' },
    ]);
    const file = saved.files[0]!;
    expect(file.name).toMatch(/^design-ops-audit-log-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(file.blob.type).toBe('text/csv;charset=utf-8');
    // One byte-order mark, so a spreadsheet reads the names as UTF-8 (a text read drops it, so read the bytes).
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    expect(Array.from(bytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe(
      'Time,Event\r\na,1\r\nb,"two\r\nlines"\r\nc,3\r\n',
    );
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy();
  });

  it('says so when an export fails, and saves nothing', async () => {
    const index = createFakeIndex({ audit: [row(1, 'shared')], auditFiles: ['Time\r\n'] });
    index.fail.set('teamAuditCsv', new IndexError(503, 'team_audit_unavailable'));
    await open(index);
    await waitFor(() => expect(rows().length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText('Couldn’t export the audit log. Try again.')).toBeTruthy();
    expect(saved.files).toEqual([]);
  });

  it('stops at the file cap and says the newest rows were saved', async () => {
    const files = Array.from({ length: AUDIT_EXPORT_FILES_MAX + 2 }, (_, i) => `Time\r\nr${i}\r\n`);
    const index = createFakeIndex({ audit: [row(1, 'shared')], auditFiles: files });
    await open(index);
    await waitFor(() => expect(rows().length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(
      await screen.findByText(/Saved the newest 20 events\. Narrow the dates to export the rest\./),
    ).toBeTruthy();
    expect(index.count('teamAuditCsv')).toBe(AUDIT_EXPORT_FILES_MAX);
  });
});

describe('exportAuditCsv', () => {
  it('counts rows outside quoted cells and reports progress per file', async () => {
    const index = createFakeIndex({ auditFiles: ['H\r\n"a\nb",1\r\nc\r\n', 'H\r\nd\r\n', ''] });
    const progress: number[] = [];
    const done = await exportAuditCsv(index.client, { team: 't1' }, (n) => progress.push(n));
    expect(done).toEqual({ csv: 'H\r\n"a\nb",1\r\nc\r\nd\r\n', rows: 3, capped: false });
    expect(progress).toEqual([2, 3, 3]);
  });

  it('keeps a whole year of a busy team inside a CPU budget', async () => {
    const line =
      '2026-11-01T12:00:00.000Z,Share Link Made,shared,liveplanner,Ann Lee,user_ann,,,Plan,i1,level=edit\r\n';
    const file = `H\r\n${line.repeat(10_000)}`;
    const index = createFakeIndex({ auditFiles: Array.from({ length: 5 }, () => file) });
    let rows = 0;
    const ms = await cpuMsOfAsync(async () => {
      rows = (await exportAuditCsv(index.client, { team: 't1' })).rows;
    });
    expect(rows).toBe(50_000);
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});
