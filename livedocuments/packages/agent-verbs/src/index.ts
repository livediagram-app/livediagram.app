// @livedocuments/agent-verbs: the verbs the CLI and the MCP are front doors to
// (docs/specs/015-api/cli.md "One catalogue for the CLI and the MCP"; blueprint "The verb").
export {
  fetchTeamLibraries,
  listAllDocuments,
  matchDocuments,
  readLibraries,
  type FoundDocument,
  type Libraries,
} from './find-documents';
export {
  defineVerb,
  VerbRefusal,
  type CliProjection,
  type Verb,
  type VerbBehaviour,
  type VerbContext,
} from './define';
export { REF_MIN_PREFIX, shortestUniquePrefixes } from '@liveworkspace/agent-verbs/refs';
export {
  folderChoices,
  folderLines,
  matchFolders,
  resolveFolderRef,
  type FolderChoice,
} from './folders';
export {
  AddressError,
  parseDocumentUrl,
  resolveDocument,
  resolveTab,
  type AddressCandidate,
  type AddressFailure,
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
export { argvToOperationLine } from '@liveworkspace/agent-verbs/argv-line';
export { baseFromCopy, readPlainTab, recordCopy, type ReadCopies, type ReadCopy } from './copies';
export { classifySource } from './source-kind';
export { HELD_RETRY_INTERVAL_MS, submitChangeset, type WriteFlags } from './write';
export { GUIDE_TOPIC_NAMES, GUIDE_TOPICS, isGuideTopic } from './guides';
export { renderSkill, SKILL_DESCRIPTION, SKILL_DIRECTORIES, SKILL_NAME } from './skill';
export { documentOf, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT, tabOf, tabPath } from './verbs/shared';
export { tabListOf } from './verbs/tab';
export { EXPORT_FORMATS } from './verbs/local';
export { workbenchNameOf, workbenchOriginOf } from './verbs/workbench';
export { apiRefusalOf, deleteRefusal } from './api-refusal';
export * from './pages';
export * from './images';
