// What the Space's room hands the item engine (blueprint automations.md "The kit";
// liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "The kit"): livehuddle's kinds, how a run reads
// the Space, and how the shared steps and its own reach its snapshots, tabs, Suggestion Boxes, email, connections and
// AI. Each binding is its own module beside this one. Null while the room holds no Space (no env, no id), so the
// engine has nothing to run with.
import { AUTOMATIONS_TELEMETRY_CATEGORY, KINDS } from '@livehuddle/document/automations';
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
import { suggestionRunners } from './kit-suggestions';
import { documentText } from './kit-text';

export function spaceKit(room: DocumentRoom): ItemRoomKit | null {
  const env = room.roomEnv;
  const documentId = room.documentId;
  if (!env || !documentId) return null;
  return {
    kinds: KINDS,
    itemId: documentId,
    itemWord: KINDS.itemWord,
    category: AUTOMATIONS_TELEMETRY_CATEGORY,
    outline: () => documentItemOutline(env, documentId),
    tabUrl: (tabId) => documentTabUrl(env, documentId, tabId),
    snapshots: kitSnapshots(env, documentId),
    text: (tabId) => documentText(env, documentId, tabId),
    addTab: (template, name) => addTemplateTab(room, env, documentId, template, name),
    mail: kitMail(env, documentId),
    sends: kitSends(indexAppClient(env)),
    // Steps in other apps (liveworkspace automations.md "Steps in other apps"): through the index, as the author.
    crossApp: { client: kitCrossApp(indexAppClient(env)), app: 'livehuddle' },
    ai: { client: aiClient(env), ...(env.AI_GATEWAY ? { gateway: env.AI_GATEWAY } : {}) },
    // Clear the Suggestion Box; Add a Tab from a Template is the shared step (`addTab` above).
    run: suggestionRunners(env, documentId),
    telemetry: (events) => reportServerEvents(env, events),
    hookUrl: (ruleId) => itemHookUrl(appBaseUrl(env), documentId, ruleId),
    putAway: () => room.standing.putAway,
    defer: (promise) => room.state.waitUntil(promise),
  };
}
