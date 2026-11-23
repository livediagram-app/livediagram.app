import { vi } from 'vitest';
import { describeDispatchSweep } from './dispatch-sweep';

// Share 2 of the dispatch sweep (dispatch-sweep.ts says why it is split), probed as a signed-in caller.
vi.mock('../auth/accounts', () => import('./probe-caller').then((m) => m.probeAccounts()));
vi.mock('../person/profiles', () => import('./probe-caller').then((m) => m.probeProfiles()));

describeDispatchSweep(1);
