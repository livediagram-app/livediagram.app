// The infrastructure import's shapes (docs/specs/020-import-export/blueprints/infrastructure-import.md "Domain and
// naming").

import type { GraphEdge } from '../graph-authoring';
import type { GraphInput, GraphInputNode } from '../graph-input';

export type InfraFormat = 'wrangler' | 'compose';

/** A file's base name (absent for a paste) and its text. */
export type InfraFile = { name?: string; text: string };

/** A key the import did not draw, as the summary names it, and how often it appeared. */
export type InfraSkipped = { key: string; count: number };

export type InfraGroup = { id: string; label: string; members: string[] };

/** One file's drawing before the files are merged. */
export type InfraPart = {
  title: string;
  nodes: GraphInputNode[];
  edges: GraphEdge[];
  groups: InfraGroup[];
  skipped: InfraSkipped[];
};

export type InfraErrorCode =
  | 'empty'
  | 'too-large'
  | 'parse'
  | 'not-a-table'
  | 'no-services'
  | 'unknown-env'
  | 'nothing-to-draw'
  | 'too-many-files';

/** Why a file could not be drawn: a code, the sentence a person reads, and the file it was. */
export type InfraError = { code: InfraErrorCode; message: string; file?: string };

export type InfraResult =
  | {
      ok: true;
      graph: GraphInput;
      // Each file's format and the boxes it drew, in the order read (the CLI prints a line each).
      files: { name: string; format: InfraFormat; boxes: number }[];
      skipped: InfraSkipped[];
      // Boxes folded into the "N more" box.
      leftOut: number;
      // Lines past the graph builder's cap, dropped.
      linesLeftOut: number;
    }
  | { ok: false; error: InfraError };
