'use client';

// Start a Project (liveworkspace/docs/specs/010-site/site.md "Start a Project"): the kits, the setup under them, and a
// run's card in its place once Create is pressed. Signed in only: signed out (or as a guest), the page shows as it is
// and Create signs in first, coming back here.
import { useMemo, useState } from 'react';
import {
  createIndexClient,
  kitById,
  KITS,
  type IndexClient,
  type KitId,
  type Level,
} from '@liveworkspace/index-client';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { signInHref } from '@/lib/accounts';
import { workspaceToken } from '@/lib/explorer/token';
import { useSession } from '@/lib/session';
import { KitCards } from './KitCards';
import { KitRunCard } from './KitRunCard';
import { KitSetup } from './KitSetup';
import { useKitRun } from './useKitRun';

const KITS_PATH = '/kits';

export function KitsPage({
  client: given,
}: {
  // The index, handed in by tests.
  client?: Pick<IndexClient, 'startKit' | 'removeKit'>;
}) {
  const client = useMemo(() => given ?? createIndexClient({ getToken: workspaceToken }), [given]);
  const session = useSession();
  const [kitId, setKitId] = useState<KitId>(KITS[0]!.id);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('edit');
  const runner = useKitRun(client);
  const kit = kitById(kitId);
  const project = name.trim() || kit.title;
  const { phase } = runner;
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Start a Project
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
          One click makes every file your project needs, in every app, in a new folder, each one
          connected to the others.
        </p>
        <div className="mt-10">
          <KitCards value={kitId} onChange={setKitId} disabled={phase.kind !== 'setup'} />
        </div>
        {phase.kind === 'setup' ? (
          <KitSetup
            kit={kit}
            name={name}
            onName={setName}
            level={level}
            onLevel={setLevel}
            signedIn={session.state}
            signInHref={signInHref(KITS_PATH)}
            error={runner.error}
            onCreate={() => runner.start({ kit: kitId, level, name: project })}
          />
        ) : (
          <KitRunCard
            kit={kit}
            project={project}
            level={level}
            phase={phase}
            error={runner.error}
            onRetry={runner.retry}
            onAskRemove={runner.askRemove}
            onCancelRemove={runner.cancelRemove}
            onRemove={runner.remove}
            onReset={() => {
              setName('');
              runner.reset();
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
