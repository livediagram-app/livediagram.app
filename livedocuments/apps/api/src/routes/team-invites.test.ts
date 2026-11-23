import { describeTeamInvites } from '@liveworkspace/api-kit/testing/product-api-suites';
import { handleTeams } from './teams';
import { makeTestRouteContext } from './test-route-context';

// GET /api/teams/invites (docs/specs/013-workspace/teams.md "Invitations"): the suite every product's api runs.
describeTeamInvites({ app: 'livedocuments', handleTeams, makeTestRouteContext });
