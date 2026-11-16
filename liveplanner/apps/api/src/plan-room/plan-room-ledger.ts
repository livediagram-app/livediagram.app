// The room's collaboration ledger (plan-room.ts): this product's pure module (collab-ledger.ts) on the shared store
// (liveworkspace/docs/specs/002-architecture/architecture.md "A room's collaboration ledger").
import {
  ledgerKey,
  ledgerPrefix,
  recordInLedger,
  tabLedgerFrom,
  ledgerEntryAccumulates,
} from '@liveplanner/project';
export type { TabLedger } from '@liveplanner/project';

export type LedgerEntry = NonNullable<Parameters<typeof recordInLedger>[0]>;
export const LEDGER_RULES = {
  ledgerKey,
  ledgerPrefix,
  recordInLedger,
  tabLedgerFrom,
  ledgerEntryAccumulates,
};
