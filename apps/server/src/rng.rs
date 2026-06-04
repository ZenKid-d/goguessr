//! A tiny, dependency-free PRNG (xorshift64) for non-cryptographic needs:
//! room codes, player IDs, and shuffling the round order. Not for anything
//! security-sensitive.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static STATE: AtomicU64 = AtomicU64::new(0);

fn seed() -> u64 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0x1234_5678);
    (nanos ^ 0x9E37_79B9_7F4A_7C15) | 1
}

/// Next pseudo-random `u64` (process-global, thread-safe).
pub fn next_u64() -> u64 {
    loop {
        let cur = STATE.load(Ordering::Relaxed);
        let mut x = if cur == 0 { seed() } else { cur };
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        if STATE
            .compare_exchange(cur, x, Ordering::Relaxed, Ordering::Relaxed)
            .is_ok()
        {
            return x;
        }
    }
}

/// Uniform integer in `0..bound` (bound must be > 0).
pub fn below(bound: usize) -> usize {
    (next_u64() % bound as u64) as usize
}

// Code alphabet without easily-confused characters (no 0/O, 1/I).
const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/// A short, shareable room code, e.g. `K7QXP2`.
pub fn room_code() -> String {
    (0..6)
        .map(|_| ALPHABET[below(ALPHABET.len())] as char)
        .collect()
}

/// A random opaque player id.
pub fn player_id() -> String {
    format!("p_{:016x}", next_u64() ^ next_u64().rotate_left(32))
}

/// In-place Fisher–Yates shuffle.
pub fn shuffle<T>(items: &mut [T]) {
    if items.len() < 2 {
        return;
    }
    for i in (1..items.len()).rev() {
        items.swap(i, below(i + 1));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn room_code_has_expected_shape() {
        let code = room_code();
        assert_eq!(code.len(), 6);
        assert!(code.bytes().all(|b| ALPHABET.contains(&b)));
    }

    #[test]
    fn shuffle_preserves_elements() {
        let mut v: Vec<u32> = (0..20).collect();
        shuffle(&mut v);
        v.sort_unstable();
        assert_eq!(v, (0..20).collect::<Vec<_>>());
    }
}
