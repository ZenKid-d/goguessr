//! In-memory rooms and the authoritative game loop.
//!
//! The server owns the truth: it picks the locations, sends clients only the
//! `image_id` per round, scores guesses itself, and decides when a round ends
//! (everyone connected has answered, or the deadline passed). Per the project's
//! decision, a dropped socket means that player is **out** (no reconnect token);
//! their score is retained for the final standings.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tokio::sync::mpsc::UnboundedSender;

use crate::pool::{Pool, RoundTruth};
use crate::protocol::{
    GameSettings, GuessResult, Phase, Player as PlayerDto, ServerMessage, Standing,
};
use crate::rng;
use crate::scoring::{LatLng, evaluate};

/// Outgoing-message channel to a single connected client.
pub type Tx = UnboundedSender<ServerMessage>;

const INTERMISSION_SECS: u64 = 6;
const MAX_PLAYERS: usize = 8;
const MAX_NAME_LEN: usize = 20;

struct Player {
    id: String,
    name: String,
    is_host: bool,
    connected: bool,
    tx: Tx,
    total_score: u32,
    guess: Option<LatLng>,
}

impl Player {
    fn dto(&self) -> PlayerDto {
        PlayerDto {
            id: self.id.clone(),
            name: self.name.clone(),
            is_host: self.is_host,
            connected: self.connected,
        }
    }
}

struct Room {
    code: String,
    settings: GameSettings,
    phase: Phase,
    players: Vec<Player>,
    rounds: Vec<RoundTruth>,
    current_round: u32, // 1-based; 0 before the first round
    round_open: bool,
}

impl Room {
    fn broadcast(&self, msg: &ServerMessage) {
        for p in &self.players {
            if p.connected {
                let _ = p.tx.send(msg.clone());
            }
        }
    }

    fn state_msg(&self) -> ServerMessage {
        ServerMessage::RoomState {
            code: self.code.clone(),
            players: self.players.iter().map(Player::dto).collect(),
            settings: self.settings.clone(),
            phase: self.phase,
        }
    }

    fn find(&self, id: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.id == id)
    }

    fn find_mut(&mut self, id: &str) -> Option<&mut Player> {
        self.players.iter_mut().find(|p| p.id == id)
    }

    fn is_host(&self, id: &str) -> bool {
        self.find(id).is_some_and(|p| p.is_host)
    }

    fn connected_count(&self) -> usize {
        self.players.iter().filter(|p| p.connected).count()
    }

    /// True if at least one player is connected and all connected players have guessed.
    fn all_connected_guessed(&self) -> bool {
        let mut any = false;
        for p in &self.players {
            if p.connected {
                any = true;
                if p.guess.is_none() {
                    return false;
                }
            }
        }
        any
    }

    fn current_truth(&self) -> Option<RoundTruth> {
        if self.current_round == 0 {
            return None;
        }
        self.rounds.get((self.current_round - 1) as usize).cloned()
    }
}

/// Shared registry of all rooms plus the canonical pool. Cheap to clone.
#[derive(Clone)]
pub struct Rooms {
    inner: Arc<Mutex<HashMap<String, Room>>>,
    pool: Arc<Pool>,
}

