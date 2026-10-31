// The Community's remote off switch (docs/specs/025-community/community.md "Turning the Community off"): the worker's
// COMMUNITY_ENABLED set to false, 0 or off turns it off; unset or anything else leaves it on, so a deployment needs
// nothing. Every app's, from the shared app client.
export { communityEnabled } from '@liveworkspace/community/app';
