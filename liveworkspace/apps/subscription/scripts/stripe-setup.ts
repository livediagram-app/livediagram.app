// Sets up a Stripe account for the subscription Worker, and checks it (liveworkspace/docs/specs/019-subscription/
// subscription.md "Stripe"). Safe to run again: everything is found by its lookup key or metadata before anything is
// made. It prints the ids the Worker's vars take.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.ts              # make what is missing, then check
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.ts --check      # check only: exit 1 on any difference
//   ... --webhook-url https://staging.liveworkspace.app/api/subscription/stripe/webhook   # and the endpoint
//   ... --live                                                               # allow a live key
//
// For each tier: a Product with an eligible software tax code, and one monthly Price holding every currency's amount
// from the contract (PRICES), tax included. Prices can't be changed at Stripe, so an amount that differs is reported,
// and `--replace-prices` makes a new Price that takes the lookup key over (subscriptions on the old one keep it).
// The portal: cancel at the period's end, the card, invoices; never the plan or the seats.

import {
  CURRENCIES,
  PRICES,
  type Currency,
  type PaidTier,
} from '../../../../packages/subscription/src/prices.ts';
import { STRIPE_EVENTS } from '../src/billing/stripe/events.ts';

const API = 'https://api.stripe.com/v1';
const VERSION = '2026-04-22.dahlia';
const TIERS: PaidTier[] = ['pro', 'team'];
const LOOKUP: Record<PaidTier, string> = {
  pro: 'liveworkspace_pro_monthly',
  team: 'liveworkspace_team_monthly',
};
const PRODUCT: Record<PaidTier, { name: string; tax_code: string; unit_label?: string }> = {
  // Software as a service, personal use; and business use, for teams.
  pro: { name: 'Pro (for Individuals)', tax_code: 'txcd_10103000' },
  team: { name: 'Pro (for Teams)', tax_code: 'txcd_10103001', unit_label: 'member' },
};
const MARK = 'liveworkspace_subscription';

const args = new Set(process.argv.slice(2));
const option = (name: string) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) throw new Error('Set STRIPE_SECRET_KEY (a test key unless --live).');
if (/^(sk|rk)_live_/.test(key) && !args.has('--live'))
  throw new Error('A live key: pass --live to use it.');
const checkOnly = args.has('--check');

type Form = Record<string, string | number | boolean | undefined>;

