// What a team's Audit Log row says (team-audit-log.md "The Audit Log on a team's view"): every kind's line and
// detail, closed and unnamed people, the Event filter's groups, the From and To range, and the file's name.
import { describe, expect, it } from 'vitest';
import {
  TEAM_AUDIT_EVENT_TYPES,
  type App,
  type TeamAuditEvent,
  type TeamAuditEventType,
} from '@liveworkspace/index-client';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  auditDetail,
  auditGroups,
  auditSentence,
  dayRange,
  fileSlug,
  personWords,
  type AuditSentence,
} from './rows';
import { kindWords } from '../../words';

const ev = (type: TeamAuditEventType, over: Partial<TeamAuditEvent> = {}): TeamAuditEvent => ({
  id: 'e1',
  type,
  app: 'livediagram',
  actor: { id: 'user_ann', name: 'Ann Lee' },
  subject: { id: 'user_bo', name: 'Bo Chen' },
  itemId: 'i1',
  title: 'Roadmap',
  detail: null,
  occurredAt: 0,
  ...over,
});

const line = (s: AuditSentence) => [s.who, s.action, s.target, s.after].filter(Boolean).join(' ');
const says = (type: TeamAuditEventType, over: Partial<TeamAuditEvent> = {}) =>
  line(auditSentence(ev(type, over), 't1'));

describe('auditSentence', () => {
  it('words every kind', () => {
    expect(says('team_invite_sent', { detail: { role: 'admin' } })).toBe(
      'Ann Lee invited Bo Chen as an Admin',
    );
    expect(says('team_invite_sent', { subject: null, detail: { memberName: 'kai@x.test' } })).toBe(
      'Ann Lee invited kai@x.test as a Member',
    );
    expect(says('team_joined')).toBe('Ann Lee joined the team');
    expect(says('team_joined', { detail: { via: 'link' } })).toBe(
      'Ann Lee joined by the invite link',
    );
    expect(says('team_declined')).toBe('Ann Lee declined the invitation');
    expect(says('team_role_changed', { detail: { role: 'admin' } })).toBe(
      'Ann Lee made Bo Chen an Admin',
    );
    expect(says('team_member_removed')).toBe('Ann Lee removed Bo Chen');
    expect(says('team_member_removed', { detail: { left: '1' } })).toBe('Ann Lee left the team');
    expect(says('team_renamed', { title: 'Design Ops' })).toBe(
      'Ann Lee renamed the team to Design Ops',
    );
    expect(says('shared')).toBe('Ann Lee made a share link on Roadmap');
    expect(says('shared', { detail: { public: 'true' } })).toBe(
      'Ann Lee made a public link on Roadmap',
    );
    expect(says('unshared')).toBe('Ann Lee removed a share link from Roadmap');
    expect(says('moved', { detail: { fromTeamId: 't1', teamId: null } })).toBe(
      'Ann Lee moved Roadmap out of the team',
    );
    expect(says('moved', { detail: { fromTeamId: null, teamId: 't1' } })).toBe(
      'Ann Lee moved Roadmap into the team',
    );
    expect(says('trashed')).toBe('Ann Lee moved Roadmap to the Trash');
    expect(says('restored')).toBe('Ann Lee restored Roadmap from the Trash');
    expect(says('deleted')).toBe('Ann Lee deleted Roadmap for good');
    expect(says('webhook_added', { detail: { host: 'hooks.slack.com' } })).toBe(
      'Ann Lee added the webhook hooks.slack.com',
    );
    expect(says('webhook_removed', { title: 'Alerts' })).toBe('Ann Lee removed the webhook Alerts');
  });

  it('has a line for every kind the log keeps', () => {
    for (const type of TEAM_AUDIT_EVENT_TYPES) expect(says(type)).toMatch(/^Ann Lee \S/);
  });

  it('names closed accounts and people nobody could name', () => {
    expect(says('shared', { actor: { id: 'deleted', name: null }, title: '  ' })).toBe(
      'Deleted account made a share link on Untitled',
    );
    expect(says('team_member_removed', { subject: { id: 'deleted', name: null } })).toBe(
      'Ann Lee removed Deleted account',
    );
    expect(says('team_member_removed', { subject: { id: 'user_x', name: null } })).toBe(
      'Ann Lee removed a member',
    );
    expect(personWords(null)).toBe('Someone');
    expect(personWords({ id: 'user_x', name: ' ' })).toBe('Someone');
  });
});

