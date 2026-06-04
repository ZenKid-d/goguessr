// Reactive multiplayer client: owns the WebSocket, mirrors the authoritative
// room/round state pushed by the server, and exposes intent actions. The server
// is the source of truth for membership, round progression and scoring — this
// store never scores anything itself, it just renders what the server sends.
//
// Connection model (matches the server): a dropped socket means you are OUT of
// any in-progress game (no reconnect token). We therefore surface a drop as a
// `disconnected` status rather than silently re-joining.
import { DEFAULT_SERVER_URL } from '../config';
import type { LatLng } from '../game/types';
import { GameSocket } from '../net/client';
import type {
  ClientMessage,
  GameSettings,
  GuessResult,
  Phase,
  Player,
  ServerMessage,
  Standing,
} from '../net/bindings';

const NAME_KEY = 'geoguess.mp.name.v1';
const SERVER_KEY = 'geoguess.mp.server.v1';
const MAX_NAME_LEN = 20;

/** Transport-level status, independent of which room phase we're in. */
export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';
/** Where the local player is within the current round. */
export type RoundPhase = 'idle' | 'guessing' | 'waiting' | 'result';

export interface RoundResultView {
  round: number;
  trueLat: number;
  trueLng: number;
  results: GuessResult[];
}

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — non-fatal */
  }
}
function clampName(n: string): string {
  return n.trim().slice(0, MAX_NAME_LEN);
}

// ── Persistent prefs ─────────────────────────────────────────────────────────
let name = $state(readPref(NAME_KEY, ''));
let serverUrl = $state(readPref(SERVER_KEY, DEFAULT_SERVER_URL));

// ── Connection + room state ──────────────────────────────────────────────────
let status = $state<ConnStatus>('idle');
let error = $state<string | null>(null);
let myId = $state<string | null>(null);
let code = $state<string | null>(null);
let players = $state<Player[]>([]);
let roomSettings = $state<GameSettings | null>(null);
let phase = $state<Phase | null>(null);

// ── Per-round state ──────────────────────────────────────────────────────────
let round = $state(0);
let imageId = $state<string | null>(null);
let deadline = $state<number | null>(null);
let guessed = $state<string[]>([]);
let myGuess = $state<LatLng | null>(null);
let roundPhase = $state<RoundPhase>('idle');
let lastResult = $state<RoundResultView | null>(null);
let myTotal = $state(0);
let standings = $state<Standing[] | null>(null);

let pending: ClientMessage | null = null;

function resetRoom(): void {
  myId = null;
  code = null;
  players = [];
  roomSettings = null;
  phase = null;
  round = 0;
  imageId = null;
  deadline = null;
  guessed = [];
  myGuess = null;
  roundPhase = 'idle';
  lastResult = null;
  myTotal = 0;
  standings = null;
  pending = null;
}

function handle(msg: ServerMessage): void {
  switch (msg.type) {
    case 'RoomCreated':
      myId = msg.player_id;
      code = msg.code;
      break;
    case 'RoomState':
      code = msg.code;
      players = msg.players;
      roomSettings = msg.settings;
      phase = msg.phase;
      status = 'connected';
      break;
    case 'PlayerJoined':
    case 'PlayerLeft':
      // Authoritative membership arrives in the RoomState that always follows.
      break;
    case 'RoundStart':
      round = msg.round;
      imageId = msg.image_id;
      deadline = msg.deadline_ts && msg.deadline_ts > 0 ? msg.deadline_ts : null;
      guessed = [];
      myGuess = null;
      lastResult = null;
      roundPhase = 'guessing';
      if (msg.round === 1) {
        myTotal = 0;
        standings = null;
      }
      break;
    case 'PlayerGuessed':
      if (!guessed.includes(msg.player_id)) guessed = [...guessed, msg.player_id];
      break;
    case 'RoundResult': {
      lastResult = {
        round: msg.round,
        trueLat: msg.true_lat,
        trueLng: msg.true_lng,
        results: msg.results,
      };
      const mine = msg.results.find((r) => r.player_id === myId);
      if (mine) myTotal += mine.score;
      roundPhase = 'result';
      break;
    }
    case 'GameOver':
      standings = msg.standings;
      roundPhase = 'idle';
      break;
    case 'Error':
      error = msg.message;
      if (msg.code === 'join_failed') {
        socket.close();
        resetRoom();
        status = 'idle';
      }
      break;
  }
}