impl Rooms {
    pub fn new(pool: Pool) -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            pool: Arc::new(pool),
        }
    }

    pub fn pool_len(&self) -> usize {
        self.pool.len()
    }

    // ── Client commands ─────────────────────────────────────────────────────

    pub fn create_room(&self, settings: GameSettings, name: String, tx: Tx) -> (String, String) {
        let mut map = self.inner.lock().unwrap();
        let code = loop {
            let candidate = rng::room_code();
            if !map.contains_key(&candidate) {
                break candidate;
            }
        };
        let pid = rng::player_id();
        let host = Player {
            id: pid.clone(),
            name: sanitize(name),
            is_host: true,
            connected: true,
            tx: tx.clone(),
            total_score: 0,
            guess: None,
        };
        let room = Room {
            code: code.clone(),
            settings,
            phase: Phase::Lobby,
            players: vec![host],
            rounds: Vec::new(),
            current_round: 0,
            round_open: false,
        };
        let _ = tx.send(ServerMessage::RoomCreated {
            code: code.clone(),
            player_id: pid.clone(),
        });
        let _ = tx.send(room.state_msg());
        map.insert(code.clone(), room);
        (code, pid)
    }

    /// Join a lobby. Returns the new player's id, or an error message for the client.
    pub fn join_room(&self, code: &str, name: String, tx: Tx) -> Result<String, String> {
        let mut map = self.inner.lock().unwrap();
        let room = map
            .get_mut(code)
            .ok_or_else(|| "Room not found.".to_string())?;
        if room.phase != Phase::Lobby {
            return Err("That game has already started.".to_string());
        }
        if room.connected_count() >= MAX_PLAYERS {
            return Err("That room is full.".to_string());
        }
        let pid = rng::player_id();
        let player = Player {
            id: pid.clone(),
            name: sanitize(name),
            is_host: false,
            connected: true,
            tx: tx.clone(),
            total_score: 0,
            guess: None,
        };
        let joined = player.dto();
        room.players.push(player);
        // The joiner learns its identity via RoomCreated (same shape as the host got).
        let _ = tx.send(ServerMessage::RoomCreated {
            code: code.to_string(),
            player_id: pid.clone(),
        });
        for p in &room.players {
            if p.connected && p.id != pid {
                let _ = p.tx.send(ServerMessage::PlayerJoined {
                    player: joined.clone(),
                });
            }
        }
        let state = room.state_msg();
        room.broadcast(&state);
        Ok(pid)
    }

    pub fn update_settings(&self, code: &str, player_id: &str, settings: GameSettings) {
        let mut map = self.inner.lock().unwrap();
        let Some(room) = map.get_mut(code) else {
            return;
        };
        if room.phase != Phase::Lobby || !room.is_host(player_id) {
            return;
        }
        room.settings = settings;
        let state = room.state_msg();
        room.broadcast(&state);
    }

    pub fn start_game(&self, code: &str, player_id: &str) {
        let mut map = self.inner.lock().unwrap();
        let Some(room) = map.get_mut(code) else {
            return;
        };
        if room.phase != Phase::Lobby || !room.is_host(player_id) {
            return;
        }
        let n = room.settings.rounds.max(1) as usize;
        let region = room.settings.region_filter.clone();
        let rounds = self.pool.pick_rounds(n, region.as_deref());
        if rounds.is_empty() {
            if let Some(p) = room.find(player_id) {
                let _ = p.tx.send(ServerMessage::Error {
                    code: "empty_pool".to_string(),
                    message: "No locations available to start a game.".to_string(),
                });
            }
            return;
        }
        room.rounds = rounds;
        room.phase = Phase::Playing;
        room.current_round = 0;
        for p in &mut room.players {
            p.total_score = 0;
            p.guess = None;
        }
        let state = room.state_msg();
        room.broadcast(&state);
        self.start_round_in(room, code);
    }

    pub fn submit_guess(&self, code: &str, player_id: &str, round: u32, lat: f64, lng: f64) {
        let mut map = self.inner.lock().unwrap();
        let Some(room) = map.get_mut(code) else {
            return;
        };
        if room.phase != Phase::Playing || !room.round_open || round != room.current_round {
            return;
        }
        {
            let Some(p) = room.find_mut(player_id) else {
                return;
            };
            if !p.connected || p.guess.is_some() {
                return;
            }
            p.guess = Some(LatLng::new(lat, lng));
        }
        room.broadcast(&ServerMessage::PlayerGuessed {
            player_id: player_id.to_string(),
        });
        if room.all_connected_guessed() {
            let round = room.current_round;
            self.close_round_in(room, code, round);
        }
    }

    pub fn leave_room(&self, code: &str, player_id: &str) {
        self.mark_left(code, player_id);
    }

    /// A dropped socket: the player is out for the rest of the game.
    pub fn disconnect(&self, code: &str, player_id: &str) {
        self.mark_left(code, player_id);
    }

    // ── Internal lifecycle ──────────────────────────────────────────────────

    fn start_round_in(&self, room: &mut Room, code: &str) {
        room.current_round += 1;
        room.round_open = true;
        for p in &mut room.players {
            p.guess = None;
        }
        let Some(truth) = room.current_truth() else {
            return;
        };
        let round = room.current_round;
        let limit = room.settings.time_limit_secs;
        let deadline = if limit > 0 {
            Some(now_ms() + i64::from(limit) * 1000)
        } else {
            None
        };
        room.broadcast(&ServerMessage::RoundStart {
            round,
            image_id: truth.image_id.clone(),
            deadline_ts: deadline,
        });
        if limit > 0 {
            self.schedule_deadline(code.to_string(), round, u64::from(limit));
        }
    }

    fn close_round_in(&self, room: &mut Room, code: &str, round: u32) {
        if !room.round_open || room.current_round != round {
            return;
        }
        room.round_open = false;
        let Some(truth) = room.current_truth() else {
            return;
        };
        let scale = room.settings.scale_km;
        let mut results = Vec::new();
        for p in &mut room.players {
            if let Some(g) = p.guess {
                let (distance_km, score) = evaluate(g, truth.truth, scale);
                p.total_score = p.total_score.saturating_add(score);
                results.push(GuessResult {
                    player_id: p.id.clone(),
                    lat: g.lat,
                    lng: g.lng,
                    distance_km,
                    score,
                });
            }
        }
        room.broadcast(&ServerMessage::RoundResult {
            round,
            true_lat: truth.truth.lat,
            true_lng: truth.truth.lng,
            results,
        });
        self.schedule_advance(code.to_string(), round, INTERMISSION_SECS);
    }

    /// Called by the deadline timer.
    pub fn close_round(&self, code: &str, round: u32) {
        let mut map = self.inner.lock().unwrap();
        if let Some(room) = map.get_mut(code) {
            self.close_round_in(room, code, round);
        }
    }

    /// Called after the intermission to start the next round or finish.
    pub fn advance(&self, code: &str, from_round: u32) {
        let mut map = self.inner.lock().unwrap();
        let Some(room) = map.get_mut(code) else {
            return;
        };
        if room.phase != Phase::Playing || room.round_open || room.current_round != from_round {
            return;
        }
        if (room.current_round as usize) < room.rounds.len() {
            self.start_round_in(room, code);
        } else {
            room.phase = Phase::Finished;
            let mut standings: Vec<Standing> = room
                .players
                .iter()
                .map(|p| Standing {
                    player_id: p.id.clone(),
                    name: p.name.clone(),
                    total_score: p.total_score,
                })
                .collect();
            standings.sort_by_key(|s| std::cmp::Reverse(s.total_score));
            room.broadcast(&ServerMessage::GameOver { standings });
            let state = room.state_msg();
            room.broadcast(&state);
        }
    }

    fn mark_left(&self, code: &str, player_id: &str) {
        let mut map = self.inner.lock().unwrap();
        let empty;
        {
            let Some(room) = map.get_mut(code) else {
                return;
            };
            let Some(p) = room.find_mut(player_id) else {
                return;
            };
            if !p.connected {
                return;
            }
            p.connected = false;
            p.guess = None;
            let was_host = p.is_host;
            p.is_host = false;
            if was_host && let Some(next_host) = room.players.iter_mut().find(|p| p.connected) {
                next_host.is_host = true;
            }
            room.broadcast(&ServerMessage::PlayerLeft {
                player_id: player_id.to_string(),
            });
            empty = room.connected_count() == 0;
            if !empty {
                let state = room.state_msg();
                room.broadcast(&state);
                if room.phase == Phase::Playing && room.round_open && room.all_connected_guessed() {
                    let round = room.current_round;
                    self.close_round_in(room, code, round);
                }
            }
        }
        if empty {
            map.remove(code);
        }
    }

    fn schedule_deadline(&self, code: String, round: u32, secs: u64) {
        let me = self.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(secs)).await;
            me.close_round(&code, round);
        });
    }

    fn schedule_advance(&self, code: String, from_round: u32, secs: u64) {
        let me = self.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(secs)).await;
            me.advance(&code, from_round);
        });
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn sanitize(name: String) -> String {
    let trimmed = name.trim();
    let base = if trimmed.is_empty() {
        "Player"
    } else {
        trimmed
    };
    base.chars().take(MAX_NAME_LEN).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pool::{Pool, PoolLocation};
    use crate::protocol::GameMode;
    use tokio::sync::mpsc::{UnboundedReceiver, unbounded_channel};

    fn settings(rounds: u32) -> GameSettings {
        GameSettings {
            rounds,
            mode: GameMode::Move,
            scale_km: 2000.0,
            time_limit_secs: 0,
            region_filter: None,
        }
    }

    fn test_pool() -> Pool {
        Pool::from_locations(vec![
            PoolLocation {
                id: "img-a".into(),
                lat: 48.85,
                lng: 2.35,
                country: "France".into(),
            },
            PoolLocation {
                id: "img-b".into(),
                lat: 35.68,
                lng: 139.69,
                country: "Japan".into(),
            },
            PoolLocation {
                id: "img-c".into(),
                lat: 40.71,
                lng: -74.0,
                country: "USA".into(),
            },
        ])
    }

    fn drain(rx: &mut UnboundedReceiver<ServerMessage>) -> Vec<ServerMessage> {
        let mut out = Vec::new();
        while let Ok(m) = rx.try_recv() {
            out.push(m);
        }
        out
    }

    #[tokio::test]
    async fn create_join_start_and_score_a_round() {
        let rooms = Rooms::new(test_pool());

        let (htx, mut hrx) = unbounded_channel();
        let (code, host_id) = rooms.create_room(settings(1), "Host".into(), htx);

        let (jtx, mut jrx) = unbounded_channel();
        let guest_id = rooms.join_room(&code, "Guest".into(), jtx).unwrap();

        rooms.start_game(&code, &host_id);
        rooms.submit_guess(&code, &host_id, 1, 48.85, 2.35); // perfect-ish
        rooms.submit_guess(&code, &guest_id, 1, 0.0, 0.0); // far

        let host_msgs = drain(&mut hrx);
        let result = host_msgs.iter().find_map(|m| match m {
            ServerMessage::RoundResult { results, .. } => Some(results),
            _ => None,
        });
        let results = result.expect("expected a RoundResult after both guessed");
        assert_eq!(results.len(), 2);
        let host_score = results
            .iter()
            .find(|r| r.player_id == host_id)
            .unwrap()
            .score;
        let guest_score = results
            .iter()
            .find(|r| r.player_id == guest_id)
            .unwrap()
            .score;
        assert!(host_score > guest_score, "closer guess should score higher");

        // The guest also received a RoundStart with only the image id (no coords).
        let guest_msgs = drain(&mut jrx);
        assert!(guest_msgs.iter().any(
            |m| matches!(m, ServerMessage::RoundStart { image_id, .. } if image_id == "img-a"
                || image_id == "img-b"
                || image_id == "img-c")
        ));
    }

    #[tokio::test]
    async fn rejects_join_after_start() {
        let rooms = Rooms::new(test_pool());
        let (htx, _hrx) = unbounded_channel();
        let (code, host_id) = rooms.create_room(settings(2), "Host".into(), htx);
        rooms.start_game(&code, &host_id);
        let (jtx, _jrx) = unbounded_channel();
        assert!(rooms.join_room(&code, "Late".into(), jtx).is_err());
    }
}
