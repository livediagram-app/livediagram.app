// The starters Start Planning offers (docs/specs/030-forms/forms.md "Starting a form", blueprint §7): a form, the
// card type its responses suit, and the fields its questions map to.
import {
  READY_MADE_CARD_TYPES,
  newCustomFieldId,
  type CustomFieldDef,
  type CustomFieldKind,
  type ItemTypeDef,
} from '@livediagram/items';
import { FORM_VERSION, type FormDefinition, type FormQuestion, type StarterId } from './model';

// A field a starter's question maps to: matched on the card type by name and kind, else added.
export interface StarterField {
  label: string;
  kind: CustomFieldKind;
  options?: readonly string[];
}

type StarterQuestion = Omit<FormQuestion, 'id' | 'goesTo'> & {
  to?: 'title' | 'description' | StarterField;
};

export interface FormStarter {
  id: StarterId;
  name: string;
  line: string;
  // The telemetry type (a preset value).
  telemetry: string;
  // The ready-made card type its responses suit; absent makes a type named after the form.
  readyType?: 'bug' | 'idea' | 'candidate' | 'request';
  accent: string;
  description?: string;
  sections: { title: string; questions: StarterQuestion[] }[];
}

const SEVERITY = ['Low', 'Medium', 'High', 'Critical'];

