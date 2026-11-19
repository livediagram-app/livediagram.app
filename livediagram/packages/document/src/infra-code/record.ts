// The subpath `@livediagram/document/infra-sources` (blueprint infrastructure-import.md "Performance and limits"):
// what the api's `replace` needs to write a sources record, without the YAML, TOML and HCL readers `infra-code`
// carries. Nothing imported from here may reach a parser; record.test.ts walks the imports to keep it so.

export { drawnRecord } from './sources';
export { INFRA_SOURCES_MAX_STORED_CHARS } from './limits';
