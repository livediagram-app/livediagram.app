// The worked incident the postmortem template tells (pure data, exempt from
// the line target): Plateful's checkout outage on Thursday 14 August, a
// SEV-2 that ran 81 minutes through the dinner peak. The same Plateful the
// other technical starters describe: the Orders API on ECS, its Postgres,
// and the Payments service checkout calls. Every number agrees with every
// other one (81 minutes of impact from 18:05 to 19:26, detection at 18:14,
// mitigation at 18:47), so the report survives a careful reader.

import type { Hue } from './template-report-kit';

export const PM_TITLE = 'Plateful checkout outage · 14 Aug';
export const PM_CAPTION =
  'A blameless postmortem, laid out in the order it is written: what happened, when, why, and what we will change.';

export const PM_CHIPS = {
  severity: 'SEV-2',
  status: 'Resolved 19:26',
  review: 'Reviewed Tue 19 Aug',
};

export const PM_SUMMARY =
  'During the Thursday dinner peak, 38% of checkouts failed for 81 minutes. A new payments retry client in Orders v4.12 held database connections open while our payments provider slowed down, until the Orders API ran out of them. Rolling back to v4.11 restored checkout, and no customer was charged twice.';

export const PM_META =
  'Incident lead: Maya (SRE) · Services: Orders API, Payments · Found by: alert';

export const PM_BLAMELESS =
  'We ask how the system made this easy to get wrong, never who got it wrong. Everyone acted on what they knew at the time.';

export const PM_STATS = [
  { value: '81 min', caption: 'Customer impact' },
  { value: '38%', caption: 'Peak error rate' },
  { value: '6,240', caption: 'Failed checkouts' },
  { value: '£118k', caption: 'Orders at risk' },
];

// The phases run from red (something broke) to green (it healed), so the
// timeline's colour alone tells you how far through the incident a card is.
export type Phase = {
  name: string;
  icon: string;
  hue: Hue;
  events: { time: string; text: string }[];
};

export const PM_PHASES: Phase[] = [
  {
    name: 'Trigger',
    icon: 'git-branch',
    hue: { deep: '#be123c', mid: '#e11d48', soft: '#ffe4e6', line: '#fda4af', ink: '#4c0519' },
    events: [
      { time: '17:48', text: 'Orders v4.12 deploys, bringing a new payments retry client.' },
      {
        time: '18:05 · impact starts',
        text: 'The payments provider slows to 12 s at p95 as the dinner peak builds.',
      },
    ],
  },
  {
    name: 'Detection',
    icon: 'bell',
    hue: { deep: '#b45309', mid: '#d97706', soft: '#fef3c7', line: '#fcd34d', ink: '#451a03' },
    events: [
      {
        time: '18:14',
        text: 'Checkout error-rate alert fires, burning the SLO 14 times too fast.',
      },
      { time: '18:16', text: 'On-call acknowledges the page and opens the checkout dashboard.' },
    ],
  },
  {
    name: 'Response',
    icon: 'users',
    hue: { deep: '#0369a1', mid: '#0284c7', soft: '#e0f2fe', line: '#7dd3fc', ink: '#082f49' },
    events: [
      { time: '18:22', text: 'SEV-2 declared. Incident channel open, status page updated.' },
      { time: '18:31', text: 'Orders DB pool pinned at 50 of 50 connections. v4.12 suspected.' },
    ],
  },
  {
    name: 'Mitigation',
    icon: 'refresh-cw',
    hue: { deep: '#6d28d9', mid: '#7c3aed', soft: '#ede9fe', line: '#c4b5fd', ink: '#2e1065' },
    events: [
      { time: '18:43', text: 'Decision: roll back rather than hot-fix the timeout under load.' },
      { time: '18:47', text: 'Rollback to v4.11 complete. Errors fall from 38% to 2%.' },
    ],
  },
  {
    name: 'Resolution',
    icon: 'check-circle',
    hue: { deep: '#15803d', mid: '#16a34a', soft: '#dcfce7', line: '#86efac', ink: '#052e16' },
    events: [
      { time: '19:26', text: 'Error rate back under 0.1%. The 47 stuck orders are replayed.' },
      { time: '19:40', text: 'Incident closed, follow-ups filed and the review booked.' },
    ],
  },
];

