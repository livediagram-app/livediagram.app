import { describe, expect, it } from 'vitest';
import { APPS, TITLE_MAX } from './constants';
import {
  appConnectionPath,
  CONNECTION_DEFAULT_LEVEL,
  connectionDefaultLevel,
  connectionLevels,
  isConnectionId,
  itemConnectedTabsPath,
  parseTabConnectionText,
  readConnectedTabWrite,
  readConnectionInput,
  readTabConnection,
  TAB_CONNECTION_TEXT_MAX,
  tabConnectionText,
} from './connections';

const ID = 'cn_0123456789abcdefXYZ';
const good = { id: ID, app: 'liveplanner', itemId: 'plan_1-a' } as const;

describe('connection ids', () => {
  it('takes cn_ and 16 to 64 letters and digits only', () => {
    expect(isConnectionId(ID)).toBe(true);
    expect(isConnectionId(`cn_${'a'.repeat(64)}`)).toBe(true);
    expect(isConnectionId(`cn_${'a'.repeat(15)}`)).toBe(false);
    expect(isConnectionId(`cn_${'a'.repeat(65)}`)).toBe(false);
    expect(isConnectionId('xx_0123456789abcdef')).toBe(false);
    expect(isConnectionId('cn_0123456789abcde-')).toBe(false);
    expect(isConnectionId(42)).toBe(false);
  });
});

describe('readTabConnection', () => {
  it('keeps exactly id, app and itemId', () => {
    const read = readTabConnection({ ...good, code: 'SECRET', href: 'https://evil.example' });
    expect(read).toEqual(good);
    expect(Object.keys(read ?? {})).toEqual(['id', 'app', 'itemId']);
  });

  it('takes every app', () => {
    for (const app of APPS) expect(readTabConnection({ ...good, app })?.app).toBe(app);
  });

  it.each([
    ['null', null],
    ['a string', 'cn_x'],
    ['an array', [good]],
    ['a bad id', { ...good, id: 'nope' }],
    ['an unknown app', { ...good, app: 'livepages' }],
    ['an empty item id', { ...good, itemId: '' }],
    ['an item id with a slash', { ...good, itemId: '../x' }],
    ['an over-long item id', { ...good, itemId: 'a'.repeat(201) }],
  ])('refuses %s', (_, value) => {
    expect(readTabConnection(value)).toBeNull();
  });
});

describe('the stored column', () => {
  it('round-trips in a fixed key order', () => {
    const text = tabConnectionText({ itemId: 'p', app: 'livedesign', id: ID } as never);
    expect(text).toBe(`{"id":"${ID}","app":"livedesign","itemId":"p"}`);
    expect(parseTabConnectionText(text)).toEqual({ id: ID, app: 'livedesign', itemId: 'p' });
  });

  it('reads empty, malformed and over-long text as no connection', () => {
    expect(parseTabConnectionText(null)).toBeNull();
    expect(parseTabConnectionText(undefined)).toBeNull();
    expect(parseTabConnectionText('')).toBeNull();
    expect(parseTabConnectionText('{not json')).toBeNull();
    expect(parseTabConnectionText('{"id":"x"}')).toBeNull();
    const long = JSON.stringify({ ...good, pad: 'x'.repeat(TAB_CONNECTION_TEXT_MAX) });
    expect(parseTabConnectionText(long)).toBeNull();
  });
});

describe('roles', () => {
  it('starts at Editor in every app, as the owner asked', () => {
    expect(CONNECTION_DEFAULT_LEVEL).toBe('edit');
    for (const app of APPS) expect(connectionDefaultLevel(app)).toBe('edit');
  });

  it("offers the target app's link levels", () => {
    expect(connectionLevels('livediagram')).toEqual(['edit', 'participate', 'view']);
    expect(connectionLevels('livehuddle')).toEqual(['edit', 'participate']);
  });

  it("falls back to the app's own default when Editor is not offered", async () => {
    const { APP_LINK_LEVELS } = await import('./constants');
    const levels = APP_LINK_LEVELS as Record<'livehuddle', readonly string[]>;
    const before = levels.livehuddle;
    levels.livehuddle = ['participate'];
    try {
      expect(connectionDefaultLevel('livehuddle')).toBe('participate');
    } finally {
      levels.livehuddle = before;
    }
  });
});

describe('readConnectionInput', () => {
  it('takes a target and a tab, with an optional level and both', () => {
    expect(readConnectionInput({ targetId: 't1', tabId: 'tab1' })).toEqual({
      targetId: 't1',
      tabId: 'tab1',
    });
    expect(
      readConnectionInput({ targetId: 't1', tabId: 'tab1', level: 'view', both: true, x: 1 }),
    ).toEqual({ targetId: 't1', tabId: 'tab1', level: 'view', both: true });
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['no target', { tabId: 'tab1' }],
    ['no tab', { targetId: 't1' }],
    ['a bad level', { targetId: 't1', tabId: 'tab1', level: 'owner' }],
    ['a string both', { targetId: 't1', tabId: 'tab1', both: 'yes' }],
  ])('refuses %s', (_, value) => {
    expect(readConnectionInput(value)).toBeNull();
  });
});

describe('the reverse write', () => {
  it('has its path under the app internal door', () => {
    expect(itemConnectedTabsPath('a/b')).toBe('/items/a%2Fb/connected-tabs');
  });

  it('takes a trimmed name, cut to the title length, and one connection', () => {
    expect(readConnectedTabWrite({ name: '  Roadmap ', connection: good, tabs: [] })).toEqual({
      name: 'Roadmap',
      connection: good,
    });
    const long = readConnectedTabWrite({ name: 'x'.repeat(TITLE_MAX + 5), connection: good });
    expect(long?.name).toHaveLength(TITLE_MAX);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['no connection', { name: 'A' }],
    ['a bad connection', { name: 'A', connection: { ...good, app: 'x' } }],
    ['no name', { connection: good }],
    ['a blank name', { name: '   ', connection: good }],
  ])('refuses %s', (_, value) => {
    expect(readConnectedTabWrite(value)).toBeNull();
  });
});

describe("the host app's removal door", () => {
  it('names the host, the connection and the tab', () => {
    expect(appConnectionPath('doc 1', ID, 't/1')).toBe(
      `/app/items/doc%201/connections/${ID}?tab=t%2F1`,
    );
  });
});
