//! WebSocket wire protocol + shared game settings.
//!
//! These types are the **single source of truth** for the shape of every
//! message exchanged between client and server, plus the game settings shared
//! by solo and multiplayer. `#[derive(TS)]` makes `cargo test` regenerate the
//! TypeScript definitions into `apps/client/src/lib/net/bindings/`.
//!
//! Conventions:
//! - Message enums are internally tagged on `"type"` (serde `tag = "type"`),
//!   producing discriminated unions on the TS side.
//! - Field names stay `snake_case` on the wire to match the spec
//!   (`image_id`, `true_lat`, `player_id`, `deadline_ts`, ...).
//! - `Option<T>` serialises to `T | null` (no field omission), keeping the
//!   contract explicit.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Where exported TS bindings land. ts-rs resolves `export_to` relative to the
/// crate's default export base (`<CARGO_MANIFEST_DIR>/bindings`), so from
/// `apps/server/bindings` the path `../../client/...` reaches
/// `apps/client/...`. (Kept here as documentation; the literal is repeated in
/// each attribute because ts-rs requires a string literal.)
pub const BINDINGS_DIR: &str = "../../client/src/lib/net/bindings/";

// ─────────────────────────────────────────────────────────────────────────────
// Game settings (shared: solo + multiplayer)
// ─────────────────────────────────────────────────────────────────────────────

/// Navigation freedom inside the panorama, per the spec's three modes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../client/src/lib/net/bindings/")]
pub enum GameMode {
    /// Free navigation along the sequence (full component set).
    Move,
    /// Sequence navigation disabled; pan + zoom still allowed.
    NoMove,
    /// No Move, no Pan, no Zoom — a fully frozen frame.
    #[serde(rename = "NMPZ")]
    Nmpz,
}

/// Game configuration. `scale_km` is the scoring decay scale (smaller =
/// stricter). `time_limit_secs == 0` means no per-round time limit.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../client/src/lib/net/bindings/")]
pub struct GameSettings {
    pub rounds: u32,
    pub mode: GameMode,
    pub scale_km: f64,
    pub time_limit_secs: u32,
    /// Optional ISO country name to restrict the pool to. `null` = whole pool.
    pub region_filter: Option<String>,
}

impl Default for GameSettings {
    fn default() -> Self {
        Self {
            rounds: 5,
            mode: GameMode::Move,
            scale_km: 2000.0,
            time_limit_secs: 0,
            region_filter: None,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Room model snapshots
// ─────────────────────────────────────────────────────────────────────────────

/// Lifecycle phase of a room, used to drive client UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../client/src/lib/net/bindings/")]
pub enum Phase {
    /// Waiting in the lobby; host can change settings and start.
    Lobby,
    /// A game is in progress.
    Playing,
    /// All rounds finished; standings are final.
    Finished,
}

/// A participant as seen by other clients. `connected == false` is shown as a
/// greyed-out player (their socket dropped; per design they're out for the game).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../client/src/lib/net/bindings/")]
pub struct Player {
    pub id: String,
    pub name: String,
    pub is_host: bool,
    pub connected: bool,
}

/// One player's outcome for a round, revealed only after the round closes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../client/src/lib/net/bindings/")]
pub struct GuessResult {
    pub player_id: String,
    pub lat: f64,
    pub lng: f64,
    pub distance_km: f64,
    pub score: u32,
}

/// Final-table row.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../client/src/lib/net/bindings/")]
pub struct Standing {
    pub player_id: String,
    pub name: String,
    pub total_score: u32,
}

// ─────────────────────────────────────────────────────────────────────────────
// Client → Server
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../../client/src/lib/net/bindings/")]
pub enum ClientMessage {
    /// Create a room. `name` is the host's display name (added to the spec's
    /// `{ settings }` so the host is a named player like everyone else).
    CreateRoom {
        settings: GameSettings,
        name: String,
    },
    /// Join an existing room by its short code.
    JoinRoom { code: String, name: String },
    /// Host-only: change settings while in the lobby.
    UpdateSettings { settings: GameSettings },
    /// Host-only: begin the game.
    StartGame,
    /// Submit a guess for the given round.
    SubmitGuess { round: u32, lat: f64, lng: f64 },
    /// Leave the room (graceful).
    LeaveRoom,
}

// ─────────────────────────────────────────────────────────────────────────────
// Server → Client
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../../client/src/lib/net/bindings/")]
pub enum ServerMessage {
    /// Sent to the host right after a room is created.
    RoomCreated { code: String, player_id: String },
    /// Full room snapshot (sent on join and whenever membership/settings change).
    RoomState {
        code: String,
        players: Vec<Player>,
        settings: GameSettings,
        phase: Phase,
    },
    /// A round begins. Only the `image_id` is revealed — never the coordinates.
    /// `deadline_ts` is epoch milliseconds, or `null` for no time limit.
    RoundStart {
        round: u32,
        image_id: String,
        // i64 in Rust (exact ms). Force the TS type instead of letting ts-rs map
        // i64 -> bigint: serde sends a JSON integer (or null) that `JSON.parse`
        // yields as a number, never a bigint. `Option` -> include `| null`.
        #[ts(type = "number | null")]
        deadline_ts: Option<i64>,
    },
    /// A player locked in their guess (the guess itself stays hidden).
    PlayerGuessed { player_id: String },
    /// The round closed; here is the truth and everyone's guesses + scores.
    RoundResult {
        round: u32,
        true_lat: f64,
        true_lng: f64,
        results: Vec<GuessResult>,
    },
    /// The game is over; final standings.
    GameOver { standings: Vec<Standing> },
    /// A player joined the room.
    PlayerJoined { player: Player },
    /// A player left (graceful leave or dropped socket — both end as "out").
    PlayerLeft { player_id: String },
    /// A recoverable error addressed to this client.
    Error { code: String, message: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_message_is_internally_tagged() {
        let msg = ClientMessage::JoinRoom {
            code: "ABC123".into(),
            name: "Timo".into(),
        };
        let json = serde_json::to_value(&msg).unwrap();
        assert_eq!(json["type"], "JoinRoom");
        assert_eq!(json["code"], "ABC123");
    }

    #[test]
    fn nmpz_serialises_with_spec_name() {
        let json = serde_json::to_string(&GameMode::Nmpz).unwrap();
        assert_eq!(json, "\"NMPZ\"");
    }

    #[test]
    fn option_serialises_as_null_not_omitted() {
        let s = GameSettings::default();
        let json = serde_json::to_value(&s).unwrap();
        assert!(json.get("region_filter").is_some());
        assert!(json["region_filter"].is_null());
    }
}
