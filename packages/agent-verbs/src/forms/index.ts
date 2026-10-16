// Agents' form verbs (docs/specs/030-forms/forms.md "Agents"), shared by the MCP tools and the CLI.
export {
  FORM_CHANGES_MAX,
  addForm,
  changeForm,
  readForm,
  shareForm,
  type AddFormInput,
  type FormCallResult,
  type FormDone,
  type ShareAction,
} from './form-calls';
export type { FormChange, SectionRuleInput } from './form-changes';
export type { RespondsToInput } from './form-draft';
export type { QuestionInput, QuestionSet } from './form-question';
export type { FormReading, FormState } from './form-read';
