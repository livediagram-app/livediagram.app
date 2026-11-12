// The form verbs' calls (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Engine flow"), shared by the MCP's
// read_form, add_form, change_form and share_form and the CLI's form commands. Each reads the project's plan once
// (its tabs, boards and sheets named without their bodies) and the Form tab's own body, builds the whole change on a
// draft, and writes only once every change has been checked: card types first, then the form (a new Form tab by a
// changeset, an existing form through its route), then the tabs its responses go to.
import type { ApiClient } from '@liveworkspace/api-client';
import { CLIENT_HEADER, type FormLinkResponse } from '@liveplanner/api-schema';
import type { Tab } from '@liveplanner/project';
import {
  FORM_VERSION,
  STARTER_IDS,
  UNTITLED_FORM,
  buildStarter,
  changesBeyondSettings,
  formStarter,
  newFormPartId,
  readForm as readStoredForm,
  starterBaseType,
  type FormDefinition,
  type StarterId,
} from '@liveplanner/forms';
import { ITEM_TYPE_CATALOGUE_VERSION, newItemTypeId } from '@liveplanner/items';
import { apiRefusalOf } from '../plan/api-refusal';
import { CARD_TYPES_SAVE_ATTEMPTS } from '../plan/plan-state';
import { tabPath } from '../verbs/shared';
import {
  addQuestionTo,
  applyFormChanges,
  type FormChange,
  type SectionRuleInput,
} from './form-changes';
import { draftOf, setRespondsTo, type FormDraft, type RespondsToInput } from './form-draft';
import { refuse, resolveFormTab, type FormRefusal } from './form-names';
import type { QuestionInput } from './form-question';
import { readFormOf, type FormReading } from './form-read';
import {
  formLinkPath,
  readFormLink,
  readFormTabBody,
  readFormWorld,
  type FormWorld,
} from './form-world';
import { postChangeset, saveTypes, writeAround } from './form-write';

export type Client = 'mcp' | 'cli';
export type FormDone = {
  ok: true;
  projectId: string;
  reading: FormReading;
  lines: string[];
  made: string[];
};
export type FormCallResult = FormDone | FormRefusal;

export const FORM_CHANGES_MAX = 50;

const newId = (prefix: 'q' | 's') => newFormPartId(prefix);
const tabNamesOf = (world: FormWorld) => new Map(world.tabs.map((t) => [t.id, t.name]));

// An api refusal as a form refusal, in the words agents read; anything else throws.
export async function guarded<T>(run: () => Promise<T | FormRefusal>): Promise<T | FormRefusal> {
  try {
    return await run();
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { ok: false, ...refusal };
  }
}

// --- Reading ----------------------------------------------------------------------------------------------------

// The plan, the Form tab named (its body: the one tab read), its link, and the form as read_form answers it.
export async function readingOf(api: ApiClient, projectId: string, tabRef: string | undefined) {
  const world = await readFormWorld(api, projectId);
  const found = resolveFormTab(world.tabs, tabRef);
  if (!found.ok) return found;
  const [tab, link] = await Promise.all([
    readFormTabBody(api, projectId, found.tab.id),
    readFormLink(api, projectId, found.tab.id),
  ]);
  const form = readStoredForm(tab.form);
  if (!form) return refuse('not_a_form_tab', `"${tab.name}" holds no form yet.`);
  const reading = readFormOf({
    tabId: tab.id,
    form,
    boards: world.boards,
    sheets: world.sheets,
    tabNames: tabNamesOf(world),
    types: world.types,
    link,
  });
  return { ok: true as const, world, tab, form, link, reading };
}

export async function readForm(
  api: ApiClient,
  projectId: string,
  tabRef?: string,
): Promise<FormCallResult> {
  return guarded(async () => {
    const read = await readingOf(api, projectId, tabRef);
    if (!read.ok) return read;
    return { ok: true, projectId, reading: read.reading, lines: [], made: [] };
  });
}

