// What the account panels read from the accounts API's account routes (liveworkspace/apps/accounts src/account-api.ts).

type AccountTeamRole = 'admin' | 'member';

/** One of the person's teams (`GET /teams`), as far as the panels read it: its name, and whether they run it. */
export interface AccountTeam {
  id: string;
  name: string;
  role: AccountTeamRole;
}

/** One API token (`GET /tokens`); the secret comes once, when it is made. */
export interface ApiToken {
  id: string;
  name: string;
  readOnly: boolean;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number;
}