// The three spans the incident is measured by, all from the moment impact
// started. `to` is the phase whose first card the span ends on.
export const PM_SPANS = [
  { label: 'Time to detect · 9 min', to: 1 },
  { label: 'Time to mitigate · 42 min', to: 3 },
  { label: 'Time to resolve · 81 min', to: 4 },
];

// Five whys, each a question and the answer it found, walking from the
// symptom to the system.
export const PM_WHYS = [
  {
    q: 'Why did checkouts fail?',
    a: 'The Orders API answered 38% of checkout calls with a 503.',
  },
  {
    q: 'Why the 503s?',
    a: 'Its Postgres connection pool, 50 connections, was exhausted.',
  },
  {
    q: 'Why was the pool exhausted?',
    a: 'Each checkout held a connection while it waited up to 30 s on payments.',
  },
  {
    q: 'Why wait 30 s?',
    a: 'The new retry client kept its library default, not our 3 s timeout.',
  },
  {
    q: 'Why did that default ship unnoticed?',
    a: 'Timeouts live in code, outside config review, and no test slows a dependency.',
  },
];

export const PM_ROOT_CAUSE = {
  title: 'Root cause',
  text: 'Critical timeouts are set by library defaults nobody reviews, and nothing tests checkout against a slow dependency.',
};

export type FindingColumn = {
  title: string;
  hint: string;
  icon: string;
  hue: Hue;
  sticky: { fill: string; ink: string };
  notes: string[];
};

export const PM_FINDINGS: FindingColumn[] = [
  {
    title: 'Contributing factors',
    hint: 'What made it worse',
    icon: 'alert-triangle',
    hue: { deep: '#c2410c', mid: '#ea580c', soft: '#fff7ed', line: '#fdba74', ink: '#431407' },
    sticky: { fill: '#fed7aa', ink: '#431407' },
    notes: [
      'The canary ran 10 minutes off-peak, too short to meet a slow provider',
      'DB pool saturation was graphed, but nothing alerted on it',
      'The payments provider had no status page entry until 18:40',
    ],
  },
  {
    title: 'What went well',
    hint: 'What to keep',
    icon: 'thumbs-up',
    hue: { deep: '#15803d', mid: '#16a34a', soft: '#f0fdf4', line: '#86efac', ink: '#052e16' },
    sticky: { fill: '#bbf7d0', ink: '#052e16' },
    notes: [
      'The error-rate alert fired 9 minutes after impact began',
      'Rollback was one command and took 4 minutes',
      'Idempotency keys meant nobody was charged twice',
    ],
  },
  {
    title: 'Where we got lucky',
    hint: 'What will not save us twice',
    icon: 'star',
    hue: { deep: '#6d28d9', mid: '#9333ea', soft: '#faf5ff', line: '#d8b4fe', ink: '#2e1065' },
    sticky: { fill: '#e9d5ff', ink: '#3b0764' },
    notes: [
      'It hit on a Thursday, not the Friday peak at three times the traffic',
      'A payments engineer happened to be in the channel',
      'v4.11 was still warm in the registry for a clean rollback',
    ],
  },
];

// The follow-ups, P1s first: every one has an owner, a date and a ticket.
export const PM_ACTIONS = [
  ['Priority', 'Action', 'Owner', 'Due', 'Ticket'],
  [
    'P1',
    'Set a 3 s timeout and a circuit breaker on the payments client',
    'Priya · Payments',
    '21 Aug',
    'PLAT-1182',
  ],
  ['P1', 'Alert when the Orders DB pool passes 80%', 'Maya · SRE', '22 Aug', 'PLAT-1183'],
  [
    'P1',
    'Move client timeouts into reviewed config and lint for defaults',
    'Sam · Platform',
    '29 Aug',
    'PLAT-1184',
  ],
  [
    'P2',
    'Add a slow-payments fault test to the checkout load suite',
    'Ana · QA',
    '5 Sep',
    'PLAT-1185',
  ],
  [
    'P2',
    'Run canaries for 30 minutes across a traffic peak',
    'Leo · Release',
    '12 Sep',
    'PLAT-1186',
  ],
];

export const PM_PRIORITY: Record<string, { bg: string; ink: string }> = {
  P1: { bg: '#fee2e2', ink: '#b91c1c' },
  P2: { bg: '#fef3c7', ink: '#92400e' },
};
