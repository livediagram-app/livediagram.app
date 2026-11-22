// What the design's room hands the item engine (blueprint automations.md "The kit";
// liveworkspace/docs/specs/018-automations/blueprints/item-engine.md "The kit"): livedesign's kinds, how a run reads
// the design, and how the shared steps reach its snapshots, tabs, email, connections and AI. Each binding is its own
// module beside this one. Null while the room holds no design (no env, no id), so the engine has nothing to run with.
import {
  AUTOMATIONS_TELEMETRY_CATEGORY,
  COMPONENT_REF,
  KINDS,
} from '@livedesign/design/automations';
import {
  aiClient,
  itemHookUrl,
  kitCrossApp,
  kitSends,
  type ItemRoomKit,
} from '@liveworkspace/automations/room';
import { readComponentsById } from '../../db/components';
import { appBaseUrl } from '../../email/client';
import { indexAppClient } from '../../index-service';
import { reportServerEvents } from '../../server-telemetry';
import type { DesignEnv } from '../../types';
import type { DesignRoom } from '../design-room';
import { addTemplateTab } from './kit-add-tab';
import { kitMail } from './kit-mail';
import { designItemOutline, designTabUrl } from './kit-outline';
import { kitSnapshots } from './kit-snapshots';
import { designText } from './kit-text';

// Of `ids`, the main components the library still holds: a Component Changed rule's pick that is gone shows on the
// Rules list. One read, by id.
async function heldComponents(env: DesignEnv, ids: readonly string[]): Promise<Set<string>> {
  return new Set((await readComponentsById(env, ids)).map((main) => main.id));
}

export function designKit(room: DesignRoom): ItemRoomKit | null {
  const env = room.roomEnv;
  const designId = room.designId;
  if (!env || !designId) return null;
  return {
    kinds: KINDS,
    itemId: designId,
    itemWord: 'design',
    category: AUTOMATIONS_TELEMETRY_CATEGORY,
    outline: () => designItemOutline(env, designId),
    tabUrl: (tabId) => designTabUrl(env, designId, tabId),
    snapshots: kitSnapshots(env, designId),
    text: (tabId) => designText(env, designId, tabId),
    addTab: (template, name) => addTemplateTab(room, env, designId, template, name),
    mail: kitMail(env, designId),
    sends: kitSends(indexAppClient(env)),
    // Steps in other apps (liveworkspace automations.md "Steps in other apps"): through the index, as the author.
    crossApp: { client: kitCrossApp(indexAppClient(env)), app: 'livedesign' },
    ai: { client: aiClient(env), ...(env.AI_GATEWAY ? { gateway: env.AI_GATEWAY } : {}) },
    // livedesign has no step of its own: Add a Tab from a Template is the shared step (`addTab` above).
    run: {},
    owns: async (field, ids) =>
      field === COMPONENT_REF.field ? heldComponents(env, ids) : new Set(ids),
    telemetry: (events) => reportServerEvents(env, events),
    hookUrl: (ruleId) => itemHookUrl(appBaseUrl(env), designId, ruleId),
    putAway: () => room.standing.putAway,
    defer: (promise) => room.state.waitUntil(promise),
  };
}
