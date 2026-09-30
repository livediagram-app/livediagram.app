// The worked register the risk matrix template scores (pure data, exempt
// from the line target): six risks to Plateful's group ordering launch,
// where several people fill one shared basket and the host pays. Each risk
// sits on the 5x5 grid at its likelihood and impact today; R1 also carries
// the residual position its mitigation buys.

export const RISK_TITLE = 'Plateful · Group ordering launch';
export const RISK_LAUNCH = 'Launch Mon 29 Sep';
export const RISK_CAPTION =
  'Score each risk as likelihood times impact, plot it, then own it. The dashed arrow shows where a mitigation moves a risk.';

// The axis steps, 1 to 5, each with the yardstick the team scores against.
export const LIKELIHOOD_STEPS = [
  { name: 'Rare', scale: 'under 5%' },
  { name: 'Unlikely', scale: '5 to 20%' },
  { name: 'Possible', scale: '20 to 50%' },
  { name: 'Likely', scale: '50 to 80%' },
  { name: 'Almost certain', scale: 'over 80%' },
];
export const IMPACT_STEPS = [
  { name: 'Negligible', scale: 'under £5k' },
  { name: 'Minor', scale: '£5k to £50k' },
  { name: 'Moderate', scale: '£50k to £250k' },
  { name: 'Major', scale: '£250k to £1m' },
  { name: 'Severe', scale: 'over £1m' },
];

export type RiskBand = 'Low' | 'Medium' | 'High' | 'Critical';

// Score bands, lowest first, with the paper and ink their legend chip and
// register cell wear. `max` is the band's highest score.
export const RISK_BANDS: { band: RiskBand; range: string; max: number; bg: string; ink: string }[] =
  [
    { band: 'Low', range: '1 to 4', max: 4, bg: '#bbf7d0', ink: '#14532d' },
    { band: 'Medium', range: '5 to 9', max: 9, bg: '#fde68a', ink: '#713f12' },
    { band: 'High', range: '10 to 16', max: 16, bg: '#fdba74', ink: '#7c2d12' },
    { band: 'Critical', range: '20 to 25', max: 25, bg: '#f87171', ink: '#450a0a' },
  ];

// Each score's own shade, so the grid runs smoothly from green through
// amber to red rather than in four flat blocks.
export const SCORE_FILL: Record<number, string> = {
  1: '#bbf7d0',
  2: '#bbf7d0',
  3: '#d9f99d',
  4: '#d9f99d',
  5: '#fef08a',
  6: '#fef08a',
  8: '#fde68a',
  9: '#fde68a',
  10: '#fdba74',
  12: '#fdba74',
  15: '#fb923c',
  16: '#fb923c',
  20: '#f87171',
  25: '#ef4444',
};

export const bandOf = (score: number) => RISK_BANDS.find((b) => score <= b.max)!;

export type Trend = 'Rising' | 'Steady' | 'Falling';
export const TREND: Record<Trend, { label: string; ink: string }> = {
  Rising: { label: '↑ Rising', ink: '#b91c1c' },
  Steady: { label: '→ Steady', ink: '#475569' },
  Falling: { label: '↓ Falling', ink: '#15803d' },
};

export type Risk = {
  id: string;
  risk: string;
  likelihood: number;
  impact: number;
  owner: string;
  mitigation: string;
  trend: Trend;
  residual?: { likelihood: number; impact: number };
};

// Highest score first, the order the register reads in.
export const RISKS: Risk[] = [
  {
    id: 'R1',
    risk: 'Split payments fail at checkout',
    likelihood: 4,
    impact: 5,
    owner: 'Priya · Payments',
    mitigation: 'Host pays in full if any split fails',
    trend: 'Falling',
    residual: { likelihood: 2, impact: 4 },
  },
  {
    id: 'R2',
    risk: 'Kitchens swamped by 12-person orders',
    likelihood: 4,
    impact: 4,
    owner: 'Leo · Ops',
    mitigation: 'Cap groups at 12, add prep-time buffer',
    trend: 'Rising',
  },
  {
    id: 'R3',
    risk: 'Too few couriers on launch Friday',
    likelihood: 5,
    impact: 3,
    owner: 'Tom · Logistics',
    mitigation: 'Surge bonus, launch city by city',
    trend: 'Falling',
  },
  {
    id: 'R4',
    risk: 'Fraud through shared invite links',
    likelihood: 2,
    impact: 5,
    owner: 'Maya · Trust',
    mitigation: 'Links expire, host approves joiners',
    trend: 'Rising',
  },
  {
    id: 'R5',
    risk: 'Basket edits clash with 10+ people',
    likelihood: 3,
    impact: 3,
    owner: 'Sam · Engineering',
    mitigation: 'Per-item locks, 20-user load test',
    trend: 'Steady',
  },
  {
    id: 'R6',
    risk: 'App review delays the iOS release',
    likelihood: 3,
    impact: 2,
    owner: 'Ana · Mobile',
    mitigation: 'Submit 10 days early, web fallback',
    trend: 'Steady',
  },
];

export const RISK_NOTE =
  'Next review Fri 12 Sep, before the beta. Anything scoring 15 or more needs its owner’s plan by then.';

// What the review checks before it trusts the register.
export const RISK_CHECKS = [
  { text: 'Every risk has one named owner', done: true },
  { text: 'Scores agreed with each owner', done: true },
  { text: 'Every 15+ risk has a dated plan', done: false },
];
