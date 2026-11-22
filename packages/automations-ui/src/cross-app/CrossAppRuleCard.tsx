'use client';

// A rule with steps in other apps says what they mean, beside its steps (liveworkspace/docs/specs/018-automations/
// automations.md "Who a step acts as", "Limits"; blueprint cross-app.md "In the builder"): Runs As (the person whose
// save it was: you, once you save it), Reaches (each item a step acts on), Limits (the rule's and the account's day,
// the chain's hops), and the way to its last runs on the Audit Trail. Shown only for a rule that holds such a step.
import {
  CROSS_APP_AUTHOR_DAY_MAX,
  CROSS_APP_HOPS_MAX,
  CROSS_APP_RULE_DAY_MAX,
} from '@liveworkspace/index-client';
import { appWord, isCrossAppKind, type CrossAppStep } from '@liveworkspace/automations/cross-app';
import { Button } from '@liveworkspace/ui';
import type { RuleBody } from '../types';

export type Reach = { key: string; title: string; app: string; what: string };

const WHAT: Readonly<Record<CrossAppStep['kind'], string>> = {
  plan_card: 'Creates a card',
  kb_page: 'Writes a page',
  space_post: 'Posts a note',
  doc_tab: 'Adds a tab',
  inbox_notice: 'Notifies people',
};

/** Each item the rule's steps in other apps act on, once each, in order; Notify reaches people in every app. */
export function reachesOf(body: Pick<RuleBody, 'steps'>): Reach[] {
  const out: Reach[] = [];
  const seen = new Set<string>();
  for (const s of body.steps) {
    if (!isCrossAppKind(s.kind)) continue;
    const step = s as unknown as CrossAppStep;
    if (step.kind === 'inbox_notice') {
      if (seen.has('inbox')) continue;
      seen.add('inbox');
      out.push({ key: 'inbox', title: 'Inbox', app: 'Every app', what: WHAT.inbox_notice });
      continue;
    }
    const key = `${step.target.item}:${step.kind}`;
    if (!step.target.item || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      title: step.target.title || 'Untitled',
      app: appWord(step.target.app),
      what: WHAT[step.kind],
    });
  }
  return out;
}

const Label = ({ children }: { children: string }) => (
  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
    {children}
  </dt>
);

export function CrossAppRuleCard({
  body,
  author,
  onRuns,
}: {
  body: Pick<RuleBody, 'steps'>;
  // Who last saved it, by name; null for a rule not saved yet.
  author: string | null;
  // Opens the rule's runs on the Audit Trail; absent for a rule not saved yet.
  onRuns?: (() => void) | undefined;
}) {
  const reaches = reachesOf(body);
  if (!body.steps.some((s) => isCrossAppKind(s.kind))) return null;
  return (
    <section
      aria-label="Steps in Other Apps"
      data-cross-rule-card=""
      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
    >
      <dl className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label>Runs As</Label>
          <dd className="text-[13px] text-slate-800 dark:text-slate-100">
            {author ? (
              <>
                <span className="font-semibold">{author}</span>, who last saved it. Lost access
                stops the rule.
              </>
            ) : (
              'You, once you save it. Lost access stops the rule.'
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Reaches</Label>
          <dd>
            {reaches.length ? (
              <ul className="flex flex-col gap-1">
                {reaches.map((r) => (
                  <li key={r.key} className="text-[13px] text-slate-800 dark:text-slate-100">
                    {r.what} in <span className="font-semibold">{r.title}</span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">· {r.app}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[13px] text-slate-500 dark:text-slate-400">
                Nothing picked yet.
              </span>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Limits</Label>
          <dd className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
            {CROSS_APP_RULE_DAY_MAX} runs a day for this rule, {CROSS_APP_AUTHOR_DAY_MAX} a day for
            your account. A chain stops after {CROSS_APP_HOPS_MAX} hops and never fires the same
            rule twice. AI steps keep their own daily allowance.
          </dd>
        </div>
      </dl>
      {onRuns ? (
        <div>
          <Button variant="secondary" size="xs" onClick={onRuns}>
            Last Runs in the Audit Trail
          </Button>
        </div>
      ) : null}
    </section>
  );
}
