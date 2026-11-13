import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { readRuleBody } from './validate';
import { planActions } from './plan-actions';
import { allHold } from './conditions';
import { ruleNeeds } from './attention';
import { namedRuleBody, ruleWithTabIds } from './named';
import { ruleSentence, savedFilterKey, type RuleSentenceOutline } from './sentence';
import { AUTOMATION_TRIGGER_KINDS, type AutomationRuleBody } from './types';
import { BUG, NOTE, OUTLINE, bug, ctxFor, ZONE } from './test-fixtures';
import type { Item } from '../item';

// docs/specs/026-plan/automations.md "A rule", "Actions", "The Automations screen": generated rule bodies, from a fixed
// seed. What validation accepts runs to an end (done, failed with a reason, waiting) and reads in words; what it
// refuses names a part the body holds; naming and tab ids leave a body as it was.

// mulberry32: a small seeded generator, so every run draws the same bodies.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type R = () => number;
const pick = <T>(r: R, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const chance = (r: R, p: number) => r() < p;
const many = <T>(r: R, max: number, f: () => T): T[] =>
  Array.from({ length: Math.floor(r() * (max + 1)) }, f);
// How often a part is drawn wrong: most bodies are nearly right, so both the read's refusals and the run are reached.
let noise = 0.02;
// How often a text names a branch's or a webhook's value.
let placed = 0.05;
// One of `good`, or (as often as `noise` says) one of `bad`.
const alt = <T>(r: R, good: readonly T[], bad: readonly T[]): T =>
  chance(r, noise) ? pick(r, bad) : pick(r, good);

// Ids the plan holds, ids it lacks, and names that read the prototype if looked up carelessly.
const GONE = [
  'gone-col',
  'gone-type',
  'gone-field',
  'gone-person',
  '__proto__',
  'constructor',
  'toString',
];
const STATUSES = ['todo', 'doing', 'done', ...GONE];
const TYPES = ['bug', 'note', ...GONE];
const FIELDS = [
  'title',
  'assignee',
  'priority',
  'labels',
  'due',
  'start',
  'estimate',
  'description',
  'checklist',
  'flagged',
  'f-severity',
  'f-points',
  'f-when',
  'f-parent',
  'f-owner',
  'f-calc',
  'f-tags',
  'f-links',
  ...GONE,
];
const PEOPLE = ['u-sam', 'u-ali', ...GONE];
const TABS = ['t1', 'form1', ...GONE];
const FILTERS = ['sf-mine', 'sf-high', ...GONE];
const VALUES = [
  '',
  'plain',
  '{{card.title}}',
  '{{card.field.Severity}}',
  '{{card.field.__proto__}}',
  '{{card.field.constructor}}',
  '{{now + 3d}}',
  '{{',
  '}}',
  '{{{{card.key}}}}',
  'ünïcødé 🚀',
  '   ',
  'High',
  'yes',
  '2026-11-20',
  '12',
];
// Values only a branch, or an Incoming Webhook rule, knows: refused elsewhere.
const PLACED = [
  '{{trigger.title}}',
  '{{webhook.__proto__}}',
  '{{webhook.constructor}}',
  '{{webhook.build.status}}',
];

function textOf(r: R): unknown {
  if (chance(r, noise))
    return pick(r, [7, null, [], {}, true, '{{nope}}', 'x'.repeat(2001), '   ']);
  if (chance(r, 0.02)) return 'x'.repeat(pick(r, [60, 200, 2000]));
  const value = () => (chance(r, placed) ? pick(r, PLACED) : pick(r, VALUES));
  const parts = [value(), ...many(r, 2, value)];
  return parts.join(pick(r, ['', ' ', ' - ']));
}
const idOf = (r: R, pool: readonly string[]): unknown =>
  chance(r, noise) ? pick(r, ['', 3, null, 'x'.repeat(81)]) : pick(r, pool);
const idsOf = (r: R, pool: readonly string[], max = 3): unknown =>
  chance(r, noise) ? pick(r, ['todo', {}, null]) : many(r, max, () => idOf(r, pool));
const clockOf = (r: R) => alt(r, ['09:00', '23:45'], ['09:10', '24:00', '9:00', 3]);
const dayOf = (r: R): unknown =>
  alt(
    r,
    [{ day: '2026-11-20' }, { today: 3 }, { today: -3650 }],
    [{ day: '2026-02-30' }, { today: -4000 }, { today: 1.5 }, 'today'],
  );

const t_days = (r: R): unknown => alt(r, [[1, 3], [7], 2, 30], [[], 0, 91]);

function triggerOf(r: R): unknown {
  const kind = chance(r, noise) ? 'nope' : pick(r, AUTOMATION_TRIGGER_KINDS);
  return {
    kind,
    status: idOf(r, STATUSES),
    statuses: chance(r, 0.5) ? idsOf(r, STATUSES) : undefined,
    from: chance(r, 0.5) ? idsOf(r, STATUSES) : undefined,
    to: chance(r, 0.5) ? idsOf(r, STATUSES) : undefined,
    fields: idsOf(r, FIELDS),
    people: chance(r, 0.5) ? idsOf(r, PEOPLE) : undefined,
    formTab: chance(r, 0.5) ? idOf(r, TABS) : undefined,
    every: alt(r, ['day', 'weekday', 'week', 'month'], ['hour']),
    days: t_days(r),
    dayOfMonth: alt(r, [1, 31], [32, 0]),
    at: clockOf(r),
    limit: alt(r, [1, 500], [501, 0]),
    related: alt(r, ['children', 'linked'], ['nope']),
    result: alt(r, ['failing', 'passing'], ['nope']),
  };
}

function conditionOf(r: R): unknown {
  const kind = alt(r, ['type', 'column', 'field', 'who', 'saved_filter'], ['nope']);
  const op = alt(
    r,
    [
      'is',
      'is_not',
      'empty',
      'not_empty',
      'contains',
      'not_contains',
      'before',
      'after',
      'on_or_before',
      'on_or_after',
      'less_than',
      'more_than',
    ],
    ['nope'],
  );
  return {
    kind,
    not: alt(r, [undefined, true, false], ['yes']),
    types: idsOf(r, TYPES),
    statuses: idsOf(r, STATUSES),
    field: idOf(r, FIELDS),
    op,
    value: alt(r, [textOf(r), 3, ['High', 'Low'], dayOf(r), undefined], [Number.NaN, [], {}]),
    who: many(r, 2, () =>
      alt(
        r,
        [{ person: idOf(r, PEOPLE) }, { role: pick(r, ['editor', 'agent']) }],
        [{ role: 'boss' }, 3],
      ),
    ),
    tab: idOf(r, TABS),
    filter: idOf(r, FILTERS),
  };
}

function setValueOf(r: R): unknown {
  return alt(
    r,
    [
      { text: textOf(r) },
      { number: pick(r, [3, -1.5, 0]) },
      { list: idsOf(r, ['a', 'b', 'High']) },
      { date: dayOf(r) },
      { from: idOf(r, FIELDS) },
    ],
    [{}, { number: Number.POSITIVE_INFINITY }],
  );
}

const recipientOf = (r: R): unknown =>
  alt(r, [{ assignee: true }, { trigger: true }, { person: idOf(r, PEOPLE) }], [{}]);

function actionOf(r: R): unknown {
  const kind = alt(
    r,
    [
      'move',
      'set_field',
      'clear_field',
      'assign',
      'add_label',
      'remove_label',
      'comment',
      'flag',
      'unflag',
      'archive',
      'create_card',
      'email',
      'set_type',
      'set_colour',
      'restore',
      'copy_card',
      'add_checklist',
      'link_card',
      'mention',
      'resolve_threads',
    ],
    ['nope'],
  );
  return {
    kind,
    status: chance(r, 0.6) ? idOf(r, STATUSES) : undefined,
    field: idOf(r, FIELDS),
    value: setValueOf(r),
    to:
      kind === 'assign'
        ? alt(
            r,
            [
              { person: idOf(r, PEOPLE) },
              { trigger: true },
              { nobody: true },
              { rotate: [idOf(r, PEOPLE), idOf(r, PEOPLE), ...many(r, 2, () => idOf(r, PEOPLE))] },
            ],
            [{}, { rotate: idsOf(r, PEOPLE, 1) }],
          )
        : kind === 'link_card'
          ? alt(
              r,
              [
                { card: pick(r, ['c-other', 'gone-card', '__proto__', 'c-main']) },
                { trigger: true },
              ],
              [{}],
            )
          : recipientOf(r),
    label: textOf(r),
    text: textOf(r),
    type: idOf(r, TYPES),
    title: textOf(r),
    copy: chance(r, 0.5)
      ? idsOf(r, chance(r, noise) ? ['status'] : ['assignee', 'labels', 'due'])
      : undefined,
    linkField: chance(r, 0.3) ? idOf(r, FIELDS) : undefined,
    subject: textOf(r),
    body: textOf(r),
    colour: alt(r, ['#ff0000', null], ['red', '#FFF']),
    items: many(r, 3, () => textOf(r)),
  };
}

function stepOf(r: R, depth = 0): unknown {
  const kind = pick(r, ['action', 'action', 'action', 'if', 'for', 'notify', 'ai', 'wait']);
  if (kind === 'action' || depth > 0) return actionOf(r);
  if (kind === 'if')
    return {
      kind: 'if',
      conditions: many(r, 2, () => conditionOf(r)),
      then: many(r, 3, () => stepOf(r, depth + 1)),
      else: many(r, 2, () => stepOf(r, depth + 1)),
    };
  if (kind === 'for')
    return {
      kind: 'for',
      related: alt(
        r,
        [
          { kind: 'linked' },
          { kind: 'linked', field: idOf(r, FIELDS) },
          { kind: 'blocked_by' },
          { kind: 'blocking' },
          { kind: 'children' },
          { kind: 'saved_filter', tab: idOf(r, TABS), filter: idOf(r, FILTERS) },
        ],
        [{ kind: 'nope' }],
      ),
      conditions: chance(r, 0.5) ? many(r, 2, () => conditionOf(r)) : undefined,
      then: many(r, 3, () => stepOf(r, depth + 1)),
    };
  if (kind === 'notify')
    return {
      kind: 'notify',
      via: alt(r, ['webhook', 'slack', 'teams'], ['fax']),
      webhook: idOf(r, ['wh1', ...GONE]),
      name: chance(r, 0.5) ? textOf(r) : undefined,
      text: textOf(r),
    };
  if (kind === 'ai')
    return {
      kind: 'ai',
      task: alt(r, ['summarise', 'card_type', 'triage'], ['nope']),
      field: chance(r, 0.5) ? idOf(r, FIELDS) : undefined,
      set: alt(r, [true, false], ['yes']),
      priority: pick(r, [true, false, true]),
      labels: pick(r, [true, false]),
    };
  return { kind: 'wait', hours: alt(r, [1, 24, 49, 720], [0, 721, 1.5]) };
}

function bodyOf(r: R): unknown {
  noise = pick(r, [0, 0.01, 0.03, 0.2]);
  placed = pick(r, [0, 0.05, 0.3]);
  if (chance(r, noise / 2)) return pick(r, [null, [], 'rule', 7]);
  return {
    name: alt(r, ['Rule', 'ünïcødé 🚀', 'x'.repeat(60)], [' ', 'x'.repeat(61), 7]),
    trigger: triggerOf(r),
    conditions: chance(r, noise) ? 'nope' : many(r, 3, () => conditionOf(r)),
    steps: chance(r, noise) ? 'nope' : [stepOf(r), ...many(r, 3, () => stepOf(r))],
    chain: alt(r, [true, false, undefined], ['yes']),
    timeZone: alt(r, [ZONE, 'UTC', 'America/New_York'], ['Mars/Base']),
    // An unknown key the read drops.
    extra: 1,
  };
}

// Strips undefined (as JSON would), so a generated body reads as one sent over the wire.
const wire = (v: unknown): unknown => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// Whether `path` (`steps.2.then.0.text`) names a part `body` holds; `rule` is the body itself.
function pathIn(body: unknown, path: string): boolean {
  if (path === 'rule') return true;
  const keys = path.split('.');
  let at: unknown = body;
  for (const [i, key] of keys.entries()) {
    if (typeof at !== 'object' || at === null) return false;
    // A part the read requires but the body lacks is named by its own path: only the last key may be missing.
    if (!Object.hasOwn(at, key)) return i === keys.length - 1;
    at = (at as Record<string, unknown>)[key];
  }
  return true;
}

const SENTENCE: RuleSentenceOutline = {
  types: [BUG, NOTE],
  statuses: new Map(OUTLINE.statuses.map((s) => [s.status, s.name])),
  people: OUTLINE.people,
  tabs: new Map([
    ['form1', 'Intake'],
    ['t1', 'Board'],
  ]),
  filters: new Map([
    [savedFilterKey('t1', 'sf-mine'), 'Mine'],
    [savedFilterKey('t1', 'sf-high'), 'High'],
  ]),
  webhooks: new Map([['wh1', 'Launch Channel']]),
  goneWords: true,
};
// What the editor must never show: an id it holds a name for, a gone id, or a prototype's text.
const SHOWN_NEVER = [
  /\bf-(severity|points|when|parent|owner|calc|tags|links)\b/,
  /\bu-(sam|ali)\b/,
  /\bgone-(col|type|field|person)\b/,
  /__proto__/,
  /\bconstructor\b/,
  /\btoString\b/,
  /native code/,
  /\[object /,
  /undefined/,
];

const OTHER: Item = bug({ title: 'Other' }, { id: 'c-other', key: 2 });
const CARD = bug({ 'f-parent': 'c-other', labels: ['a'] }, { id: 'c-main', key: 1 });
const NAMES = {
  statuses: OUTLINE.statuses,
  types: OUTLINE.types,
  people: OUTLINE.people,
  tabs: [
    { id: 'form1', name: 'Intake' },
    { id: 't1', name: 'Board' },
  ],
};
const ENDS = new Set(['done', 'failed', 'waiting']);

describe('generated rule bodies', () => {
  const r = rng(0x5eed8);
  const bodies = Array.from({ length: 3000 }, () => wire(bodyOf(r)));
  const accepted: AutomationRuleBody[] = [];

  it('validation never throws, and a refusal names a part the body holds', () => {
    for (const raw of bodies) {
      // An agent's body is named before it is read: whatever it holds, naming never throws.
      expect(() => namedRuleBody(raw, NAMES)).not.toThrow();
      const read = readRuleBody(raw);
      if ('body' in read) {
        accepted.push(read.body);
        continue;
      }
      expect(read.message, read.path).not.toBe('');
      expect(pathIn(raw, read.path), `${read.path} in ${JSON.stringify(raw).slice(0, 300)}`).toBe(
        true,
      );
    }
    // The generator reaches both sides.
    expect(accepted.length).toBeGreaterThan(50);
  });

  it('an accepted rule runs to an end: done, failed with a reason, or waiting', () => {
    for (const body of accepted) {
      const ctx = ctxFor(CARD, { items: [CARD, OTHER], webhook: { 'build.status': 'ok' } });
      const held = allHold(body.conditions, ctx);
      const plans = [planActions(body.steps, ctx), planActions(body.steps, ctx, { through: true })];
      for (const plan of plans) {
        const end = 'failed' in plan ? 'failed' : 'wait' in plan && plan.wait ? 'waiting' : 'done';
        expect(ENDS.has(end)).toBe(true);
        if ('failed' in plan) expect(plan.failed.trim(), JSON.stringify(body)).not.toBe('');
        for (const line of plan.lines)
          expect(line.text, JSON.stringify(body)).not.toMatch(/native code|\[object |undefined/);
      }
      expect(typeof held.ok).toBe('boolean');
      ruleNeeds(body, { ...OUTLINE, cards: new Set(['c-main', 'c-other']) });
    }
  });

  it('an accepted rule reads in words, never an id the editor holds a name for', () => {
    for (const body of accepted) {
      const words = ruleSentence(body, SENTENCE)
        .map((p) => ('word' in p ? p.word : p.chip))
        .join(' ')
        .replace(/\{\{[^{}]*\}\}/g, '');
      // Free text the person wrote (a label, a value) is theirs to show; strip the generator's own words from it.
      for (const never of SHOWN_NEVER) expect(words, JSON.stringify(body)).not.toMatch(never);
    }
  });

  it('naming and tab ids leave an accepted body as it was', () => {
    for (const body of accepted) {
      expect(namedRuleBody(body, NAMES)).toEqual(body);
      expect(ruleWithTabIds(body, new Map())).toEqual(body);
      expect(ruleWithTabIds(body, new Map(NAMES.tabs.map((t) => [t.id, t.id])))).toEqual(body);
    }
  });

  it('reads, runs and words them all within a budget', () => {
    expect(
      cpuMsOf(() => {
        for (const raw of bodies) {
          const read = readRuleBody(raw);
          if ('body' in read) {
            planActions(read.body.steps, ctxFor(CARD, { items: [CARD, OTHER] }));
            ruleSentence(read.body, SENTENCE);
          }
        }
      }),
    ).toBeLessThan(cpuBudgetMs(600));
  });
});
