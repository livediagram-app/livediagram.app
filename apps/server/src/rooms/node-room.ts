import { DocumentRoom, type RoomSocket, type Runtime } from '@livediagram/api';
import type { SqliteDb } from '../runtime/sqlite-db';
import { createRoomState, type NodeRoomState } from './room-state';

/** Read the worker-verified claims off an upgrade request. */
function claimsOf(request: Request): UpgradeClaims {
  const role = request.headers.get('X-Verified-Role');
  return {
    verifiedRole: role === 'edit' || role === 'view' ? role : undefined,
    isOwner: request.headers.get('X-Verified-Owner') === '1',
    tabScope: request.headers.get('X-Verified-Tab-Scope'),
    shareCode: request.headers.get('X-Verified-Share-Code'),
    account: request.headers.get('X-Verified-Account') === '1',
    personTag: request.headers.get('X-Verified-Person'),
    networkTag: request.headers.get('X-Verified-Network'),
    workbenchPairing: request.headers.get('X-Verified-Workbench-Pairing'),
  };
}

// One document's room, in this process
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime: the
// rooms").
//
// The room itself is the api worker's own \`DocumentRoom\` — the same class
// Cloudflare instantiates per Durable Object. What differs is the shell: storage
// in a table instead of DO storage, sockets from a \`ws\` server instead of
// \`WebSocketPair\`, timers instead of alarms, and an idle room that leaves memory
// instead of hibernating.

/**
 * What the api's ws route verified before it forwarded the upgrade
 * (apps/api/src/routes/document-room-routes.ts sets these headers; the room trusts
 * them because only the worker can set them).
 */
export type UpgradeClaims = {
  verifiedRole?: 'edit' | 'view';
  isOwner: boolean;
  tabScope: string | null;
  shareCode: string | null;
  account: boolean;
  personTag: string | null;
  networkTag: string | null;
  workbenchPairing: string | null;
};

export type NodeRoomOptions = {
  documentId: string;
  env: Runtime;
  sqlite: SqliteDb;
  waitUntil: (promise: Promise<unknown>) => void;
  now?: () => number;
};

export class NodeRoom {
  readonly documentId: string;
  /** The api's room. Everything the room does lives there. */
  readonly core: DocumentRoom;
  readonly ready: Promise<void>;

  private readonly state: NodeRoomState;
  private readonly now: () => number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastActiveAt: number;

  constructor(options: NodeRoomOptions) {
    this.documentId = options.documentId;
    this.now = options.now ?? Date.now;
    this.lastActiveAt = this.now();
    this.state = createRoomState({
      roomId: options.documentId,
      sqlite: options.sqlite,
      waitUntil: options.waitUntil,
      onAlarmChange: (at) => this.armAlarm(at),
    });
    this.core = new DocumentRoom(this.state, options.env);
    this.ready = this.state.settled();
    // A room that owed a sweep before this process started still owes it.
    this.armAlarm(this.state.alarmAt());
  }

  /** Serve an internal room call (\`/broadcast\`, \`/ledger\`, \`/qa\`, …). */
  async fetch(request: Request): Promise<Response> {
    this.touch();
    if (request.headers.get('Upgrade') === 'websocket') {
      // The upgrade itself belongs to the HTTP layer — it owns the socket. The
      // room answers with the verified claims the shell needs to admit the
      // session, which is what the platform's WebSocketPair response carries
      // implicitly (docs/specs/016-platform/blueprints/self-hosted-runtime.md).
      return Response.json({ upgrade: { documentId: this.documentId, claims: claimsOf(request) } });
    }
    return this.core.fetch(request);
  }

  /**
   * Admit an upgraded client socket. The upgrade already happened; from here on
   * the room drives the session, exactly as it does after a Durable Object's
   * WebSocketPair.
   */
  accept(socket: RoomSocket, claims: UpgradeClaims): void {
    this.touch();
    this.state.addSocket(socket);
    this.core.acceptSession(
      socket,
      claims.verifiedRole,
      claims.isOwner,
      claims.tabScope,
      claims.shareCode,
      claims.account,
      claims.personTag,
      claims.networkTag,
      claims.workbenchPairing,
    );
  }

  /** A socket left; the room sheds its session like any other disconnect. */
  leave(socket: RoomSocket): void {
    this.touch();
    this.state.removeSocket(socket);
    this.core.webSocketClose(socket);
  }

  /** A frame arrived on an admitted socket. */
  message(socket: RoomSocket, message: string | ArrayBuffer): void {
    this.touch();
    this.core.webSocketMessage(socket, message);
  }

  /** A socket errored. */
  failed(socket: RoomSocket): void {
    this.touch();
    this.state.removeSocket(socket);
    this.core.webSocketError(socket);
  }

  get hasSockets(): boolean {
    return this.state.sockets().length > 0;
  }

  /** How many sockets this room is holding; the roster is built from them. */
  get socketCount(): number {
    return this.state.sockets().length;
  }

  get hasTimer(): boolean {
    return this.timer !== null;
  }

  /** Idle means: nobody connected, nothing scheduled, and nothing recent. */
  idleSince(): number {
    return this.hasSockets || this.hasTimer ? Number.POSITIVE_INFINITY : this.lastActiveAt;
  }

  private touch(): void {
    this.lastActiveAt = this.now();
  }

  private armAlarm(at: number | null): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (at === null) return;
    this.timer = setTimeout(
      () => {
        this.timer = null;
        void this.ready.then(() => this.core.alarm());
      },
      Math.max(0, at - this.now()),
    );
    // A pending sweep must not hold the process open at shutdown.
    this.timer.unref?.();
  }

  /** Close every socket with a code the client reconnects from, and drop state. */
  async shutdown(code: number, reason: string): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const socket of this.state.sockets()) {
      try {
        socket.close(code, reason);
      } catch {
        // A socket that is already gone needs nothing from us.
      }
      this.state.removeSocket(socket);
    }
    await this.ready;
  }
}