// The answer after a write, from what was written: the draft's form among the boards and sheets it leaves, and the
// link as it stands (a new form has none). No second read of the project.
function doneFrom(
  d: FormDraft,
  tabId: string,
  link: FormLinkResponse | null,
  made: string[],
): FormDone {
  const reading = readFormOf({
    tabId,
    form: d.form,
    boards: d.boards,
    sheets: d.sheets,
    tabNames: tabNamesOf(d.world),
    types: d.types,
    link,
  });
  return { ok: true, projectId: d.world.projectId, reading, lines: d.lines, made };
}

// --- add_form ---------------------------------------------------------------------------------------------------

interface AddFormInput {
  projectId?: string;
  name?: string;
  theme?: string;
  starter?: StarterId;
  description?: string;
  questions?: QuestionInput[];
  sections?: {
    title?: string;
    description?: string;
    showIf?: SectionRuleInput;
    questions: QuestionInput[];
  }[];
  respondsTo?: RespondsToInput;
  settings?: Omit<Extract<FormChange, { op: 'settings' }>, 'op'>;
}

function startFromStarter(
  world: FormWorld,
  input: AddFormInput,
  formTab: Pick<Tab, 'id' | 'name' | 'theme'>,
): FormDraft | FormRefusal {
  if (!(STARTER_IDS as readonly string[]).includes(input.starter!))
    return refuse(
      'starter_unknown',
      `No starter "${input.starter}". Starters: ${STARTER_IDS.filter((s) => s !== 'blank').join(', ')}.`,
    );
  if (input.questions || input.sections)
    return refuse(
      'starter_and_questions',
      'Give a starter or questions, not both: change a started form with change_form.',
    );
  const starter = formStarter(input.starter!);
  const base = starterBaseType(starter, world.types, newItemTypeId(starter.name, world.types));
  const built = buildStarter(starter, base, newId);
  const form: FormDefinition = { ...built.form, ...(input.name ? { heading: input.name } : {}) };
  const d = draftOf(world, { ...formTab, name: form.heading }, form, newId);
  const r = input.respondsTo ?? (starter.respondsTo ? { to: starter.respondsTo } : undefined);
  if (r) {
    // A starter's ready-made type: the project's own copy is untouched unless the starter gave it fields.
    const own = world.types.find((t) => t.id === built.type.id);
    if (r.to === 'board' && !r.cardType && own !== built.type) {
      d.types = own
        ? d.types.map((t) => (t.id === built.type.id ? built.type : t))
        : [...d.types, built.type];
      d.typesChanged = true;
    }
    const refused = setRespondsTo(d, r, r.to === 'board' && !r.cardType ? built.type : undefined);
    if (refused) return refused;
  }
  d.lines.unshift(`started from ${starter.name}`);
  return d;
}

function startFromQuestions(
  world: FormWorld,
  input: AddFormInput,
  formTab: Pick<Tab, 'id' | 'name' | 'theme'>,
): FormDraft | FormRefusal {
  const form: FormDefinition = {
    v: FORM_VERSION,
    heading: input.name?.trim() || UNTITLED_FORM,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    sections: [{ id: newId('s'), title: '', questions: [] }],
  };
  const d = draftOf(world, { ...formTab, name: form.heading }, form, newId);
  const asked = input.questions?.length || input.sections?.some((s) => s.questions.length);
  const r = input.respondsTo ?? (asked ? { to: 'board' as const } : undefined);
  if (r) {
    const refused = setRespondsTo(d, r);
    if (refused) return refused;
  }
  for (const q of input.questions ?? []) {
    const refused = addQuestionTo(d, q, {});
    if (refused) return refused;
  }
  for (const [i, s] of (input.sections ?? []).entries()) {
    // The first section given is the form's first when no questions came before it.
    const first = i === 0 && !input.questions?.length;
    // The first page's title and description are the form's heading and description.
    if (first && s.description?.trim()) {
      if (!d.form.description) d.form = { ...d.form, description: s.description.trim() };
      else if (s.description.trim() !== d.form.description)
        d.lines.push(`the first page shows the form's description, not its own description`);
    }
    if (first && s.title?.trim() && s.title.trim() !== d.form.heading)
      d.lines.push(
        `the first page shows the form's heading ("${d.form.heading}"), not its own title "${s.title.trim()}"`,
      );
    if (!first) {
      const refused = applyFormChanges(d, [
        {
          op: 'add_section',
          ...(s.title ? { title: s.title } : {}),
          ...(s.description ? { description: s.description } : {}),
        },
      ]);
      if (refused) return refused;
    }
    const section = d.form.sections.length;
    for (const q of s.questions) {
      const refused = addQuestionTo(d, q, { section });
      if (refused) return refused;
    }
    if (s.showIf && !first) {
      const refused = applyFormChanges(d, [{ op: 'set_section', section, showIf: s.showIf }]);
      if (refused) return refused;
    }
  }
  return d;
}

