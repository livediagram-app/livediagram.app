// Test support for the OpenAPI drift test: the signed-in caller its probes run as. Each test file that probes
// the dispatch mocks the two modules below with these, so the signed-in-only surfaces (teams, tokens, OAuth
// exchange) route instead of answering 401 for every path under them:
//
//   vi.mock('../auth/accounts', () => import('./probe-caller').then((m) => m.probeAccounts()));
//   vi.mock('../person/profiles', () => import('./probe-caller').then((m) => m.probeProfiles()));
//
// Imports nothing of the worker at load, so a mock factory can import it while the worker is still loading.

/** Stands in for `../auth/accounts`: every request is an account that owns the placeholder team. */
export function probeAccounts() {
  return {
    getPersonIdentity: async () => ({
      kind: 'account',
      userId: 'user_probe',
      email: null,
      teams: [{ id: 'probe-param', name: 'Probe', role: 'owner' }],
    }),
  };
}

/** Stands in for `../person/profiles`: every participant id names someone, so GET /participants/{id} answers
 *  rather than 404ing. */
export async function probeProfiles() {
  return {
    ...(await import('../test-profiles')),
    getParticipant: async (_env: unknown, id: string) => ({
      id,
      name: 'Probe',
      color: '#000',
      createdAt: 1,
    }),
  };
}