export const FORM_STARTERS: readonly FormStarter[] = [
  {
    id: 'blank',
    name: 'Blank Form',
    line: 'Start from one question',
    telemetry: 'Blank',
    accent: '#2563eb',
    sections: [{ title: '', questions: [{ type: 'short', prompt: '' }] }],
  },
  {
    id: 'bug-report',
    name: 'Bug Report',
    line: 'Reports land on your triage board',
    telemetry: 'BugReport',
    readyType: 'bug',
    accent: '#dc2626',
    description: 'Tell us what went wrong and we’ll look into it.',
    sections: [
      {
        title: '',
        questions: [
          { type: 'short', prompt: 'Summary', required: true, to: 'title' },
          {
            type: 'paragraph',
            prompt: 'What happened?',
            help: 'What did you expect, and what happened instead?',
            required: true,
            to: 'description',
          },
          {
            type: 'single',
            prompt: 'Severity',
            options: SEVERITY,
            to: { label: 'Severity', kind: 'choice', options: SEVERITY },
          },
          {
            type: 'email',
            prompt: 'Email',
            help: 'So we can follow up.',
            to: { label: 'Email', kind: 'email' },
          },
        ],
      },
    ],
  },
  {
    id: 'feedback',
    name: 'Feedback',
    line: 'Ratings and comments, ready to sort',
    telemetry: 'Feedback',
    accent: '#0d9488',
    description: 'We read every response.',
    sections: [
      {
        title: '',
        questions: [
          {
            type: 'rating',
            prompt: 'How would you rate us?',
            required: true,
            scale: 5,
            style: 'stars',
            to: { label: 'Rating', kind: 'rating' },
          },
          { type: 'paragraph', prompt: 'What did you like?' },
          { type: 'paragraph', prompt: 'What could be better?' },
          { type: 'email', prompt: 'Email', to: { label: 'Email', kind: 'email' } },
        ],
      },
    ],
  },
  {
    id: 'feature-request',
    name: 'Feature Request',
    line: 'Ideas from anyone, voted on by your team',
    telemetry: 'FeatureRequest',
    readyType: 'idea',
    accent: '#ca8a04',
    sections: [
      {
        title: '',
        questions: [
          { type: 'short', prompt: 'Idea', required: true, to: 'title' },
          { type: 'paragraph', prompt: 'Why do you need it?', to: 'description' },
          {
            type: 'rating',
            prompt: 'How important is it?',
            scale: 5,
            style: 'numbers',
            lowLabel: 'Nice to have',
            highLabel: 'Essential',
            to: { label: 'Importance', kind: 'rating' },
          },
        ],
      },
    ],
  },
  {
    id: 'rsvp',
    name: 'Event RSVP',
    line: 'Who is coming, and what they need',
    telemetry: 'Rsvp',
    accent: '#7c3aed',
    sections: [
      {
        title: '',
        questions: [
          { type: 'short', prompt: 'Name', required: true, to: 'title' },
          { type: 'email', prompt: 'Email', required: true, to: { label: 'Email', kind: 'email' } },
          {
            type: 'single',
            prompt: 'Attending?',
            required: true,
            options: ['Yes', 'No', 'Maybe'],
            to: { label: 'Attending', kind: 'choice', options: ['Yes', 'No', 'Maybe'] },
          },
          {
            type: 'multi',
            prompt: 'Dietary needs',
            options: ['Vegetarian', 'Vegan', 'Gluten free', 'Nut allergy'],
            to: {
              label: 'Dietary Needs',
              kind: 'multichoice',
              options: ['Vegetarian', 'Vegan', 'Gluten free', 'Nut allergy'],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'job-application',
    name: 'Job Application',
    line: 'Candidates straight into your pipeline',
    telemetry: 'JobApplication',
    readyType: 'candidate',
    accent: '#db2777',
    sections: [
      {
        title: 'About You',
        questions: [
          { type: 'short', prompt: 'Full name', required: true, to: 'title' },
          { type: 'email', prompt: 'Email', required: true, to: { label: 'Email', kind: 'email' } },
          {
            type: 'link',
            prompt: 'Portfolio or LinkedIn',
            placeholder: 'https://',
            to: { label: 'Profile', kind: 'link' },
          },
        ],
      },
      {
        title: 'Experience',
        questions: [
          {
            type: 'number',
            prompt: 'Years of experience',
            min: 0,
            max: 60,
            whole: true,
            to: { label: 'Years of Experience', kind: 'number' },
          },
          {
            type: 'paragraph',
            prompt: 'Why do you want to join us?',
            required: true,
            to: 'description',
          },
        ],
      },
    ],
  },
  {
    id: 'contact',
    name: 'Contact',
    line: 'Messages you can assign and close',
    telemetry: 'Contact',
    readyType: 'request',
    accent: '#ea580c',
    sections: [
      {
        title: '',
        questions: [
          {
            type: 'short',
            prompt: 'Name',
            required: true,
            to: { label: 'Requested By', kind: 'text' },
          },
          { type: 'email', prompt: 'Email', required: true, to: { label: 'Email', kind: 'email' } },
          { type: 'short', prompt: 'Subject', required: true, to: 'title' },
          { type: 'paragraph', prompt: 'Message', required: true, to: 'description' },
        ],
      },
    ],
  },
];

export function formStarter(id: StarterId): FormStarter {
  return FORM_STARTERS.find((s) => s.id === id) ?? FORM_STARTERS[0]!;
}

export const STARTER_FORM_COLOUR = '#2563eb';
// The glyph a card type made for a form takes.
export const FORM_TYPE_GLYPH = 'checklist';

// The card type a starter's responses are made as: the ready-made one (the document's own copy when it has it),
// else a new type named after the form. Its id is the caller's (unique in the catalogue).
export function starterBaseType(
  starter: FormStarter,
  catalogue: readonly ItemTypeDef[],
  newTypeId: string,
): ItemTypeDef {
  if (starter.readyType) {
    const own = catalogue.find((t) => t.id === starter.readyType);
    const ready = own ?? READY_MADE_CARD_TYPES.find((t) => t.id === starter.readyType);
    if (ready) return ready;
  }
  return {
    id: newTypeId,
    label: starter.id === 'blank' ? 'Response' : starter.name,
    newTitle: `New ${(starter.id === 'blank' ? 'response' : starter.name).toLowerCase()}`,
    glyph: FORM_TYPE_GLYPH,
    color: starter.accent,
    fields: ['title', 'description', 'status', 'assignee', 'labels'],
  };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// `type` with every field the starter maps to (a field of that name and kind reused, never doubled), and the form,
// its questions pointing at those fields. Ids come from `newId` (question and section ids).
export function buildStarter(
  starter: FormStarter,
  type: ItemTypeDef,
  newId: () => string,
): { form: FormDefinition; type: ItemTypeDef } {
  const custom: CustomFieldDef[] = [...(type.custom ?? [])];
  const fields = [...type.fields];
  const fieldFor = (want: StarterField): string => {
    const found = custom.find((f) => sameName(f.label, want.label) && f.kind === want.kind);
    if (found) {
      if (!fields.includes(found.id)) fields.push(found.id);
      // A choice field gains any option the question offers that it lacks, so the answer always fits.
      // (Only a choice field's starter field names options, and the kinds matched.)
      if (want.options) {
        const has = found.options ?? [];
        const missing = want.options.filter((o) => !has.some((f) => sameName(f, o)));
        if (missing.length)
          custom[custom.indexOf(found)] = { ...found, options: [...has, ...missing] };
      }
      return found.id;
    }
    const id = newCustomFieldId(want.label, [...fields, ...custom.map((f) => f.id)]);
    const field: CustomFieldDef = { id, label: want.label, kind: want.kind };
    if (want.options) Object.assign(field, { options: [...want.options] });
    custom.push(field);
    fields.push(id);
    return id;
  };
  const sections = starter.sections.map((s) => ({
    id: newId(),
    title: s.title,
    questions: s.questions.map(({ to, ...q }): FormQuestion => {
      const question: FormQuestion = { ...q, id: newId() };
      if (q.options) question.options = [...q.options];
      if (to === 'title') question.goesTo = { to: 'title' };
      else if (to && to !== 'description') question.goesTo = { to: 'field', fieldId: fieldFor(to) };
      return question;
    }),
  }));
  const form: FormDefinition = {
    v: FORM_VERSION,
    heading: starter.id === 'blank' ? 'Untitled Form' : starter.name,
    accent: starter.accent,
    sections,
    starter: starter.id,
  };
  if (starter.description) form.description = starter.description;
  const changed =
    custom.length !== (type.custom ?? []).length || fields.length !== type.fields.length;
  const optionsChanged = custom.some((f, i) => f !== type.custom?.[i]);
  return {
    form,
    type: changed || optionsChanged ? { ...type, fields, custom } : type,
  };
}
