// A plan's GitHub connection as the api answers it to an Editor (docs/specs/026-plan/github-pull-requests.md "The
// GitHub connection"; blueprint "Part 2"). Never a token: the installation's id and account, the repositories the
// person who connected it could reach, and which of them are connected.

/** One repository the connection lists. `chosen`: connected to the plan, so its pull requests reach it. */
export type GithubRepositoryView = {
  id: number;
  // `owner/name`, as GitHub names it.
  fullName: string;
  private: boolean;
  chosen: boolean;
};

/** Who connected the plan, as a card's history names a person. */
export type GithubConnectedBy = { id: string; name: string };

export type GithubConnectionView = {
  installationId: number;
  // The GitHub account (a person or an organisation) the App is installed on.
  account: string;
  connectedBy: GithubConnectedBy;
  connectedAt: number;
  repositories: GithubRepositoryView[];
};

/** GET /api/projects/:id/github: the plan's connection, or null for none. */
export type GithubConnectionResponse = { connection: GithubConnectionView | null };

/** POST /api/projects/:id/github/connect: the App's install page on GitHub, carrying a one-time state. */
export type GithubConnectStartResponse = { url: string };

/** PUT /api/projects/:id/github/repositories: the repositories to connect, by id, from the ones listed. */
export type GithubRepositoriesRequest = { ids: number[] };
