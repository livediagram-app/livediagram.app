import { WebSocket } from 'ws';
import type { RoomSocket } from '@livediagram/api';

// One client socket, as the room sees it
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime: the
// rooms").
//
// Cloudflare's WebSocket carries a serialized attachment because the object that
// owns it may be evicted between frames; here the socket and this wrapper live
// and die together, so the attachment is a field. The room cannot tell the
// difference, which is the point.

export class NodeSocket implements RoomSocket {
  private readonly socket: WebSocket;
  private attachment: unknown = null;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }

  get open(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }

  send(data: string): void {
    // A frame for a socket that closed between the room's decision and the write
    // is dropped, the way the platform drops it.
    if (this.open) this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  serializeAttachment(value: unknown): void {
    this.attachment = value;
  }

  deserializeAttachment(): unknown {
    return this.attachment;
  }
}
