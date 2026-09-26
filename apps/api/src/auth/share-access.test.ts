import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareLink } from '@livediagram/api-schema';
import type { Env } from '../types';

// The share-side rules the REST gates, the share-code resolve, and the room
// upgrade all compose. `../db` is stubbed so each case drives the link and
// password state directly.
const getShareLinkMock = vi.fn<(env: Env, code: string) => Promise<ShareLink | null>>();
const getSharePasswordMock = vi.fn<(env: Env, id: string) => Promise<string | null>>();
vi.mock('../db', () => ({
  getShareLink: (env: Env, code: string) => getShareLinkMock(env, code),
  getDiagramSharePassword: (env: Env, id: string) => getSharePasswordMock(env, id),
}));

import {
  isPersonalOwner,
  shareLinkForDiagram,
  sharePasswordOk,
  sharePasswordStatus,
} from './share-access';

const ENV = {} as Env;
const link = (diagramId: string, role: 'edit' | 'view') => ({ diagramId, role }) as ShareLink;

beforeEach(() => {
  getShareLinkMock.mockReset();
  getSharePasswordMock.mockReset();
  getSharePasswordMock.mockResolvedValue(null);
});

describe('isPersonalOwner', () => {
  it('accepts a matching owner on a personal diagram', () => {
    expect(isPersonalOwner('a', 'a', null)).toBe(true);
  });
  it('never accepts the bare owner id on a team diagram', () => {
    expect(isPersonalOwner('a', 'a', 'team-1')).toBe(false);
  });
  it('rejects a missing or different owner', () => {
    expect(isPersonalOwner(null, 'a', null)).toBe(false);
    expect(isPersonalOwner('b', 'a', null)).toBe(false);
  });
});

describe('shareLinkForDiagram', () => {
  it('returns the link when it belongs to the diagram', async () => {
    getShareLinkMock.mockResolvedValue(link('d1', 'view'));
    expect(await shareLinkForDiagram(ENV, 'code', 'd1')).toEqual(link('d1', 'view'));
  });
  it('refuses a code for a different diagram', async () => {
    getShareLinkMock.mockResolvedValue(link('d2', 'edit'));
    expect(await shareLinkForDiagram(ENV, 'code', 'd1')).toBeNull();
  });
  it('skips the lookup for a missing or empty code', async () => {
    expect(await shareLinkForDiagram(ENV, null, 'd1')).toBeNull();
    expect(await shareLinkForDiagram(ENV, '', 'd1')).toBeNull();
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });
});

describe('sharePasswordStatus', () => {
  it('is ok when the diagram has no password', async () => {
    expect(await sharePasswordStatus(ENV, 'd1', null)).toBe('ok');
  });
  it('tells a missing password apart from a wrong one', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    expect(await sharePasswordStatus(ENV, 'd1', null)).toBe('missing');
    expect(await sharePasswordStatus(ENV, 'd1', '')).toBe('invalid');
    expect(await sharePasswordStatus(ENV, 'd1', 'wrong')).toBe('invalid');
    expect(await sharePasswordStatus(ENV, 'd1', 'hunter2')).toBe('ok');
  });
  it('sharePasswordOk is true only for ok', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    expect(await sharePasswordOk(ENV, 'd1', null)).toBe(false);
    expect(await sharePasswordOk(ENV, 'd1', 'hunter2')).toBe(true);
  });
});
