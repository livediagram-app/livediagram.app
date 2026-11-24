// Remove Verification When AI Edits (docs/specs/030-knowledgebase/ai-editing.md): under Edit Any Page with the option
// on, an agent's stored rewrite of a page a person verified takes the verification away, as the rule step Clear
// Verification does (document-room/automations/kit-knowledge.ts): `verifiedAt` and `verifiedBy` go, the owner stays,
// and every open editor hears the fields' `tab-meta` patch. Called after the write stood: a busy or gone page is
// logged, never a failure of the write.
import { aiEditUnverifies } from '@liveknowledge/knowledge';
import { routeWho } from '../document-room/automations/knowledge-who';
import type { DocumentRouteContext } from '../routes/context';
import type { DocumentDTO } from '../types';
import { savePageFields } from './page-fields-save';

export async function clearAiEditedVerification(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tabId: string,
): Promise<void> {
  if (!ctx.token || !aiEditUnverifies(document.knowledgeSettings)) return;
  const saved = await savePageFields<'not-verified'>(
    ctx.env,
    document.id,
    tabId,
    async (page) => {
      if (page.fields.verifiedAt === undefined) return { refused: 'not-verified' };
      const { verifiedAt: _at, verifiedBy: _by, ...rest } = page.fields;
      return rest;
    },
    { who: () => routeWho(ctx) },
  );
  if (saved.kind === 'refused') return;
  console.info('[knowledge] ai edit unverified', {
    documentId: document.id,
    tabId,
    outcome: saved.kind,
  });
}