const NO_PROJECT: Omit<FormWorld, 'projectId'> = {
  tabs: [],
  boards: [],
  sheets: [],
  types: [],
  statuses: [],
  itemTypesRev: 0,
};

export async function addForm(
  api: ApiClient,
  input: AddFormInput,
  client: Client,
): Promise<FormCallResult> {
  return guarded(async () => {
    for (let attempt = 1; ; attempt += 1) {
      const world: FormWorld = input.projectId
        ? await readFormWorld(api, input.projectId)
        : { projectId: crypto.randomUUID(), ...NO_PROJECT };
      const tabId = crypto.randomUUID();
      const theme = input.theme ?? world.tabs[0]?.theme;
      const formTab = { id: tabId, name: input.name ?? '', ...(theme ? { theme } : {}) };
      const d = input.starter
        ? startFromStarter(world, input, formTab)
        : startFromQuestions(world, input, formTab);
      if ('ok' in d) return d;
      if (input.settings) {
        const refused = applyFormChanges(d, [{ op: 'settings', ...input.settings }]);
        if (refused) return refused;
      }
      const tabTheme = d.formTab.theme ?? theme;
      const tab: Tab = {
        id: tabId,
        name: d.form.heading,
        elements: [],
        defaultTextSize: 'sm',
        kind: 'form',
        form: d.form,
        ...(tabTheme ? { theme: tabTheme } : {}),
      };
      const projectId = world.projectId;
      if (!input.projectId) {
        // A project of its own: made whole in one request, the Form tab first and its responses after.
        await api.json('/projects', {
          method: 'POST',
          body: JSON.stringify({
            id: projectId,
            name: d.form.heading,
            tabs: [tab, ...d.newTabs],
            source: client,
            ...(d.typesChanged
              ? { itemTypes: { version: ITEM_TYPE_CATALOGUE_VERSION, types: d.types } }
              : {}),
          }),
        });
        const made = [
          `plan "${d.form.heading}" (${projectId})`,
          ...(await writeAround(api, d, client, true)),
        ];
        return doneFrom(d, tabId, null, made);
      }
      if ((await saveTypes(api, d)) === 'stale' && attempt < CARD_TYPES_SAVE_ATTEMPTS) continue;
      await postChangeset(
        api,
        projectId,
        tabId,
        {
          replace: {
            form: d.form as unknown as Record<string, unknown>,
            name: d.form.heading,
            ...(tabTheme ? { theme: tabTheme } : {}),
          },
          summary: `Add the ${d.form.heading} form`,
        },
        client,
      );
      const made = [
        `Form tab "${d.form.heading}" (${tabId})`,
        ...(await writeAround(api, d, client, false)),
      ];
      return doneFrom(d, tabId, null, made);
    }
  });
}

// --- change_form ------------------------------------------------------------------------------------------------

