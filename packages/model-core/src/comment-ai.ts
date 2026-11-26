// AI comments in the Inbox (liveworkspace/docs/specs/004-index/inbox-reading.md "AI comments"): what a comment thread
// tells the Inbox about the agents that wrote in it, worked out once for every app's push (canvas elements, Sheet
// cells, Plan cards). A comment an agent wrote (an API token: the MCP, the CLI, a script) carries `ai` and the
// assistant's name, `agent`; it reaches nobody's Inbox unless it asks for a response (`needsResponse`).

/** The comment fields this reads: every app's comment carries them (the last three only on an agent's). */
export type AiMarkedComment = {
  createdAt: number;
  ai?: boolean;
  agent?: string;
  needsResponse?: boolean;
};

/** How the Inbox lists a thread for its agents' comments: `quiet` (only agents wrote in it and none asked: listed in
 *  nobody's Inbox), `ask` (an agent's comment asking for a response is newer than every person's), or neither. */
export type ThreadAiState = 'quiet' | 'ask';

/** The longest assistant name kept on a comment, as the index cuts an agent's name. */
export const COMMENT_AGENT_MAX = 80;

/** An assistant's name as a comment keeps it: trimmed, control characters dropped, cut to COMMENT_AGENT_MAX; null
 *  for none. */
export function commentAgentName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let out = '';
  // Only the start can survive the cut: a long value is never walked whole.
  for (const ch of value.slice(0, COMMENT_AGENT_MAX * 4)) {
    const code = ch.codePointAt(0)!;
    out += code < 32 || code === 127 ? ' ' : ch;
  }
  const name = out.replace(/\s+/g, ' ').trim().slice(0, COMMENT_AGENT_MAX).trim();
  return name || null;
}

/** The marks an agent's new comment carries (the app stamps them, never taken from a person's request): its
 *  assistant's name and, when the body asked with `needsResponse: true`, the ask. A person's comment carries none. */
export function agentCommentMarks(
  agent: string | null | undefined,
  body: { needsResponse?: unknown },
): { agent?: string; needsResponse?: true } {
  const name = commentAgentName(agent);
  return {
    ...(name ? { agent: name } : {}),
    ...(body.needsResponse === true ? { needsResponse: true as const } : {}),
  };
}

/** A thread's `latestAgent` (the assistant's name when its latest comment is an agent's) and `aiState`, from its
 *  comments (any order). An empty thread has neither. */
export function threadAiState(comments: readonly AiMarkedComment[]): {
  latestAgent?: string;
  aiState?: ThreadAiState;
} {
  let latest: AiMarkedComment | null = null;
  let personAt = -Infinity;
  let askAt = -Infinity;
  for (const c of comments) {
    if (!latest || c.createdAt >= latest.createdAt) latest = c;
    if (!c.ai) personAt = Math.max(personAt, c.createdAt);
    else if (c.needsResponse === true) askAt = Math.max(askAt, c.createdAt);
  }
  if (!latest) return {};
  const latestAgent = latest.ai ? (commentAgentName(latest.agent) ?? 'AI') : undefined;
  // An ask stands until a person writes after it; with neither a person nor an ask, the thread is the agents' alone.
  const aiState: ThreadAiState | undefined =
    askAt > personAt ? 'ask' : personAt === -Infinity ? 'quiet' : undefined;
  return {
    ...(latestAgent ? { latestAgent } : {}),
    ...(aiState ? { aiState } : {}),
  };
}