describe('auditDetail', () => {
  it('says what matters beside the label', () => {
    expect(auditDetail(ev('shared', { detail: { level: 'view' } }))).toBe(
      'Anyone with the link can view',
    );
    expect(auditDetail(ev('shared', { detail: { level: 'other' } }))).toBeNull();
    expect(auditDetail(ev('shared', { detail: { public: 'true' } }))).toBe('Community post');
    expect(auditDetail(ev('team_renamed', { detail: { from: 'Old' } }))).toBe('Was “⁨Old⁩”');
    expect(auditDetail(ev('team_renamed'))).toBeNull();
    expect(auditDetail(ev('deleted', { detail: { reason: 'offline' } }))).toBe('Taken offline');
    expect(auditDetail(ev('deleted'))).toBeNull();
    expect(auditDetail(ev('webhook_added', { detail: { kind: 'teams' } }))).toBe('Microsoft Teams');
    expect(auditDetail(ev('webhook_removed', { detail: { kind: 'json' } }))).toBe('Signed JSON');
    expect(auditDetail(ev('webhook_removed', { detail: { kind: 'odd' } }))).toBeNull();
    expect(auditDetail(ev('trashed'))).toBeNull();
  });
});

describe('auditGroups', () => {
  it('offers every kind once, and never a token’s', () => {
    const kinds = auditGroups('Designs').flatMap((g) => g.kinds);
    expect([...kinds].sort()).toEqual([...TEAM_AUDIT_EVENT_TYPES].sort());
  });

  it('names the items group in each app’s word for its items', () => {
    const labels = (app: App) => auditGroups(kindWords(app).many).map((g) => g.label);
    expect(labels('livedesign')).toEqual(['People', 'Designs', 'Webhooks']);
    expect(labels('livediagram')).toEqual(['People', 'Canvases', 'Webhooks']);
    expect(labels('liveplanner')).toEqual(['People', 'Plans', 'Webhooks']);
    expect(labels('livedocuments')).toEqual(['People', 'Documents', 'Webhooks']);
    expect(labels('livehuddle')).toEqual(['People', 'Spaces', 'Webhooks']);
  });
});

describe('dayRange', () => {
  it('takes whole local days, both included, and turns a backwards range round', () => {
    expect(dayRange(undefined, undefined)).toEqual({ from: undefined, to: undefined });
    expect(dayRange('2026-11-02', undefined)).toEqual({
      from: new Date(2026, 10, 2).getTime(),
      to: undefined,
    });
    expect(dayRange(undefined, '2026-11-30')).toEqual({
      from: undefined,
      to: new Date(2026, 11, 1).getTime(),
    });
    expect(dayRange('2026-11-09', '2026-11-03')).toEqual({
      from: new Date(2026, 10, 3).getTime(),
      to: new Date(2026, 10, 10).getTime(),
    });
    expect(dayRange('nope', undefined)).toEqual({ from: undefined, to: undefined });
  });

  it('bounds nothing with a day that is not on the calendar, rather than rolling it into the next month', () => {
    expect(dayRange('2026-02-31', '2026-13-01')).toEqual({ from: undefined, to: undefined });
    expect(dayRange('2026-00-10', '2026-04-00')).toEqual({ from: undefined, to: undefined });
    expect(dayRange('2028-02-29', '2026-02-29')).toEqual({
      from: undefined,
      to: new Date(2028, 2, 1).getTime(),
    });
    const early = new Date(2000, 0, 1);
    early.setFullYear(50, 0, 1);
    expect(dayRange('0050-01-01', undefined).from).toBe(early.getTime());
  });
});

describe('fileSlug', () => {
  it('makes a file name of any team name in one pass', () => {
    expect(fileSlug('Northwind Ops')).toBe('northwind-ops');
    expect(fileSlug('  Café / R&D!  ')).toBe('cafe-r-d');
    expect(fileSlug('🚀')).toBe('team');
    expect(fileSlug('a'.repeat(100))).toHaveLength(60);
    const long = `${'- '.repeat(50_000)}x`;
    expect(cpuMsOf(() => fileSlug(long))).toBeLessThan(cpuBudgetMs(50));
  });
});
