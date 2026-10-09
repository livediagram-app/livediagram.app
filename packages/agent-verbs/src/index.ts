// @livediagram/agent-verbs: the verbs the CLI and the MCP are front doors to
// (docs/specs/015-api/cli.md "One catalogue for the CLI and the MCP"; blueprint "The verb").
export {
  fetchTeamLibraries,
  listAllDocuments,
  matchDocuments,
  readLibraries,
  type FoundDocument,
  type Libraries,
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
export {
  HELD_RETRY_INTERVAL_MS,
  submitChangeset,
  WAIT_HELD_MAX_S,
  type WriteFlags,
  type WriteTarget,
} from './write';
export { GUIDE_TOPIC_NAMES, GUIDE_TOPICS, isGuideTopic, type GuideTopic } from './guides';
export { renderSkill, SKILL_DESCRIPTION, SKILL_DIRECTORIES, SKILL_NAME } from './skill';
export {
  documentOf,
  itemsPath,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  tabOf,
  tabPath,
  type DocumentWithTabs,
} from './verbs/shared';
export { graphLint, graphOfSource } from './verbs/graph';
export { tabListOf } from './verbs/tab';
export { EXPORT_FORMATS } from './verbs/local';
export { documentListText, documentRows, type ListedDocument } from './verbs/document';
export { MIRROR_LEVELS, STATUS_ORDER, SYNC_WATCH_TYPE, type StatusRow } from './verbs/link';
export { workbenchNameOf, workbenchOriginOf } from './verbs/workbench';
export {
  addBoard,
  apiRefusalOf,
  changeBoard,
  resolveBoard,
  type ChangeBoardInput,
  type ChangeBoardResult,
  applyItemChanges,
  bringBoardCardTypes,
  changeCardTypes,
  FIELD_HINT,
  NO_BOARD_HINT,
  planListing,
  planPath,
  readPlanState,
  type AddBoardInput,
  type AddBoardResult,
  type CardTypeChangesResult,
  type ItemChange,
  type ItemChangesResult,
  type PlanListing,
  type PlanState,
} from './plan';
