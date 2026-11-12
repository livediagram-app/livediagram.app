'use client';

// A GitHub trigger's part of the When panel (docs/specs/026-plan/automations.md "GitHub triggers"): Checks Finished's
// Failing or Passing, which cards it runs on, and where the plan stands with GitHub: the repositories it hears (and
// Manage, to the GitHub view), or Connect GitHub in place, keeping this rule for the round trip. Off where the
// deployment has no GitHub App: the rule then hears nothing, and says so.

import type { AutomationTrigger, GithubTriggerKind } from '@liveplanner/items';
import { Button } from '@liveplanner/ui';
import { PanelField, PanelNote, PanelSelect } from '../step-panels/panel-parts';
import { useGithubAutomations } from './github-automations';
import { GithubConnectCard } from './GithubConnectCard';
import { useGithubConnection } from './use-github-connection';
import type { AutomationsScope } from '../automations-client';

type GithubTrigger = Extract<AutomationTrigger, { kind: GithubTriggerKind }>;

export const GITHUB_CARDS_NOTE =
  'Runs once on each card the pull request links: by a Pull Request field, a Link field, or its title or body naming the card, like “Work Tracker #12”.';

/** "acme/web", "acme/web and acme/api", "acme/web, acme/api and 2 more". */
export function heardRepositories(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

function ConnectionLine({ scope, onManage }: { scope: AutomationsScope; onManage: () => void }) {
  const gh = useGithubAutomations();
  const github = useGithubConnection(scope, true);
  if (github.status === 'refused')
    return <PanelNote>Only an Editor signed in can connect GitHub.</PanelNote>;
  if (github.status === 'error' && !github.connection)
    return (
      <PanelNote>
        Couldn’t check GitHub.{' '}
        <button
          type="button"
          onClick={github.reload}
          className="cursor-pointer font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
        >
          Try Again
        </button>
      </PanelNote>
    );
  if (github.status !== 'ready' && !github.connection)
    return (
      <p role="status" className="text-[12px] text-slate-500 dark:text-slate-400">
        Checking GitHub…
      </p>
    );
  const c = github.connection;
  if (!c) return <GithubConnectCard scope={scope} draft={() => gh?.draft() ?? null} compact />;
  const heard = c.repositories.filter((r) => r.chosen).map((r) => r.fullName);
  return (
    <div
      data-github-heard=""
      className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60"
    >
      <p className="min-w-0 flex-1 text-[13px] text-slate-600 dark:text-slate-300">
        {heard.length
          ? `Hears ${heardRepositories(heard)} on ${c.account}.`
          : 'No repository is picked yet, so this rule hears nothing.'}
      </p>
      <Button variant="secondary" size="xs" onClick={onManage}>
        {heard.length ? 'Manage' : 'Pick Repositories'}
      </Button>
    </div>
  );
}

export function GithubTriggerFields({
  trigger,
  onChange,
}: {
  trigger: GithubTrigger;
  onChange: (next: AutomationTrigger) => void;
}) {
  const gh = useGithubAutomations();
  return (
    <>
      {trigger.kind === 'pull_request_checks' ? (
        <PanelField label="Checks Turn">
          {(id) => (
            <PanelSelect
              id={id}
              value={trigger.result}
              onChange={(e) =>
                onChange({
                  kind: 'pull_request_checks',
                  result: e.target.value === 'passing' ? 'passing' : 'failing',
                })
              }
            >
              <option value="failing">Failing</option>
              <option value="passing">Passing</option>
            </PanelSelect>
          )}
        </PanelField>
      ) : null}
      <PanelNote>{GITHUB_CARDS_NOTE}</PanelNote>
      {gh && !gh.enabled ? (
        <PanelNote>GitHub isn’t set up here, so this rule hears nothing.</PanelNote>
      ) : gh ? (
        <ConnectionLine scope={gh.scope} onManage={gh.openView} />
      ) : null}
    </>
  );
}
