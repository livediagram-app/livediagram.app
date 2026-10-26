// Shared result / auth plumbing for the MCP tools (docs/specs/015-api/mcp-server.md): the text and
// error result shapes, the deep links, the bearer-token guard every tool
// uses, and the load-a-tab sequence the read and edit tools share.
// Deliberately render-free, so it can be unit-tested: the inline-PNG
// result lives in image-result.ts and the pure tab builders in @liveplanner/project
// and @liveplanner/templates. tools.ts keeps the registrations.

import type { Project, ProjectResponse, TabRecord, TabResponse } from '@liveplanner/api-schema';
import { apiJson } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { errorResult, ToolInputError } from '@liveworkspace/mcp-kit/tool-result';

// The result shapes, the token guard and ToolInputError every product's tools share.
export {
  errorResult,
  requireToken,
  textResult,
  ToolInputError,
  viewResult,
  type Extra,
  type StructuredValue,
  type ToolResult,
} from '@liveworkspace/mcp-kit/tool-result';

// The editor app this MCP server belongs to: its own host on staging and on any other deployment
// (CONSENT_BASE_URL, as the consent and device pages use), liveplanner.app otherwise.
export const appBase = (env: Pick<Env, 'CONSENT_BASE_URL'>) =>
  env.CONSENT_BASE_URL ?? 'https://liveplanner.app';

export const deepLink = (env: Pick<Env, 'CONSENT_BASE_URL'>, id: string) =>
  `${appBase(env)}/project/${id}`;

// A share link's public URL (docs/specs/013-workspace/share-password.md): visitors land on /project/shared?s=<code>
// and the app resolves the code to the project + granted role.
export const shareUrl = (env: Pick<Env, 'CONSENT_BASE_URL'>, code: string) =>
  `${appBase(env)}/project/shared?s=${encodeURIComponent(code)}`;

// A refusal after some changes went through says which did (the Plan and Sheet tools' many-change writes).
export const stopped = (message: string, applied: readonly string[]) =>
  errorResult(applied.length ? `${message} Applied before it: ${applied.join('; ')}.` : message);

// Load a project and one of its tabs: the named tab, or the first one when the
// caller didn't name one (the default every tab-scoped tool applies). Null when
// the project has no tabs to default to; a tab id the project lacks is a ToolInputError naming its tabs.

export async function loadTab(
  env: Env,
  token: string,
  projectId: string,
  tabId?: string,
): Promise<{ project: Project; tab: TabRecord } | null> {
  const { project: liveDoc } = await apiJson<ProjectResponse>(
    env,
    token,
    `/projects/${encodeURIComponent(projectId)}`,
  );
  const id = tabId ?? liveDoc.tabs[0]?.id;
  if (!id) return null;
  if (!liveDoc.tabs.some((t) => t.id === id))
    throw new ToolInputError(
      `No tab "${id}" in this plan. Tabs: ${liveDoc.tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
    );
  const { tab } = await apiJson<TabResponse>(
    env,
    token,
    `/projects/${encodeURIComponent(projectId)}/tabs/${encodeURIComponent(id)}`,
  );
  return { project: liveDoc, tab };
}
