'use client';

import { useState } from 'react';
import { ErrorNote, Panel } from '../account-ui';
import { accountErrorMessage } from '../errors';
import { useAccountData } from '../useAccountData';
import { providerLabel, type AiKeysAnswer, type AiTeamKey } from './ai-keys';
import { AiKeyEditor } from './AiKeyEditor';

// Settings › AI (liveworkspace/docs/specs/003-accounts/ai-keys.md "Settings"): the person's own AI key and, for each
// team they admin, the team's, used by every app's AI features in place of built-in AI. A team's members see that it
// has one, never its ending. Drawn in place wherever a signed-in account opens Settings.
export function AiKeyPanel() {
  const [load, refresh] = useAccountData<AiKeysAnswer>('/ai-key');
  // The answer of the last change, until the next read: every change answers the whole state.
  const [changed, setChanged] = useState<AiKeysAnswer | null>(null);
  const data = changed ?? (load.state === 'ready' ? load.data : null);

  if (load.state === 'loading' && !data)
    return (
      <div
        aria-busy
        className="h-40 animate-pulse rounded-2xl bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70"
      />
    );
  if (load.state === 'error' && !data)
    return (
      <ErrorNote action={{ label: 'Try Again', onSelect: () => void refresh() }}>
        {accountErrorMessage(load.error)}
      </ErrorNote>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Every app’s AI features use built-in AI, or a key of your own. A team’s key comes before
        yours in that team’s work, and a knowledgebase’s own key before both.
      </p>
      {!data.available && <ErrorNote>{accountErrorMessage('ai_keys_unavailable')}</ErrorNote>}
      <Panel>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Your Key</h2>
        <div className="mt-4">
          <AiKeyEditor
            teamId={null}
            state={data.key}
            providers={data.providers}
            owner="you"
            onChanged={setChanged}
          />
        </div>
      </Panel>
      {data.teams.length > 0 && (
        <section aria-labelledby="ai-team-keys" className="space-y-3">
          <h2 id="ai-team-keys" className="text-base font-semibold text-slate-900 dark:text-white">
            Your Teams’ Keys
          </h2>
          {data.teams.map((team) => (
            <TeamKey key={team.id} team={team} answer={data} onChanged={setChanged} />
          ))}
        </section>
      )}
    </div>
  );
}

function TeamKey({
  team,
  answer,
  onChanged,
}: {
  team: AiTeamKey;
  answer: AiKeysAnswer;
  onChanged: (next: AiKeysAnswer) => void;
}) {
  return (
    <Panel>
      <h3 className="font-semibold text-slate-900 dark:text-white">
        <bdi>{team.name}</bdi>
      </h3>
      {team.canManage ? (
        <div className="mt-4">
          <AiKeyEditor
            teamId={team.id}
            state={team.key}
            providers={answer.providers}
            owner={`the team ${team.name}`}
            onChanged={onChanged}
          />
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400" data-ai-team-member="">
          {team.key
            ? `Uses the team’s ${providerLabel(answer.providers, team.key.provider)} key in the team’s work. Only its admins can change it.`
            : 'No team key: the team’s work uses your key, or built-in AI. Its admins can add one.'}
        </p>
      )}
    </Panel>
  );
}
