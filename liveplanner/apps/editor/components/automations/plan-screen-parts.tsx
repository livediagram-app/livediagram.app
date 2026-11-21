'use client';

// liveplanner's own parts of the platform's Automations screen (docs/specs/026-plan/automations.md "The GitHub
// view", "Email Received", "Values"): what the kit (plan-kit.tsx) plugs in around the screen and the builder. The
// GitHub seam its GitHub view, trigger fields and Needs Attention read (GithubAutomationsContext), the boards' email
// addresses the Email Received panel reads, the Preview under a step that writes text, and the way to fix a GitHub
// rule that needs attention.

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { AutomationNeed, AutomationRuleBody } from '@liveplanner/items';
import type { AutomationsScope } from '@liveworkspace/automations-ui/kit';
import { useAutomationsScreen } from '@liveworkspace/automations-ui/kit-context';
import { RULE_ROW_LINK } from '@liveworkspace/automations-ui/RuleRow';
import { usePlan } from '@/components/plan/PlanContext';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import type { AutomationOutline } from './automation-outline';
import { EmailAddressesProvider, useEmailAddressesState } from './email-addresses';
import {
  GithubAutomationsContext,
  useGithubAutomations,
  type GithubAutomations,
} from './github/github-automations';
import { StepPreview } from './StepPreview';

/** Around the screen: GitHub, from the one capabilities read the editor shares; the connection itself is read by
 *  the GitHub view and a GitHub trigger's panel, as they open. */
export function PlanScreenProvider({ children }: { children: ReactNode }) {
  const screen = useAutomationsScreen();
  const { githubEnabled } = useCapabilities();
  const github = useMemo<GithubAutomations | null>(
    () =>
      screen
        ? {
            enabled: githubEnabled,
            scope: screen.scope,
            openView: () => screen.openView('github'),
            // A new rule as it stands, for Connect GitHub to keep for the round trip (github-return.ts): a saved
            // rule is read again from the list on the way back.
            draft: () => {
              const held = screen.draft();
              return held && held.ruleId === null
                ? { body: held.body as AutomationRuleBody, picks: [...held.picks] as never }
                : null;
            },
          }
        : null,
    [screen, githubEnabled],
  );
  return <GithubAutomationsContext value={github}>{children}</GithubAutomationsContext>;
}

/** Around the builder: the plan's board addresses for Email Received's Board picker, read once when that panel
 *  first opens (email-addresses.tsx). */
export function PlanBuilderProvider({
  scope,
  children,
}: {
  scope: AutomationsScope;
  children: ReactNode;
}) {
  const addresses = useEmailAddressesState(scope);
  return <EmailAddressesProvider state={addresses}>{children}</EmailAddressesProvider>;
}

/** The Preview under a comment, an email or a message's panel, on a real card of the plan. */
export function PlanStepPreview({
  text,
  body,
  outline,
  now,
  branch,
  via,
}: {
  text: string;
  body: AutomationRuleBody;
  outline: AutomationOutline;
  now: number;
  branch: boolean;
  via?: string | undefined;
}) {
  // Who is building it, for the previews.
  const person = usePlan()?.self?.name ?? 'You';
  return (
    <StepPreview
      text={text}
      outline={outline}
      rule={body.name}
      person={person}
      now={now}
      branch={branch}
      via={via}
    />
  );
}

/** After Needs Attention's words: a GitHub rule on a plan not connected, or whose named repositories are all gone,
 *  offers the way to fix it (the GitHub view), where the screen offers GitHub. The screen is a signed-in Editor's
 *  alone, so no other role sees either. */
export function PlanNeedsFix({ attention }: { attention: readonly AutomationNeed[] }) {
  const github = useGithubAutomations();
  const fix = !github?.enabled
    ? null
    : attention.some((n) => n.kind === 'github')
      ? 'Connect GitHub'
      : attention.some((n) => n.kind === 'repositories')
        ? 'Manage Repositories'
        : null;
  if (!fix) return null;
  return (
    <>
      {' '}
      <span aria-hidden>·</span>{' '}
      <button type="button" className={`${RULE_ROW_LINK} z-[1]`} onClick={github?.openView}>
        {fix}
      </button>
    </>
  );
}
