// The teams an access token names (its `teams` claim, liveworkspace/docs/accounts.md "Teams"), read without
// checking the signature: for the Explorer's team list. None for a guest or anything unreadable.
export type TokenTeam = { id: string; name: string };

export function teamsOfToken(token: string | null): TokenTeam[] {
  const part = token?.split('.')[1];
  if (!part) return [];
  try {
    // The payload is UTF-8: a team's name may hold any letter, which atob alone would garble.
    const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
    ) as { teams?: unknown };
    if (!Array.isArray(claims.teams)) return [];
    return claims.teams.flatMap((team: unknown) => {
      const t = team as { id?: unknown; name?: unknown };
      return typeof t?.id === 'string' && typeof t.name === 'string'
        ? [{ id: t.id, name: t.name }]
        : [];
    });
  } catch {
    return [];
  }
}
