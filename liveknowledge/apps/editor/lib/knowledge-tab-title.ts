// The browser tab's title on a knowledgebase (owner, 2026-11-21): "<page> | <knowledgebase> | liveknowledge", the page
// left out while it has no name (still loading).
export function knowledgeTabTitle(page: string | null | undefined, knowledgebase: string): string {
  const named = page?.trim();
  return named ? `${named} | ${knowledgebase} | liveknowledge` : `${knowledgebase} | liveknowledge`;
}
