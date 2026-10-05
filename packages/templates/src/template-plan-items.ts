// The Plan templates' seed items (docs/specs/025-plan/plan-mode.md "Templates"): the work each board
// starts with, so a team sees a board mid-flow rather than an empty frame. Made in the new
// document's item store once, then ordinary items. Pure data.

import type { ItemCreate, ItemFields, ItemPerson } from '@livediagram/items';
import type { PlanTemplateKind } from './template-builders-plan';

// Example people. Their ids are not anyone's: an assignee picked in the editor replaces them.
const PRIYA: ItemPerson = { id: 'example-priya', name: 'Priya Shah', color: '#7c3aed' };
const SAM: ItemPerson = { id: 'example-sam', name: 'Sam Lee', color: '#2563eb' };
const JO: ItemPerson = { id: 'example-jo', name: 'Jo Okafor', color: '#16a34a' };
const ALEX: ItemPerson = { id: 'example-alex', name: 'Alex Romero', color: '#ea580c' };

function item(type: string, status: string, title: string, extra: ItemFields = {}): ItemCreate {
  return { type, fields: { title, status, ...extra }, place: { status } };
}

// A bug is a task labelled `bug` (docs/specs/025-plan/items.md "Item types"), which Bug triage shows.
function bug(status: string, title: string, extra: ItemFields = {}): ItemCreate {
  const labels = Array.isArray(extra['labels']) ? (extra['labels'] as string[]) : [];
  return item('task', status, title, { ...extra, labels: ['bug', ...labels] });
}

const KANBAN: ItemCreate[] = [
  item('task', 'backlog', 'Save cards for next time', {
    labels: ['payments'],
    priority: 'medium',
  }),
  item('task', 'backlog', 'Pick a fraud-check provider', { labels: ['research'] }),
  bug('backlog', 'Coupon field clears on back', { priority: 'low', labels: ['frontend'] }),
  item('task', 'todo', 'Apple Pay at checkout', {
    assignee: SAM,
    priority: 'high',
    labels: ['payments'],
    estimate: 5,
  }),
  item('task', 'todo', 'Write the refunds runbook', { assignee: JO, labels: ['ops'] }),
  item('task', 'doing', 'One-page checkout', {
    assignee: PRIYA,
    priority: 'high',
    labels: ['frontend'],
    estimate: 8,
    checklist: [
      { text: 'Address and delivery on one step', done: true },
      { text: 'Inline card errors', done: true },
      { text: 'Order summary pinned on mobile', done: false },
    ],
  }),
  bug('doing', 'Tax rounds wrong for Ireland', {
    assignee: ALEX,
    priority: 'urgent',
    labels: ['backend'],
  }),
  item('task', 'doing', 'Load-test the payments API', { assignee: SAM, labels: ['infra'] }),
  item('task', 'review', 'Show delivery dates in basket', {
    assignee: JO,
    priority: 'medium',
    labels: ['frontend'],
  }),
  item('task', 'done', 'Move receipts to the new email service', {
    assignee: ALEX,
    labels: ['backend'],
  }),
  bug('done', 'Double charge on retry', {
    assignee: PRIYA,
    priority: 'urgent',
    labels: ['payments'],
  }),
];

const SPRINT: ItemCreate[] = [
  item('task', 'sprint-backlog', 'Remember the last delivery address', {
    assignee: SAM,
    priority: 'medium',
    estimate: 3,
  }),
  item('task', 'sprint-backlog', 'Add checkout funnel events', {
    assignee: JO,
    estimate: 2,
    labels: ['analytics'],
  }),
  bug('sprint-backlog', 'Postcode lookup times out', { priority: 'high', estimate: 2 }),
  item('task', 'doing', 'One-tap reorder', {
    assignee: PRIYA,
    priority: 'high',
    estimate: 5,
    labels: ['mobile'],
  }),
  item('task', 'doing', 'Cache basket totals', { assignee: SAM, estimate: 3, labels: ['backend'] }),
  item('task', 'review', 'Gift messages', { assignee: JO, priority: 'low', estimate: 3 }),
  bug('review', 'Discount shows twice on receipts', {
    assignee: PRIYA,
    priority: 'medium',
    estimate: 1,
  }),
  item('task', 'done', 'Pay with saved card', { assignee: SAM, priority: 'high', estimate: 5 }),
  item('task', 'done', 'Sprint goal agreed with support', { assignee: JO, estimate: 1 }),
];