export async function changeForm(
  api: ApiClient,
  projectId: string,
  tabRef: string | undefined,
  changes: readonly FormChange[],
  client: Client,
): Promise<FormCallResult> {
  // No change is a read: nothing is written.
  if (changes.length === 0) return readForm(api, projectId, tabRef);
  if (changes.length > FORM_CHANGES_MAX)
    return refuse('too_many_changes', `At most ${FORM_CHANGES_MAX} changes a call.`);
  return guarded(async () => {
    for (let attempt = 1; ; attempt += 1) {
      const read = await readingOf(api, projectId, tabRef);
      if (!read.ok) return read;
      const d = draftOf(read.world, read.tab, read.form, newId);
      const refused = applyFormChanges(d, changes);
      if (refused) return refused;
      // A form taking responses keeps everything but its settings (its route refuses the rest too).
      if (read.reading.state === 'accepting' && changesBeyondSettings(read.form, d.form))
        return refuse(
          'form_locked',
          'This form is taking responses, so only its settings can change. Close it with share_form (action "close") first: its link stays, and publish opens it again.',
        );
      if ((await saveTypes(api, d)) === 'stale' && attempt < CARD_TYPES_SAVE_ATTEMPTS) continue;
      await api.json(`${tabPath(projectId, read.tab.id)}/form`, {
        method: 'POST',
        headers: { [CLIENT_HEADER]: client },
        body: JSON.stringify({
          form: d.form,
          rev: read.tab.rev,
          ...(d.themeChanged && d.formTab.theme ? { theme: d.formTab.theme } : {}),
        }),
      });
      const made = await writeAround(api, d, client, false, read.form);
      return doneFrom(d, read.tab.id, read.link, made);
    }
  });
}

// --- share_form -------------------------------------------------------------------------------------------------

type ShareAction = 'publish' | 'close' | 'delete_link';

// What a publish says when the form's own Settings keep it closed, whatever its switch: its link is on, but takes no
// responses until the setting changes.
export const SETTINGS_KEEP_CLOSED: Record<'closes_at' | 'limit', string> = {
  closes_at:
    'still closed: its Close On has passed. Set a later closesAt (or null) with change_form settings to open it',
  limit:
    'still closed: it has reached its Response Limit. Raise limit (or set null) with change_form settings to open it',
};

export async function shareForm(
  api: ApiClient,
  projectId: string,
  tabRef: string | undefined,
  action: ShareAction,
): Promise<FormCallResult> {
  if (!['publish', 'close', 'delete_link'].includes(action))
    return refuse('action_unknown', 'action is publish, close or delete_link.');
  return guarded(async () => {
    const read = await readingOf(api, projectId, tabRef);
    if (!read.ok) return read;
    const path = formLinkPath(projectId, read.tab.id);
    const live = read.link?.link ?? null;
    const lines: string[] = [];
    if (action === 'publish') {
      if (read.reading.problems.length)
        return refuse(
          'form_not_ready',
          `Not ready to publish. Fix these with change_form: ${read.reading.problems.join(' ')}`,
        );
      if (!live) {
        await api.json<FormLinkResponse>(path, { method: 'POST' });
        lines.push('published: the form link takes responses');
      } else if (!live.open) {
        await api.json<FormLinkResponse>(path, {
          method: 'PUT',
          body: JSON.stringify({ open: true }),
        });
        lines.push('opened again: the same link takes responses');
      } else lines.push('already taking responses');
    } else if (action === 'close') {
      if (!live)
        return refuse('form_not_published', 'This form has no link yet: publish it first.');
      await api.json<FormLinkResponse>(path, {
        method: 'PUT',
        body: JSON.stringify({ open: false }),
      });
      lines.push('closed: its link stays, and shows the closed message');
    } else {
      if (!live) return refuse('form_not_published', 'This form has no link to delete.');
      await api.json<FormLinkResponse>(path, { method: 'DELETE' });
      lines.push('link deleted: publishing again makes a new one');
    }
    const link = await readFormLink(api, projectId, read.tab.id);
    const reading = readFormOf({
      tabId: read.tab.id,
      form: read.form,
      boards: read.world.boards,
      sheets: read.world.sheets,
      tabNames: tabNamesOf(read.world),
      types: read.world.types,
      link,
    });
    const kept = reading.closedReason;
    if (action === 'publish' && (kept === 'closes_at' || kept === 'limit'))
      lines.splice(0, lines.length, SETTINGS_KEEP_CLOSED[kept]);
    return { ok: true, projectId, reading, lines, made: [] };
  });
}
