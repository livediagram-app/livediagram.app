'use client';

// Connect (docs/specs/030-knowledgebase/mcp-connect.md): the knowledgebase's fourth view, a guided setup that
// connects an AI app over the MCP server, step by step, and shows it connected. Signed out it asks for a sign-in;
// Offline there is nothing an app could reach.
import { useMemo, useState } from 'react';
import { mcpEndpoint } from '@liveknowledge/api-schema';
import { EmptyState } from '@liveknowledge/ui';
import { useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { ConnectViewIcon } from '@/components/ask/ask-icons';
import { KnowledgeViewHeader } from '@/components/ask/KnowledgeViewFrame';
import { useAskSession, type AskSession } from '@/components/ask/useAskSession';
import { showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';
import {
  connectApps,
  keepConnectApp,
  keptConnectApp,
  type ConnectAppId,
} from '@/lib/knowledge-connect/connect-apps';
import { connectRole } from '@/lib/knowledge-connect/connect-words';
import { MCP_ORIGIN } from '@/lib/mcp-config';
import { useRelativeNow } from '@/lib/relative-time';
import { AccessStep } from './AccessStep';
import { AppPicker } from './AppPicker';
import { AppSteps } from './AppSteps';
import { AlreadyConnected, OtherWaysIn } from './ConnectAside';
import { ConnectSignedOut } from './ConnectSignedOut';
import { ConnectStep } from './ConnectStep';
import { StatusStep } from './StatusStep';
import { useConnectStatus } from './useConnectStatus';

export const CONNECT_ABOUT =
  'Connect an AI app over MCP so it can read and write this knowledgebase.';

export function ConnectView() {
  const session = useAskSession();
  if (!session) return null;
  return (
    <>
      <KnowledgeViewHeader title="Connect" about={CONNECT_ABOUT} />
      {session.rights.askOff === 'offline' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-xl px-4 py-10">
            <EmptyState
              icon={<ConnectViewIcon />}
              title="No Connections to an Offline Knowledgebase"
              description="This knowledgebase is kept in this browser, where no AI app can reach it. Sync it to connect one."
            />
          </div>
        </div>
      ) : session.rights.askOff === 'signed-out' ? (
        <ConnectSignedOut />
      ) : (
        <ConnectSteps session={session} />
      )}
    </>
  );
}

function ConnectSteps({ session }: { session: AskSession }) {
  const { who, documentId, name, rights } = session;
  const chrome = useEditorChromeStore();
  const now = useRelativeNow();
  const apps = useMemo(() => connectApps(mcpEndpoint(MCP_ORIGIN)), []);
  const [picked, setPicked] = useState<ConnectAppId>(keptConnectApp);
  const app = apps.find((a) => a.id === picked) ?? apps[0]!;
  const { status, agents, checkNow } = useConnectStatus(who, documentId, true);
  const role = connectRole(rights);
  const openAgents = () => showKnowledgeView('ai');
  const pick = (id: ConnectAppId) => {
    setPicked(id);
    keepConnectApp(id);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-connect="">
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <ol aria-label="Steps" className="flex min-w-0 flex-col gap-4">
          <ConnectStep
            n={1}
            step="pick"
            title="Pick Your AI App"
            about="The app you want to read and write these pages."
          >
            <AppPicker apps={apps} picked={app.id} onPick={pick} />
          </ConnectStep>
          <ConnectStep
            n={2}
            step="add"
            title={`Add liveknowledge to ${app.name}`}
            about={app.blurb}
          >
            <AppSteps app={app} />
          </ConnectStep>
          <ConnectStep
            n={3}
            step="access"
            title="Approve and Choose Access"
            about="What the app may do here, and how writing is allowed."
          >
            <AccessStep role={role} name={name} onOpenAgents={openAgents} />
          </ConnectStep>
          <ConnectStep
            n={4}
            step="check"
            title="Check It Worked"
            about="Your app shows here once it reads a page of this knowledgebase."
          >
            <StatusStep
              status={status}
              name={name}
              now={now}
              onCheckNow={checkNow}
              onManage={openAgents}
            />
          </ConnectStep>
        </ol>
        <aside aria-label="Connections" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
          <AlreadyConnected agents={agents} onManage={openAgents} />
          <OtherWaysIn name={name} onOpenTokens={() => chrome.get().openSettingsOn('tokens')} />
        </aside>
      </div>
    </div>
  );
}
