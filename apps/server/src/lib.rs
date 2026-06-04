//! Core library for the geo-guess game server.
//!
//! - [`protocol`]: the wire format shared with the TypeScript client (ts-rs).
//! - [`scoring`]: authoritative distance + score, pinned to a shared fixture.
//! - [`pool`]: the canonical location pool (coords kept server-side).
//! - [`room`]: in-memory rooms, phases, and the authoritative round lifecycle.
//! - [`ws`]: the Axum WebSocket endpoint and per-connection dispatch.
//! - [`rng`]: a tiny dependency-free PRNG for room codes / shuffling.

pub mod pool;
pub mod protocol;
pub mod rng;
pub mod room;
pub mod scoring;
pub mod ws;
