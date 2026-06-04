// Thin, typed WebSocket wrapper for the multiplayer protocol. It only does
// framing (JSON <-> ClientMessage/ServerMessage) and lifecycle callbacks; all
// game state lives in the multiplayer store. Per the server design a dropped
// socket means the player is out (no reconnect token), so this client does not
// attempt to silently re-join a game — it surfaces the close to the store.
import type { ClientMessage, ServerMessage } from './bindings';

export interface GameSocketHandlers {
  /** The socket opened; safe to send the first message (create/join). */
  onOpen?: () => void;
  /** A well-formed server message arrived. */
  onMessage: (msg: ServerMessage) => void;
  /** The socket closed (cleanly or not). `byUs` is true for an intentional close. */
  onClose?: (info: { byUs: boolean }) => void;
  /** A transport-level error occurred (often followed by a close). */
  onError?: () => void;
}

/**
 * The intent flag lives ON the connection object (not the instance) so that a
 * rapid close→reconnect — e.g. host opening a "New room" — can't let a stale
 * socket's late `close` event clobber the fresh connection or be misreported.
 */
interface Conn {
  ws: WebSocket;
  byUs: boolean;
}

export class GameSocket {
  private conn: Conn | null = null;

  constructor(private readonly handlers: GameSocketHandlers) {}

  /** Open a connection. No-op if one is already live. */
  connect(url: string): void {
    if (this.conn) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.handlers.onError?.();
      return;
    }
    const conn: Conn = { ws, byUs: false };
    this.conn = conn;

    ws.addEventListener('open', () => this.handlers.onOpen?.());
    ws.addEventListener('message', (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data) as ServerMessage;
      } catch {
        return; // ignore malformed frames
      }
      this.handlers.onMessage(msg);
    });
    ws.addEventListener('error', () => this.handlers.onError?.());
    ws.addEventListener('close', () => {
      if (this.conn === conn) this.conn = null;
      this.handlers.onClose?.({ byUs: conn.byUs });
    });
  }

  /** Send a message. Returns false if the socket is not open. */
  send(msg: ClientMessage): boolean {
    if (this.conn?.ws.readyState !== WebSocket.OPEN) return false;
    this.conn.ws.send(JSON.stringify(msg));
    return true;
  }

  /** Close intentionally (the close callback will report `byUs: true`). */
  close(): void {
    const conn = this.conn;
    if (!conn) return;
    conn.byUs = true;
    this.conn = null;
    try {
      conn.ws.close();
    } catch {
      /* already closing */
    }
  }

  get isOpen(): boolean {
    return this.conn?.ws.readyState === WebSocket.OPEN;
  }
}