const socket = new GameSocket({
  onOpen() {
    if (pending) {
      socket.send(pending);
      pending = null;
    }
  },
  onMessage: handle,
  onClose({ byUs }) {
    if (byUs) return; // an intentional leave already reset our state
    status = 'disconnected';
    if (!error) error = 'Connection to the server was lost.';
  },
  onError() {
    if (status === 'connecting') {
      error = 'Could not reach the server. Check the URL and that it is running.';
    }
  },
});

function connectWith(action: ClientMessage): void {
  error = null;
  resetRoom();
  status = 'connecting';
  pending = action;
  socket.connect(serverUrl);
}

export const multiplayer = {
  // prefs
  get name(): string {
    return name;
  },
  get serverUrl(): string {
    return serverUrl;
  },
  // connection / room
  get status(): ConnStatus {
    return status;
  },
  get error(): string | null {
    return error;
  },
  get myId(): string | null {
    return myId;
  },
  get code(): string | null {
    return code;
  },
  get players(): Player[] {
    return players;
  },
  get settings(): GameSettings | null {
    return roomSettings;
  },
  get phase(): Phase | null {
    return phase;
  },
  // round
  get round(): number {
    return round;
  },
  get imageId(): string | null {
    return imageId;
  },
  get deadline(): number | null {
    return deadline;
  },
  get guessed(): string[] {
    return guessed;
  },
  get myGuess(): LatLng | null {
    return myGuess;
  },
  get roundPhase(): RoundPhase {
    return roundPhase;
  },
  get lastResult(): RoundResultView | null {
    return lastResult;
  },
  get myTotal(): number {
    return myTotal;
  },
  get standings(): Standing[] | null {
    return standings;
  },
  // derived
  get me(): Player | null {
    return players.find((p) => p.id === myId) ?? null;
  },
  get isHost(): boolean {
    return this.me?.is_host ?? false;
  },

  setName(n: string): void {
    name = clampName(n);
    writePref(NAME_KEY, name);
  },
  setServerUrl(u: string): void {
    serverUrl = u.trim();
    writePref(SERVER_KEY, serverUrl);
  },

  /** Host: create a new room with the given settings. */
  create(settings: GameSettings): void {
    const nm = clampName(name);
    if (!nm) {
      error = 'Enter a display name first.';
      return;
    }
    name = nm;
    writePref(NAME_KEY, nm);
    connectWith({ type: 'CreateRoom', settings, name: nm });
  },

  /** Join an existing room by code. */
  join(roomCode: string): void {
    const nm = clampName(name);
    if (!nm) {
      error = 'Enter a display name first.';
      return;
    }
    const c = roomCode.trim().toUpperCase();
    if (!c) {
      error = 'Enter a room code.';
      return;
    }
    name = nm;
    writePref(NAME_KEY, nm);
    connectWith({ type: 'JoinRoom', code: c, name: nm });
  },

  /** Host: change lobby settings. */
  updateSettings(settings: GameSettings): void {
    socket.send({ type: 'UpdateSettings', settings });
  },

  /** Host: start the game. */
  start(): void {
    socket.send({ type: 'StartGame' });
  },

  /** Submit (and lock in) this round's guess. */
  submit(g: LatLng): void {
    if (roundPhase !== 'guessing') return;
    myGuess = g;
    roundPhase = 'waiting';
    if (myId && !guessed.includes(myId)) guessed = [...guessed, myId];
    socket.send({ type: 'SubmitGuess', round, lat: g.lat, lng: g.lng });
  },

  /** Leave the room and tear down the connection. */
  leave(): void {
    if (socket.isOpen) socket.send({ type: 'LeaveRoom' });
    socket.close();
    resetRoom();
    status = 'idle';
    error = null;
  },

  dismissError(): void {
    error = null;
  },
};
