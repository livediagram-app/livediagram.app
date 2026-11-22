// A rule's step from another app on this document (docs/specs/013-workspace/automations.md "Steps in other apps";
// liveworkspace blueprint cross-app.md "The door"): Add a Tab to a Document, as the rule's author, through the same
// Add a Tab from a Template this document's own rules use (kit-add-tab.ts). The internal door has checked the
// author's grant; the room runs the step in its chain (@liveworkspace/automations/room takeCrossAppStep). The
// pickers' read is the templates a tab can start from.
import { automationTabTemplates } from '@livediagram/templates';
import type {
  AutomationStepAnswer,
  AutomationStepDoorCall,
  AutomationTargetDescription,
} from '@liveworkspace/index-client';
import { SOMEONE, takeCrossAppStep, takeDocTab } from '@liveworkspace/automations/room';
import { getParticipant } from '../../liveworkspace/profiles';
import type { DocumentRoom } from '../document-room';
import { addTemplateTab } from './kit-add-tab';
import { documentTabUrl } from './kit-outline';

export async function itemAutomationStep(
  room: DocumentRoom,
  documentId: string,
  call: AutomationStepDoorCall,
): Promise<AutomationStepAnswer> {
  room.bindDocument(documentId);
  if (!room.hasSchema()) return { ok: false, code: 'no_access', reason: '' };
  const env = room.requireEnv();
  const person = await getParticipant(env, call.author).catch(() => null);
  const author = {
    id: call.author,
    name: person?.name || SOMEONE.name,
    color: person?.color || SOMEONE.color,
  };
  return takeCrossAppStep(
    env,
    call,
    {
      doc_tab: (step) =>
        takeDocTab(
          step,
          (template, name) => addTemplateTab(room, env, documentId, template, name),
          (tabId) => documentTabUrl(env, documentId, tabId),
        ),
    },
    author,
  );
}

export const itemAutomationTarget = async (
  _room: DocumentRoom,
  _documentId: string,
): Promise<Pick<AutomationTargetDescription, 'templates'>> => ({
  templates: [...automationTabTemplates()],
});
