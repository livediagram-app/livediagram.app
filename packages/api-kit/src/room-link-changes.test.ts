import { ACCESS_CHANGED_CLOSE } from '@liveworkspace/api-schema/room-wire';
import { describe, expect, it, vi } from 'vitest';
import {
  GRANT_ISSUED_HEADER,
  grantIssuedMs,
  grantIssuedOf,
  LinkChanges,
  turnAwayStaleLinkJoin,
} from './room-link-changes';

describe('LinkChanges', () => {
  it('turns away a grant signed before its link changed, at or after the change only', () => {
    const changes = new LinkChanges();
    changes.note('ABC', 1_000);
    expect(changes.changedSince('ABC', 999)).toBe(true);
    expect(changes.changedSince('ABC', 1_000)).toBe(true);
    expect(changes.changedSince('ABC', 1_001)).toBe(false);
  });

  it('lets in another link, no link, and an unknown signing moment', () => {
    const changes = new LinkChanges();
    changes.note('ABC', 1_000);
    expect(changes.changedSince('XYZ', 0)).toBe(false);
    expect(changes.changedSince(null, 0)).toBe(false);
    expect(changes.changedSince('', 0)).toBe(false);
    expect(changes.changedSince('ABC', null)).toBe(false);
    expect(changes.changedSince('ABC', undefined)).toBe(false);
  });

  it('keeps the latest change of a link noted twice', () => {
    const changes = new LinkChanges();
    changes.note('ABC', 1_000);
    changes.note('ABC', 5_000);
    expect(changes.changedSince('ABC', 2_000)).toBe(true);
    expect(changes.size).toBe(1);
  });

  it('sheds changes older than any grant lives, and stays bounded', () => {
    const changes = new LinkChanges();
    changes.note('OLD', 0);
    changes.note('NEW', 60 * 60 * 1000 + 1);
    expect(changes.changedSince('OLD', 0)).toBe(false);
    expect(changes.size).toBe(1);
    for (let i = 0; i < 1_000; i++) changes.note(`C${i}`, 2 * 60 * 60 * 1000);
    expect(changes.size).toBe(256);
    expect(changes.changedSince('C999', 0)).toBe(true);
    expect(changes.changedSince('C0', 0)).toBe(false);
  });
});

describe('grant signing moment', () => {
  it('prefers iatMs and falls back to iat in seconds', () => {
    expect(grantIssuedMs({ iat: 12, iatMs: 12_345 })).toBe(12_345);
    expect(grantIssuedMs({ iat: 12 })).toBe(12_000);
  });

  it('reads the header, refusing what is not a positive number', () => {
    const at = (value?: string) =>
      grantIssuedOf(
        new Request('https://x.test/', value ? { headers: { [GRANT_ISSUED_HEADER]: value } } : {}),
      );
    expect(at('12345')).toBe(12_345);
    expect(at()).toBeNull();
    expect(at('nope')).toBeNull();
    expect(at('0')).toBeNull();
    expect(at('-5')).toBeNull();
  });
});

describe('turnAwayStaleLinkJoin', () => {
  const upgrade = (issued: number) =>
    new Request('https://x.test/ws', { headers: { [GRANT_ISSUED_HEADER]: String(issued) } });
  const socket = () =>
    ({ accept: vi.fn(), close: vi.fn() }) as unknown as WebSocket & {
      accept: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };

  it('accepts and closes, access changed, a join on a grant signed before its link changed', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const changes = new LinkChanges();
    changes.note('ABC', 2_000);
    const ws = socket();
    expect(turnAwayStaleLinkJoin(changes, 'ABC', upgrade(1_500), ws)).toBe(true);
    expect(ws.accept).toHaveBeenCalledOnce();
    expect(ws.close).toHaveBeenCalledWith(ACCESS_CHANGED_CLOSE, 'access-changed');
  });

  it('leaves alone a join on a grant signed after the change, or by another link', () => {
    const changes = new LinkChanges();
    changes.note('ABC', 2_000);
    const ws = socket();
    expect(turnAwayStaleLinkJoin(changes, 'ABC', upgrade(2_500), ws)).toBe(false);
    expect(turnAwayStaleLinkJoin(changes, 'XYZ', upgrade(1_500), ws)).toBe(false);
    expect(turnAwayStaleLinkJoin(changes, null, upgrade(1_500), ws)).toBe(false);
    expect(ws.accept).not.toHaveBeenCalled();
    expect(ws.close).not.toHaveBeenCalled();
  });
});
