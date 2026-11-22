// What the document's room hands the item engine (blueprint automations.md "The kit";
// liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "The kit"): livediagram's kinds, how a run reads
// the document, and how the shared steps reach its snapshots, tabs, email, connections and AI. Each binding is its
// own module beside this one. Null while the room holds no document (no env, no id), so the engine has nothing to run
// with.
import { AUTOMATIONS_TELEMETRY_CATEGORY, KINDS } from '@livediagram/document/automations';
import {
  aiClient,
  itemHookUrl,
  kitCrossApp,
  kitSends,
  type ItemRoomKit,
} from '@liveworkspace/automations/room';
import { appBaseUrl } from '../../email/client';
import { indexAppClient } from '../../index-service';
import { reportServerEvents } from '../../server-telemetry';
import type { DocumentRoom } from '../document-room';
import { addTemplateTab } from './kit-add-tab';
import { kitMail } from './kit-mail';
import { documentItemOutline, documentTabUrl } from './kit-outline';
import { kitSnapshots } from './kit-snapshots';
import { documentText } from './kit-text';

export function documentKit(room: DocumentRoom): ItemRoomKit | null {
  const env = room.roomEnv;
  const documentId = room.documentId;
  if (!env || !documentId) return null;
  return {
    kinds: KINDS,
    itemId: documentId,
    itemWord: 'canvas',
    category: AUTOMATIONS_TELEMETRY_CATEGORY,
    outline: () => documentItemOutline(env, documentId),
    tabUrl: (tabId) => documentTabUrl(env, documentId, tabId),
    snapshots: kitSnapshots(env, documentId),
    text: (tabId) => documentText(env, documentId, tabId),
    addTab: (template, name) => addTemplateTab(room, env, documentId, template, name),
    mail: kitMail(env, documentId),
    sends: kitSends(indexAppClient(env)),
    // Steps in other apps (liveworkspace automations.md "Steps in other apps"): through the index, as the author.
    crossApp: { client: kitCrossApp(indexAppClient(env)), app: 'livediagram' },
    ai: { client: aiClient(env), ...(env.AI_GATEWAY ? { gateway: env.AI_GATEWAY } : {}) },
    // Add a Tab from a Template is the shared step (`addTab` above); livediagram has no step of its own to run.
    run: {},
    telemetry: (events) => reportServerEvents(env, events),
    hookUrl: (ruleId) => itemHookUrl(appBaseUrl(env), documentId, ruleId),
    putAway: () => room.standing.putAway,
    defer: (promise) => room.state.waitUntil(promise),
  };
}
