// @livediagram/agent-verbs: the verbs the CLI and the MCP are front doors to
// (docs/specs/015-api/cli.md "One catalogue for the CLI and the MCP"; blueprint "The verb").
export {
  fetchTeamLibraries,
  listAllDocuments,
  matchDocuments,
  type FoundDocument,
  type TeamLibrary,
} from './find-documents';
export {
  defineVerb,
  type CliProjection,
  type Verb,
  type VerbBehaviour,
  type VerbContext,
} from './define';
export { REF_MIN_PREFIX, shortestUniquePrefixes } from './refs';
export {
  AddressError,
  parseDocumentUrl,
  resolveDocument,
  resolveTab,
  type AddressCandidate,
  type AddressFailure,
  type DocumentUrl,
  type ResolvedDocument,
  type TabSummary,
} from './addressing';
export { RESOURCE_ALIASES, RESOURCES, TOP_LEVEL, VERBS, verbById, verbsOf } from './catalogue';
export { GUIDE_TOPIC_NAMES, GUIDE_TOPICS, isGuideTopic, type GuideTopic } from './guides';
export { renderSkill, SKILL_DESCRIPTION, SKILL_DIRECTORIES, SKILL_NAME } from './skill';
export { LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from './verbs/shared';
