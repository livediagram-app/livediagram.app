// A rule's step from another app on this Space (docs/specs/013-workspace/automations.md "Steps in other apps";
// liveworkspace blueprint cross-app.md "The door"): Post in a Space, a sticky note on the chosen tab, its text the
// rule's and signed "Automation · <rule>", written as the author through the one changeset write an agent's edit
// takes (changesets/write.ts), so everyone with the Space open sees it land. livehuddle has no chat: a note on a tab
// is the post. The internal door has checked the author's grant; the room runs the step in its chain
// (@liveworkspace/automations/room takeCrossAppStep). The pickers' read is the Space's tabs.
import { createSticky, type Element, type Tab } from '@livehuddle/document';
import type {
  AutomationStepAnswer,
  AutomationStepDoorCall,
  AutomationTargetDescription,
  SpacePostStep,
} from '@liveworkspace/index-client';
import type { AutomationPerson } from '@liveworkspace/automations';
import { SOMEONE, takeCrossAppStep } from '@liveworkspace/automations/room';
import { readStoredTab } from '../../changesets/stored-tab';
import { writeChangeset } from '../../changesets/write';
import { getParticipant } from '../../liveworkspace/profiles';
import type { DocumentEnv } from '../../types';
import { readDocumentOutline } from '../document-content';
import type { DocumentRoom } from '../document-room';
import { documentTabUrl } from './kit-outline';

// The gap a posted note keeps from what the tab already holds.
const POST_GAP = 40;
// The longest rule name a note's signature carries.
const SIGNATURE_RULE_MAX = 60;

const boxed = (
  e: Element,
): e is Element & { x: number; y: number; width: number; height: number } => {
  const b = e as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  return [b.x, b.y, b.width, b.height].every((n) => typeof n === 'number' && Number.isFinite(n));
};

/** Where a new note goes: right of everything on the tab, level with its top; the origin on an empty tab. */
export function postPlace(elements: readonly Element[]): { x: number; y: number } {
  const boxes = elements.filter(boxed);
  if (boxes.length === 0) return { x: 0, y: 0 };
  return {
    x: Math.max(...boxes.map((b) => b.x + b.width)) + POST_GAP,
    y: Math.min(...boxes.map((b) => b.y)),
  };
}

/** The note's words: the rule's text, then its signature. */
export const postLabel = (text: string, rule: string): string =>
  `${text.trim()}\n\nAutomation · ${rule.trim().slice(0, SIGNATURE_RULE_MAX) || 'Untitled'}`;

async function postInSpace(
  env: DocumentEnv,
  documentId: string,
  step: SpacePostStep,
  rule: string,
  author: AutomationPerson,
): Promise<AutomationStepAnswer> {
  const stored = await readStoredTab(env, documentId, step.spaceTab);
  if (!stored) return { ok: false, code: 'target_gone', reason: 'The tab is gone' };
  const note = {
    ...createSticky(0, 0),
    ...postPlace(stored.tab.elements),
    label: postLabel(step.text, rule),
  };
  const next: Tab = { ...stored.tab, elements: [...stored.tab.elements, note] };
  const outcome = await writeChangeset(env, {
    documentId,
    tabId: step.spaceTab,
    stored,
    next,
    orderIndex: stored.orderIndex,
    author,
    tokenId: null,
    summary: `Automation · ${rule}`,
    baseRev: stored.rev,
    rebasedOver: 0,
    prevRev: stored.rev,
    results: [],
    textFor: () => '',
    revertOf: null,
  });
  if (outcome.kind === 'too_large')
    return { ok: false, code: 'failed', reason: 'The tab came out too large to store' };
  if (outcome.kind !== 'written')
    return { ok: false, code: 'failed', reason: 'The tab was busy; the run may be tried again' };
  return {
    ok: true,
    text: `Posted a note in “${step.target.title || 'Untitled'}”`,
    link: documentTabUrl(env, documentId, step.spaceTab),
  };
}

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
    { space_post: (step) => postInSpace(env, documentId, step, call.rule.name, author) },
    author,
  );
}

export async function itemAutomationTarget(
  room: DocumentRoom,
  documentId: string,
): Promise<Pick<AutomationTargetDescription, 'tabs'>> {
  const outline = await readDocumentOutline(room.requireEnv(), documentId);
  return { tabs: outline.tabs.map((t) => ({ id: t.id, name: t.name })) };
}