const BUGS: ItemCreate[] = [
  bug('new', 'Search returns nothing for accented names', {
    priority: 'high',
    labels: ['search'],
  }),
  bug('new', 'Dark mode: unreadable error toasts', { priority: 'low', labels: ['ui'] }),
  bug('new', 'CSV export misses the last row', { priority: 'medium', labels: ['reports'] }),
  bug('confirmed', 'Session ends after 5 minutes on Safari', {
    priority: 'urgent',
    labels: ['auth'],
    assignee: ALEX,
  }),
  bug('confirmed', 'Invoice PDF cuts long names', {
    priority: 'medium',
    labels: ['billing'],
  }),
  bug('fixing', 'Password reset email arrives twice', {
    priority: 'high',
    assignee: SAM,
    labels: ['auth'],
    due: '2026-10-09',
  }),
  bug('fixing', 'Chart tooltips jump on scroll', {
    priority: 'low',
    assignee: PRIYA,
    labels: ['ui'],
  }),
  bug('fixed', 'Upload fails over 10 MB', {
    priority: 'high',
    assignee: JO,
    labels: ['files'],
  }),
  bug('wont-fix', 'IE11 layout is broken', { priority: 'low', labels: ['legacy'] }),
];

// A retro mid-way: notes written and voted on, one action already agreed.
function note(status: string, title: string, votes: Record<string, number> = {}): ItemCreate {
  return { ...item(status === 'ideas' ? 'idea' : 'note', status, title), votes };
}

const RETRO: ItemCreate[] = [
  note('went-well', 'Pairing on the payments bug got it out in a day', {
    [PRIYA.id]: 2,
    [SAM.id]: 1,
  }),
  note('went-well', 'Demo day: the whole team showed something', { [JO.id]: 1 }),
  note('went-well', 'No out-of-hours pages this sprint'),
  note('to-improve', 'Stories arrive without acceptance criteria', {
    [ALEX.id]: 2,
    [JO.id]: 2,
    [SAM.id]: 1,
  }),
  note('to-improve', 'Reviews wait a day or more', { [PRIYA.id]: 1, [ALEX.id]: 1 }),
  note('to-improve', 'Standup runs past 20 minutes'),
  note('ideas', 'Review hour after lunch, every day', { [SAM.id]: 2 }),
  note('ideas', 'Three Amigos before a story starts', { [JO.id]: 1, [PRIYA.id]: 1 }),
  item('action', 'actions', 'Write acceptance criteria before sprint planning', {
    assignee: ALEX,
    due: '2026-10-12',
  }),
];

const ROADMAP: ItemCreate[] = [
  item('project', 'now', 'Checkout in one page', { labels: ['conversion'], assignee: PRIYA }),
  item('project', 'now', 'Reliable payments', { labels: ['trust'], assignee: SAM }),
  item('project', 'next', 'Subscriptions', { labels: ['revenue'], assignee: JO }),
  item('project', 'next', 'Gift cards', { labels: ['revenue'] }),
  item('project', 'later', 'Marketplace sellers', { labels: ['growth'] }),
  item('project', 'later', 'Buy now, pay later', { labels: ['conversion'] }),
];

const WEEK: ItemCreate[] = [
  item('task', 'mon', 'Plan the week', {
    due: '2026-10-05',
    checklist: [
      { text: 'Review calendar', done: true },
      { text: 'Pick three goals', done: false },
    ],
  }),
  item('task', 'mon', 'Reply to the vendor', {}),
  item('task', 'tue', 'Draft the quarterly update', { due: '2026-10-06' }),
  item('action', 'wed', 'Interview: design lead', { due: '2026-10-07' }),
  item('task', 'thu', 'Gym before work', {}),
  item('task', 'thu', 'Budget review', { due: '2026-10-08' }),
  item('task', 'fri', 'Ship the release notes', { due: '2026-10-09' }),
];

const SEEDS: Record<PlanTemplateKind, readonly ItemCreate[]> = {
  'blank-plan': [],
  kanban: KANBAN,
  'sprint-board': SPRINT,
  'bug-triage': BUGS,
  'team-retro': RETRO,
  'roadmap-board': ROADMAP,
  'weekly-planner': WEEK,
};

// A fresh copy of a Plan template's seed items (empty for any other template).
export function planTemplateSeedItems(kind: string): ItemCreate[] {
  const seeds = (SEEDS as Partial<Record<string, readonly ItemCreate[]>>)[kind];
  return seeds ? structuredClone([...seeds]) : [];
}
