// The infrastructure import (docs/specs/020-import-export/infrastructure-import.md): `@livediagram/document/infra-code`,
// a subpath of its own so only the CLI and the editor's lazy import load the TOML, YAML and HCL readers, and the
// update's merge.

export { infraGraph } from './graph';
export { PASTE_NAME } from './paste-name';
export { detectInfraFormat } from './detect';
export { infraFileFacts } from './facts';
export { skippedLine } from './summary';
export { drawnRecord, fingerprint, sourceFiles } from './sources';
export { mergeSourceGraph, type SourceMergeCounts } from './merge';
export {
  INFRA_GROUP_FROM,
  INFRA_MAX_FILE_BYTES,
  INFRA_MAX_FILES,
  INFRA_MAX_NODES,
  INFRA_SOURCES_MAX_STORED_CHARS,
} from './limits';
export type {
  InfraError,
  InfraErrorCode,
  InfraFile,
  InfraFormat,
  InfraResult,
  InfraSkipped,
} from './types';
