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
  VerbRefusal,
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
  type AddressLog,
  type AddressFailure,
  type DocumentUrl,
  type ResolvedDocument,
  type TabSummary,
} from './addressing';
export {
  COMMAND_ALIASES,
  countedVerbs,
  RESOURCE_ALIASES,
  RESOURCES,
  TOP_LEVEL,
  VERBS,
  verbById,
  verbsOf,
} from './catalogue';
export { argvToOperationLine } from './argv-line';
export { baseFromCopy, readPlainTab, recordCopy, type ReadCopies, type ReadCopy } from './copies';
export { classifySource, type ClassifiedSource, type SourceKind } from './source-kind';
export { HELD_RETRY_INTERVAL_MS, submitChangeset, WAIT_HELD_MAX_S, type WriteFlags } from './write';
export { GUIDE_TOPIC_NAMES, GUIDE_TOPICS, isGuideTopic, type GuideTopic } from './guides';
export { renderSkill, SKILL_DESCRIPTION, SKILL_DIRECTORIES, SKILL_NAME } from './skill';
export {
  documentOf,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  tabPath,
  type DocumentWithTabs,
} from './verbs/shared';
export { graphLint, graphOfSource } from './verbs/graph';