async function stripe<T>(method: 'GET' | 'POST', path: string, form: Form = {}): Promise<T> {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(form))
    if (value !== undefined) body.append(name, String(value));
  const query = method === 'GET' && body.size > 0 ? `?${body}` : '';
  const response = await fetch(`${API}${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': VERSION,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(method === 'POST' ? { body } : {}),
  });
  const json = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`${method} ${path}: ${json.error?.message ?? response.status}`);
  return json;
}

type Price = {
  id: string;
  currency: string;
  unit_amount: number;
  tax_behavior: string;
  recurring: { interval: string } | null;
  product: string;
  currency_options?: Record<string, { unit_amount: number; tax_behavior: string }>;
};

/** Minor units: Stripe's amounts are pence and cents. */
const minor = (amount: number) => Math.round(amount * 100);

function priceForm(tier: PaidTier, product: string, transfer: boolean): Form {
  const form: Form = {
    product,
    currency: 'gbp',
    unit_amount: minor(PRICES.GBP[tier]),
    tax_behavior: 'inclusive',
    'recurring[interval]': 'month',
    lookup_key: LOOKUP[tier],
    transfer_lookup_key: transfer || undefined,
  };
  for (const currency of CURRENCIES.filter((c) => c !== 'GBP')) {
    const lower = currency.toLowerCase();
    form[`currency_options[${lower}][unit_amount]`] = minor(PRICES[currency][tier]);
    form[`currency_options[${lower}][tax_behavior]`] = 'inclusive';
  }
  return form;
}

/** How a Price differs from the contract, one line each. */
function differences(tier: PaidTier, price: Price): string[] {
  const found: string[] = [];
  if (price.recurring?.interval !== 'month') found.push('not monthly');
  for (const currency of CURRENCIES) {
    const lower = currency.toLowerCase();
    const option =
      lower === price.currency
        ? { unit_amount: price.unit_amount, tax_behavior: price.tax_behavior }
        : price.currency_options?.[lower];
    const want = minor(PRICES[currency as Currency][tier]);
    if (!option) found.push(`${currency}: missing`);
    else {
      if (option.unit_amount !== want)
        found.push(`${currency}: ${option.unit_amount} at Stripe, ${want} here`);
      if (option.tax_behavior !== 'inclusive')
        found.push(`${currency}: tax ${option.tax_behavior}, not inclusive`);
    }
  }
  return found;
}

async function findPrice(tier: PaidTier): Promise<Price | null> {
  const list = await stripe<{ data: Price[] }>('GET', '/prices', {
    'lookup_keys[0]': LOOKUP[tier],
    'expand[0]': 'data.currency_options',
  });
  return list.data[0] ?? null;
}

async function ensurePrice(tier: PaidTier): Promise<{ price: Price | null; problems: string[] }> {
  let price = await findPrice(tier);
  if (!price && !checkOnly) {
    const product = await stripe<{ id: string }>('POST', '/products', {
      name: PRODUCT[tier].name,
      tax_code: PRODUCT[tier].tax_code,
      unit_label: PRODUCT[tier].unit_label,
      [`metadata[${MARK}]`]: tier,
    });
    await stripe('POST', '/prices', priceForm(tier, product.id, false));
    price = await findPrice(tier);
  }
  if (!price) return { price: null, problems: ['no Price with its lookup key'] };
  let problems = differences(tier, price);
  if (problems.length > 0 && args.has('--replace-prices') && !checkOnly) {
    await stripe('POST', '/prices', priceForm(tier, price.product, true));
    price = await findPrice(tier);
    problems = price ? differences(tier, price) : ['the new Price was not found'];
  }
  return { price, problems };
}

async function ensurePortal(): Promise<string | null> {
  const list = await stripe<{ data: { id: string; metadata: Record<string, string> }[] }>(
    'GET',
    '/billing_portal/configurations',
    { limit: 100 },
  );
  const held = list.data.find((config) => config.metadata?.[MARK]);
  if (held || checkOnly) return held?.id ?? null;
  const made = await stripe<{ id: string }>('POST', '/billing_portal/configurations', {
    'features[subscription_cancel][enabled]': true,
    'features[subscription_cancel][mode]': 'at_period_end',
    'features[payment_method_update][enabled]': true,
    'features[invoice_history][enabled]': true,
    'features[subscription_update][enabled]': false,
    'features[customer_update][enabled]': false,
    'business_profile[headline]': 'liveworkspace Pro',
    [`metadata[${MARK}]`]: '1',
  });
  return made.id;
}

async function ensureWebhook(url: string): Promise<void> {
  const list = await stripe<{ data: { id: string; url: string; enabled_events: string[] }[] }>(
    'GET',
    '/webhook_endpoints',
    { limit: 100 },
  );
  const held = list.data.find((endpoint) => endpoint.url === url);
  if (held) {
    const missing = STRIPE_EVENTS.filter((event) => !held.enabled_events.includes(event));
    console.log(
      `Webhook endpoint ${held.id}${missing.length ? `: missing ${missing.join(', ')}` : ': every event'}`,
    );
    if (missing.length) process.exitCode = 1;
    return;
  }
  if (checkOnly) {
    console.log(`No webhook endpoint for ${url}`);
    process.exitCode = 1;
    return;
  }
  const form: Form = { url, api_version: VERSION };
  STRIPE_EVENTS.forEach((event, at) => (form[`enabled_events[${at}]`] = event));
  const made = await stripe<{ id: string; secret: string }>('POST', '/webhook_endpoints', form);
  // Shown once by Stripe: it goes straight into `wrangler secret put STRIPE_WEBHOOK_SECRET`, never a file.
  console.log(
    `Webhook endpoint ${made.id}. Its signing secret, for STRIPE_WEBHOOK_SECRET: ${made.secret}`,
  );
}

for (const tier of TIERS) {
  const { price, problems } = await ensurePrice(tier);
  const name = tier === 'pro' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_TEAM';
  console.log(
    `${name} = "${price?.id ?? ''}"${problems.length ? `  DIFFERS: ${problems.join('; ')}` : ''}`,
  );
  if (problems.length) process.exitCode = 1;
}
const portal = await ensurePortal();
console.log(`STRIPE_PORTAL_CONFIGURATION = "${portal ?? ''}"`);
const webhook = option('--webhook-url');
if (webhook) await ensureWebhook(webhook);
