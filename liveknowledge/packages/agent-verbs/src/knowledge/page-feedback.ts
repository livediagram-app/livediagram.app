// What the approval and page comment tools and commands do (docs/specs/030-knowledgebase/approval.md, page-comments.md
// "Agents"), one request to the api each, shared by the MCP and the CLI so both answer alike. The api holds the
// rules: an agent asks for approval and withdraws its request, never decides; it edits and deletes only its own
// comments.
import type { ApiClient } from '@liveworkspace/api-client';
import type {
  PageKnowledgeResponse,
  PageThread,
  PageThreadChange,
  PageThreadChangeResponse,
  PageThreadsResponse,
} from '@liveknowledge/api-schema';
import type { PageCommentChange } from '../mcp/page-feedback-schema';
import { jsonBody, knowledgePath } from './paths';

type Api = Pick<ApiClient, 'json'>;

export type ListedPageThread = {
  thread: string;
  state: 'open' | 'resolved';
  resolved_by?: string;
  comments: { id: string; author: string; at: string; text: string; ai?: true; edited?: true }[];
};

const iso = (ms: number) => new Date(ms).toISOString();

export function listedPageThread(t: PageThread): ListedPageThread {
  return {
    thread: t.id,
    state: t.resolved ? 'resolved' : 'open',
    ...(t.resolved && t.resolvedBy ? { resolved_by: t.resolvedBy } : {}),
    comments: t.comments.map((c) => ({
      id: c.id,
      author: c.authorName,
      at: iso(c.createdAt),
      text: c.text,
      ...(c.ai ? { ai: true as const } : {}),
      ...(c.editedAt ? { edited: true as const } : {}),
    })),
  };
}

/** Ask for approval, or take the request back. Answers the page's id and what it now is. */
export async function requestApproval(
  api: Api,
  documentId: string,
  page: string,
  withdraw = false,
): Promise<{ page: string; approval: 'pending' | 'withdrawn' }> {
  const { knowledge } = await api.json<PageKnowledgeResponse>(
    knowledgePath(documentId, 'pages', page, 'approval'),
    jsonBody('POST', { action: withdraw ? 'withdraw' : 'request' }),
  );
  return { page: knowledge.tab, approval: withdraw ? 'withdrawn' : 'pending' };
}

/** The page's threads, filtered by state. */
export async function listPageComments(
  api: Api,
  documentId: string,
  page: string,
  status: 'open' | 'resolved' | 'all' = 'open',
): Promise<{ page: string; threads: ListedPageThread[] }> {
  const { threads } = await api.json<PageThreadsResponse>(
    knowledgePath(documentId, 'pages', page, 'threads'),
  );
  const shown = threads.filter((t) =>
    status === 'all' ? true : status === 'resolved' ? t.resolved : !t.resolved,
  );
  return { page: threads[0]?.tab ?? page, threads: shown.map(listedPageThread) };
}

const short = (id: string) => id.slice(0, 8);

function appliedLine(change: PageCommentChange, answer: PageThreadChangeResponse): string {
  if ('removed' in answer)
    return `- deleted the last comment; thread ${short(answer.removed)} is gone`;
  const id = short(answer.thread.id);
  switch (change.op) {
    case 'start':
      return `+ started thread ${id}`;
    case 'reply':
      return `+ replied on thread ${id}`;
    case 'resolve':
      return `~ resolved thread ${id}`;
    case 'reopen':
      return `~ reopened thread ${id}`;
    case 'edit':
      return `~ edited a comment on thread ${id}`;
    case 'delete':
      return `- deleted a comment on thread ${id}`;
  }
}

/** Apply the changes in order. A refusal (an ApiError) stops the rest: `applied` says what landed before it. */
export async function applyPageCommentChanges(
  api: Api,
  documentId: string,
  page: string,
  changes: readonly PageCommentChange[],
): Promise<{ applied: string[]; failure?: Error }> {
  const applied: string[] = [];
  for (const change of changes) {
    try {
      const answer = await api.json<PageThreadChangeResponse>(
        knowledgePath(documentId, 'pages', page, 'threads'),
        jsonBody('POST', change satisfies PageThreadChange),
      );
      applied.push(appliedLine(change, answer));
    } catch (failure) {
      return {
        applied,
        failure:
          failure instanceof Error ? failure : new Error('The change failed.', { cause: failure }),
      };
    }
  }
  return { applied };
}
