// The tokens an AI tool or an app's CLI signed in with, which no app sends in its own name any more, shared by every
// app's retired-events.ts (each product's docs/specs/017-telemetry/telemetry.md "Retired features"). Every app's MCP
// folded into the one MCP (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in"): AI tools connect on its
// consent page and the CLIs sign in there or on the device page, both on liveworkspace.app, which counts each token
// as `Token·Created·MCP` or `Token·Created·Cli` in liveworkspace's own name (PLATFORM_OWN_TELEMETRY_EVENTS). So the
// rows stored under an app are dropped from its dashboard, whose AI Tools Connected and CLI Sign-ins charts went; All
// Apps charts them now. Tokens made by hand (`Manual`) and revoked carry on in API Token Activity.

import { PLATFORM_OWN_TELEMETRY_EVENTS } from '@liveworkspace/telemetry';

const AGENT_SIGN_IN_TOKEN_TYPES: ReadonlySet<string> = new Set(
  PLATFORM_OWN_TELEMETRY_EVENTS['Token·Created'],
);

/** Whether an event is a token an AI tool or a CLI signed in with, counted now by liveworkspace.app alone. */
export function isRetiredAgentSignInToken(
  category: string,
  action: string,
  type: string | null,
): boolean {
  return category === 'Token' && action === 'Created' && AGENT_SIGN_IN_TOKEN_TYPES.has(type ?? '');
}
