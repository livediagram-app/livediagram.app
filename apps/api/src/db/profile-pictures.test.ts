// The published profile picture in D1 (docs/specs/014-identity/profile-picture.md §6), against the
// real migrations: the participant record, joined team members, and the room ticket's account bit.

import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { getParticipant, setParticipantPicture, upsertParticipant } from './participants';
import { listTeamMembers } from './teams';
import { consumeWsTicket, createWsTicket } from './ws-tickets';

const PICTURE = 'https://img.clerk.com/eyJ0eXBlIjoicHJveHkifQ?width=96&height=96&fit=crop';

describe('participant pictures', () => {
  it('stores, clears and survives a name save', async () => {
    const { env } = sqliteD1();
    await upsertParticipant(env, {
      id: 'user_a',
      name: 'Ann',
      color: '#f00',
      createdAt: 1,
      pictureUrl: null,
    });
    expect(await setParticipantPicture(env, 'user_a', PICTURE)).toBe(true);
    await upsertParticipant(env, {
      id: 'user_a',
      name: 'Anne',
      color: '#0f0',
      createdAt: 1,
      pictureUrl: null,
    });
    expect((await getParticipant(env, 'user_a'))?.pictureUrl).toBe(PICTURE);
    await setParticipantPicture(env, 'user_a', null);
    expect((await getParticipant(env, 'user_a'))?.pictureUrl).toBeNull();
  });

  it('reports a missing participant row', async () => {
    const { env } = sqliteD1();
    expect(await setParticipantPicture(env, 'user_nobody', PICTURE)).toBe(false);
  });

  it('gives joined team members their picture, never a pending invitee', async () => {
    const { env, sql } = sqliteD1();
    sql.exec(
      `INSERT INTO teams (id, name, organisation, created_at, updated_at) VALUES ('t1', 'Crew', NULL, 1, 1)`,
    );
    sql.exec(`INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
              VALUES ('m1', 't1', 'user_a', 'a@x.test', 'admin', 'joined', 1, 1),
                     ('m2', 't1', 'user_b', 'b@x.test', 'member', 'invited', 1, 1)`);
    for (const id of ['user_a', 'user_b']) {
      await upsertParticipant(env, { id, name: id, color: '#f00', createdAt: 1, pictureUrl: null });
      await setParticipantPicture(env, id, PICTURE);
    }
    const members = await listTeamMembers(env, 't1');
    expect(members.find((m) => m.id === 'm1')?.pictureUrl).toBe(PICTURE);
    expect(members.find((m) => m.id === 'm2')?.pictureUrl).toBeNull();
  });
});

describe('room ticket account bit', () => {
  it('carries whether a verified account minted the ticket', async () => {
    const { env } = sqliteD1();
    const base = { role: 'edit' as const, tabScope: null, shareCode: null, workbenchPairing: null };
    const account = await createWsTicket(env, 'd1', { ...base, account: true, personTag: null });
    const guest = await createWsTicket(env, 'd1', { ...base, account: false, personTag: null });
    expect((await consumeWsTicket(env, account, 'd1'))?.account).toBe(true);
    expect((await consumeWsTicket(env, guest, 'd1'))?.account).toBe(false);
  });
});
