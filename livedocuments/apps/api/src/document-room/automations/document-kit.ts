// What the document's room hands the item engine (blueprint automations.md "The kit";
// liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "The kit"): livedocuments' kinds, how a run reads
// the document, and how the shared steps and its own reach its snapshots, tabs, versions, email, connections and AI.
// Each binding is its own module beside this one. Null while the room holds no document (no env, no id), so the
// engine has nothing to run with.
import {
  AUTOMATIONS_TELEMETRY_CATEGORY,
  KINDS,
  VERSION_REF,
} from '@livedocuments/document/automations';
import { aiClient, itemHookUrl, kitSends, type ItemRoomKit } from '@liveworkspace/automations/room';
import { appBaseUrl } from '../../email/client';
import { indexAppClient } from '../../index-service';
import { reportServerEvents } from '../../server-telemetry';
import type { DocumentRoom } from '../document-room';
import { addTemplateTab } from './kit-add-tab';
import { kitMail } from './kit-mail';
import { documentItemOutline, documentTabUrl } from './kit-outline';
import { kitSnapshots } from './kit-snapshots';
import { documentText } from './kit-text';
import { namedVersionsOf, versionRunners } from './kit-versions';

export function documentKit(room: DocumentRoom): ItemRoomKit | null {
  const env = room.roomEnv;
  const documentId = room.documentId;
  if (!env || !documentId) return null;
  return {
    kinds: KINDS,
    itemId: documentId,
    itemWord: 'document',
    category: AUTOMATIONS_TELEMETRY_CATEGORY,
    outline: () => documentItemOutline(env, documentId),
    tabUrl: (tabId) => documentTabUrl(env, documentId, tabId),
    snapshots: kitSnapshots(env, documentId),
    text: (tabId) => documentText(env, documentId, tabId),
    addTab: (template, name) => addTemplateTab(room, env, documentId, template, name),
    mail: kitMail(env, documentId),
    sends: kitSends(indexAppClient(env)),
    ai: { client: aiClient(env), ...(env.AI_GATEWAY ? { gateway: env.AI_GATEWAY } : {}) },
    // Name This Version and Restore a Version; Add a Tab from a Template is the shared step (`addTab` above).
    run: versionRunners(env, documentId),
    owns: async (field, ids) =>
      field === VERSION_REF.field ? namedVersionsOf(env, ids) : new Set(ids),
    telemetry: (events) => reportServerEvents(env, events),
    hookUrl: (ruleId) => itemHookUrl(appBaseUrl(env), documentId, ruleId),
    putAway: () => room.standing.putAway,
    defer: (promise) => room.state.waitUntil(promise),
  };
}
