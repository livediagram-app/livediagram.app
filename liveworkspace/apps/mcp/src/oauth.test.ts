// The one MCP's built-in clients are the apps' CLIs (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs retire"):
// each as its own api-schema names it, so a CLI signing in here is the client it always was.
import * as livedesign from '@livedesign/api-schema';
import * as livediagram from '@livediagram/api-schema';
import * as livedocuments from '@livedocuments/api-schema';
import * as liveknowledge from '@liveknowledge/api-schema';
import * as liveplanner from '@liveplanner/api-schema';
import { describe, expect, it } from 'vitest';
import { CLI_CLIENTS } from './oauth';

describe('CLI clients', () => {
  it('names every app CLI as its api-schema does', () => {
    const products = [livediagram, livedocuments, liveplanner, livedesign, liveknowledge];
    expect(Object.keys(CLI_CLIENTS).toSorted()).toEqual(
      products.map((p) => p.CLI_CLIENT_ID).toSorted(),
    );
    for (const p of products)
      expect(CLI_CLIENTS[p.CLI_CLIENT_ID]!.clientName).toBe(p.CLI_CLIENT_NAME);
  });
});
