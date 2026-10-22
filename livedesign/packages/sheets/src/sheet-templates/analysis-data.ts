// The worked examples behind the three analysis sheets (docs/specs/029-sheets/sheet.md "Sheet templates"): Threat
// Register, Driver Model and Value Stream. They are also the companion Sheets of the Threat model, Metric tree and
// Value stream map templates (docs/specs/026-plan/plan-templates.md "How a template with tabs is made"), whose
// drawings read these same rows (@livedesign/templates), so the drawing and its sheet agree when made. Pure data and
// the arithmetic both sides share.

// ---- Threat Register ----------------------------------------------------------------------------------------------

export const STRIDE_CATEGORIES = [
  'Spoofing',
  'Tampering',
  'Repudiation',
  'Information disclosure',
  'Denial of service',
  'Elevation of privilege',
] as const;
export type StrideCategory = (typeof STRIDE_CATEGORIES)[number];

type ThreatStatus = 'Open' | 'In Progress' | 'Mitigated';
export type ThreatRating = 'High' | 'Medium' | 'Low';

type ThreatExample = {
  id: string;
  // The diagram element (or flow) it threatens, by the name the Threat model draws.
  element: string;
  stride: StrideCategory;
  threat: string;
  likelihood: number;
  impact: number;
  mitigation: string;
  owner: string;
  status: ThreatStatus;
};

// A score (likelihood × impact, 1 to 25) and the rating it earns: the register's own IF, said once.
export const THREAT_HIGH_FROM = 15;
export const THREAT_MEDIUM_FROM = 8;
export function threatRating(score: number): ThreatRating {
  if (score >= THREAT_HIGH_FROM) return 'High';
  if (score >= THREAT_MEDIUM_FROM) return 'Medium';
  return 'Low';
}

export const THREAT_EXAMPLES: readonly ThreatExample[] = [
  {
    id: 'T1',
    element: 'Customer app',
    stride: 'Spoofing',
    threat: 'A stolen session token is replayed from another device',
    likelihood: 3,
    impact: 4,
    mitigation: 'Short-lived tokens bound to the device',
    owner: 'Identity',
    status: 'Mitigated',
  },
  {
    id: 'T2',
    element: 'API gateway',
    stride: 'Denial of service',
    threat: 'Bots flood checkout at the lunchtime peak',
    likelihood: 4,
    impact: 4,
    mitigation: 'Rate limits per account and IP, a WAF rule set',
    owner: 'Platform',
    status: 'In Progress',
  },
  {
    id: 'T3',
    element: 'Webhook handler',
    stride: 'Spoofing',
    threat: 'A forged "payment succeeded" webhook marks unpaid orders paid',
    likelihood: 3,
    impact: 5,
    mitigation: 'Verify the Stripe signature; confirm the amount with the API',
    owner: 'Payments',
    status: 'Open',
  },
  {
    id: 'T4',
    element: 'Order service',
    stride: 'Tampering',
    threat: 'The basket price is changed in the request body',
    likelihood: 3,
    impact: 4,
    mitigation: 'Price every order on the server from the menu',
    owner: 'Orders',
    status: 'Mitigated',
  },
  {
    id: 'T5',
    element: 'Orders DB',
    stride: 'Information disclosure',
    threat: 'Support tools show full addresses and phone numbers',
    likelihood: 3,
    impact: 3,
    mitigation: 'Mask personal data; role-based access in support tools',
    owner: 'Data',
    status: 'In Progress',
  },
  {
    id: 'T6',
    element: 'Card token vault',
    stride: 'Information disclosure',
    threat: 'Card tokens leak through debug logs',
    likelihood: 2,
    impact: 5,
    mitigation: 'Redact logs; scan for secrets in CI',
    owner: 'Payments',
    status: 'Mitigated',
  },
  {
    id: 'T7',
    element: 'Order service',
    stride: 'Repudiation',
    threat: 'A customer denies placing an order and nothing proves it',
    likelihood: 3,
    impact: 2,
    mitigation: 'A signed, append-only audit log of order events',
    owner: 'Orders',
    status: 'Open',
  },
  {
    id: 'T8',
    element: 'Restaurant tablet',
    stride: 'Elevation of privilege',
    threat: 'A shared tablet login changes the restaurant’s payout details',
    likelihood: 2,
    impact: 5,
    mitigation: 'Step-up sign-in for payout changes',
    owner: 'Partners',
    status: 'Open',
  },
  {
    id: 'T9',
    element: 'Payment service',
    stride: 'Elevation of privilege',
    threat: 'Its service account can read every restaurant’s payouts',
    likelihood: 3,
    impact: 5,
    mitigation: 'Least-privilege IAM, scoped per restaurant',
    owner: 'Platform',
    status: 'Open',
  },
  {
    id: 'T10',
    element: 'API gateway → Order service',
    stride: 'Tampering',
    threat: 'Traffic inside the VPC travels unencrypted',
    likelihood: 2,
    impact: 3,
    mitigation: 'Mutual TLS between services',
    owner: 'Platform',
    status: 'In Progress',
  },
];

// ---- Driver Model ---------------------------------------------------------------------------------------------------

// The inputs of the metric tree, as the sheet types them (a hint of their format rides on the text: "2.0%").
export type DriverInputs = {
  visitors: number;
  conversion: number;
  lastActives: number;
  retention: number;
  ordersPerCustomer: number;
  kitchenOnTime: number;
  courierOnTime: number;
};

export const DRIVER_BASELINE: DriverInputs = {
  visitors: 205_000,
  conversion: 0.02,
  lastActives: 30_800,
  retention: 0.88,
  ordersPerCustomer: 1.72,
  kitchenOnTime: 0.95,
  courierOnTime: 0.953,
};

