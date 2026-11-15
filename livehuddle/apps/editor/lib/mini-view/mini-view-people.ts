// Who the mini view shows, and in what order (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint:
// space-mini-view.md "The people"): you first, then everyone with a character on your tab, the people you hear under
// Near You and the rest under In the Space, each group by name. Pure, and keyed by value, so a coarse tick that only
// moved someone gives the same key and the window renders nothing.
import { peerAvatarConfig, type AvatarConfig } from '@livehuddle/avatar/config';
import { parseAvatarStatus, type AvatarStatus } from '@livehuddle/avatar/status';
import type { RemoteAvatarRow } from '@/lib/presence-rows';

/** A row's facts: no position, so walking changes none of them. */
export type MiniPerson = {
  id: string;
  name: string;
  color: string;
  config: AvatarConfig;
  status: AvatarStatus | null;
  self: boolean;
};

export type MiniGroup = { id: 'near' | 'space'; people: MiniPerson[] };

export type MiniSelf = {
  name: string;
  color: string;
  config: AvatarConfig;
  status: AvatarStatus | null;
};

export type MiniPeopleInput = {
  self: MiniSelf;
  rows: readonly Pick<RemoteAvatarRow, 'id' | 'name' | 'color' | 'avatar'>[];
  // The presence ids you hear now (the call's `heard`).
  heard: ReadonlySet<string>;
};

/** Your own row's id: no presence id is empty. */
export const MINI_SELF_ID = '';
export const MINI_SELF_NAME = 'You';

const byName = (a: MiniPerson, b: MiniPerson) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function miniViewPeople(input: MiniPeopleInput): { count: number; groups: MiniGroup[] } {
  const you: MiniPerson = {
    id: MINI_SELF_ID,
    name: MINI_SELF_NAME,
    color: input.self.color,
    config: input.self.config,
    status: input.self.status,
    self: true,
  };
  const near: MiniPerson[] = [];
  const rest: MiniPerson[] = [];
  for (const row of input.rows) {
    const person: MiniPerson = {
      id: row.id,
      name: row.name,
      color: row.color,
      config: peerAvatarConfig(row.avatar.config),
      status: parseAvatarStatus(row.avatar.status),
      self: false,
    };
    (input.heard.has(row.id) ? near : rest).push(person);
  }
  near.sort(byName);
  rest.sort(byName);
  const groups: MiniGroup[] =
    input.heard.size > 0
      ? [
          { id: 'near', people: [you, ...near] },
          { id: 'space', people: rest },
        ]
      : [{ id: 'space', people: [you, ...rest] }];
  return { count: input.rows.length + 1, groups: groups.filter((g) => g.people.length > 0) };
}

/** Everything the rows show, as one string: the memo's key. A move changes none of it. */
export function miniPeopleKey(input: MiniPeopleInput): string {
  const c = input.self.config;
  let key = `${input.self.name}|${input.self.color}|${c.gender}|${c.hair}|${c.hairColour}|${input.self.status ?? ''}#`;
  for (const row of input.rows) {
    const config = peerAvatarConfig(row.avatar.config);
    key += `${row.id}|${row.name}|${row.color}|${config.gender}|${config.hair}|${config.hairColour}|${
      parseAvatarStatus(row.avatar.status) ?? ''
    };`;
  }
  key += '#';
  for (const id of input.heard) key += `${id};`;
  return key;
}

/**
 * `miniViewPeople` behind `miniPeopleKey`: the same result object until a fact it shows changes, so the rows' memo
 * holds while people only walk. One per host.
 */
export function keyedMiniPeople(): (input: MiniPeopleInput) => ReturnType<typeof miniViewPeople> {
  let lastKey: string | null = null;
  let last: ReturnType<typeof miniViewPeople> | null = null;
  return (input) => {
    const key = miniPeopleKey(input);
    if (key !== lastKey || !last) {
      lastKey = key;
      last = miniViewPeople(input);
    }
    return last;
  };
}
