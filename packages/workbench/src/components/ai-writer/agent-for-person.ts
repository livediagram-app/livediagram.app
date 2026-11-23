// How an agent's write is named where a person's name would stand (liveknowledge's verification.md "Made by a person
// or an agent", its version-history.md "In the editor"): the agent and the person whose token it wrote with, "Claude
// for Priya Shah", never the person alone. Pure.

/** The agent with no name of its own, as a sentence's subject. */
export const AN_AGENT = 'An agent';

/** "Claude for Priya Shah"; the agent alone when no one is named; `fallback` for an agent with no name. */
export function agentForPerson(
  agent: string | null | undefined,
  person: string | null | undefined,
  fallback: string = AN_AGENT,
): string {
  const who = agent?.trim() || fallback;
  const behalf = person?.trim();
  return behalf ? `${who} for ${behalf}` : who;
}
