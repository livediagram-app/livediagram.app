// The room's collaboration ledger: this product's pure module (collab-ledger.ts) on the shared store
// (liveworkspace/docs/specs/002-architecture/architecture.md "A room's collaboration ledger";
// docs/specs/012-collaboration/collab-race-hardening.md phase 3).
import { RoomLedgerStore } from '@liveworkspace/api-kit/room-ledger-store';
import {
  ledgerKey,
  ledgerPrefix,
  recordInLedger,
  tabLedgerFrom,
  type TabLedger,
} from '@liveknowledge/document';

type LedgerEntry = NonNullable<Parameters<typeof recordInLedger>[0]>;
const LEDGER_RULES = { ledgerKey, ledgerPrefix, recordInLedger, tabLedgerFrom };

export type DocumentLedger = RoomLedgerStore<LedgerEntry, TabLedger>;

/** The ledger over the room's own storage. */
export const documentLedger = (storage: DurableObjectStorage): DocumentLedger =>
  new RoomLedgerStore(storage, LEDGER_RULES);
