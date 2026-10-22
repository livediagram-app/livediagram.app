// A guest vote the api refused because its network already holds the most guest voters a document takes
// (docs/specs/012-collaboration/vote-integrity.md). Retrying will not help; signing in will, since an account votes
// freely. One message for every surface that votes over REST (the Q&A board, a Plan card).
export const VOTE_LIMIT_MESSAGE =
  'Too many guests on this network have voted here already. Sign in to vote.';

export function isVoteLimitError(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 'vote_limit';
}