// The What If column's starting values: a quarter's plausible push on three inputs.
export const DRIVER_WHAT_IF: DriverInputs = {
  ...DRIVER_BASELINE,
  visitors: 215_000,
  retention: 0.9,
  courierOnTime: 0.96,
};

export type DriverInputKey = keyof DriverInputs;

// Each input's row: its name, the team that owns it, and whether a team moves it directly (an input of the tree, not
// a figure carried over from last week).
export const DRIVER_ROWS: readonly { key: DriverInputKey; name: string; owner: string }[] = [
  { key: 'visitors', name: 'Visitors / week', owner: 'Growth' },
  { key: 'conversion', name: 'Visit-to-order conversion', owner: 'Growth' },
  { key: 'lastActives', name: 'Last week’s active customers', owner: 'Lifecycle' },
  { key: 'retention', name: 'Retention', owner: 'Lifecycle' },
  { key: 'ordersPerCustomer', name: 'Orders per active customer', owner: 'Menu' },
  { key: 'kitchenOnTime', name: 'Kitchen on time', owner: 'Restaurant ops' },
  { key: 'courierOnTime', name: 'Courier on time', owner: 'Logistics' },
];

// What a quarter's work could achieve on each lever (the levers table's yellow column): the tree recomputed with that
// one input moved shows which lever buys the most.
export const DRIVER_LEVERS: readonly { key: DriverInputKey; name: string; achievable: number }[] = [
  { key: 'visitors', name: 'Visitors +10%', achievable: 225_500 },
  { key: 'conversion', name: 'Conversion to 2.3%', achievable: 0.023 },
  { key: 'retention', name: 'Retention to 91%', achievable: 0.91 },
  { key: 'ordersPerCustomer', name: 'Orders per customer to 1.80', achievable: 1.8 },
  { key: 'kitchenOnTime', name: 'Kitchen on time to 97%', achievable: 0.97 },
  { key: 'courierOnTime', name: 'Courier on time to 97%', achievable: 0.97 },
];

type DriverTree = {
  newCustomers: number;
  returning: number;
  actives: number;
  orders: number;
  onTimeRate: number;
  northStar: number;
};

// The tree: new + returning customers make the actives, who order, and the share delivered on time is the north star.
export function driverTree(i: DriverInputs): DriverTree {
  const newCustomers = i.visitors * i.conversion;
  const returning = i.lastActives * i.retention;
  const actives = newCustomers + returning;
  const orders = actives * i.ordersPerCustomer;
  const onTimeRate = i.kitchenOnTime * i.courierOnTime;
  return { newCustomers, returning, actives, orders, onTimeRate, northStar: orders * onTimeRate };
}

// The north star a lever's achievable value buys over the baseline.
export function leverGain(lever: (typeof DRIVER_LEVERS)[number]): number {
  return (
    driverTree({ ...DRIVER_BASELINE, [lever.key]: lever.achievable }).northStar -
    driverTree(DRIVER_BASELINE).northStar
  );
}

// ---- Value Stream ---------------------------------------------------------------------------------------------------

type ValueStreamStep = {
  step: string;
  owner: string;
  // Hands-on time, in working hours.
  processHours: number;
  // Time queued before the step starts, in days.
  waitDays: number;
  // The share that leaves the step complete and accurate (no rework downstream).
  completeAccurate: number;
  people: number;
  // The queue in front of it, as the map's inventory triangle counts it.
  queued: number;
};

export const VALUE_STREAM_HOURS_PER_DAY = 8;

export const VALUE_STREAM_STEPS: readonly ValueStreamStep[] = [
  {
    step: 'Refine',
    owner: 'Product',
    processHours: 2,
    waitDays: 8,
    completeAccurate: 0.7,
    people: 2,
    queued: 12,
  },
  {
    step: 'Design',
    owner: 'Design',
    processHours: 4,
    waitDays: 2,
    completeAccurate: 0.9,
    people: 1,
    queued: 3,
  },
  {
    step: 'Build',
    owner: 'Engineering',
    processHours: 16,
    waitDays: 3,
    completeAccurate: 0.85,
    people: 2,
    queued: 5,
  },
  {
    step: 'Code review',
    owner: 'Engineering',
    processHours: 1,
    waitDays: 3,
    completeAccurate: 0.8,
    people: 1,
    queued: 7,
  },
  {
    step: 'QA',
    owner: 'QA',
    processHours: 4,
    waitDays: 4,
    completeAccurate: 0.85,
    people: 1,
    queued: 9,
  },
  {
    step: 'Release',
    owner: 'Platform',
    processHours: 1,
    waitDays: 3.5,
    completeAccurate: 0.95,
    people: 1,
    queued: 6,
  },
];

type ValueStreamTotals = {
  leadDays: number;
  processDays: number;
  flowEfficiency: number;
  rolledCompleteAccurate: number;
};

export function valueStreamTotals(
  steps: readonly ValueStreamStep[] = VALUE_STREAM_STEPS,
  hoursPerDay = VALUE_STREAM_HOURS_PER_DAY,
): ValueStreamTotals {
  const processDays = steps.reduce((sum, s) => sum + s.processHours, 0) / hoursPerDay;
  const leadDays = steps.reduce((sum, s) => sum + s.waitDays, 0) + processDays;
  return {
    leadDays,
    processDays,
    flowEfficiency: leadDays === 0 ? 0 : processDays / leadDays,
    rolledCompleteAccurate: steps.reduce((p, s) => p * s.completeAccurate, 1),
  };
}
