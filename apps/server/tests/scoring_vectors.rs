//! Pins the authoritative Rust scorer to `data/scoring-vectors.json` — the same
//! fixture the TypeScript scorer is tested against. If this test and the
//! client-side Vitest both pass, the two implementations agree.

use serde::Deserialize;
use server::scoring::{LatLng, haversine_km, score_for_distance};

#[derive(Deserialize)]
struct Vectors {
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    from_name: String,
    to_name: String,
    scale_km: f64,
    from: Pt,
    to: Pt,
    distance_km: f64,
    score: u32,
}

#[derive(Deserialize)]
struct Pt {
    lat: f64,
    lng: f64,
}

#[test]
fn rust_scorer_matches_shared_vectors() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../data/scoring-vectors.json"
    );
    let raw = std::fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("could not read {path}: {e} (run `npm run gen:vectors`)"));
    let vectors: Vectors = serde_json::from_str(&raw).expect("scoring-vectors.json is valid JSON");

    assert!(!vectors.cases.is_empty(), "no vectors to check");

    for c in &vectors.cases {
        let from = LatLng::new(c.from.lat, c.from.lng);
        let to = LatLng::new(c.to.lat, c.to.lng);

        let dist = haversine_km(from, to);
        assert!(
            (dist - c.distance_km).abs() < 1e-4,
            "{} -> {} @ scale {}: distance {dist} km != {} km",
            c.from_name,
            c.to_name,
            c.scale_km,
            c.distance_km,
        );

        // Allow ±1 to absorb last-ULP differences between V8's and Rust's libm
        // `exp`. A real formula bug produces a large gap, not 1 point.
        let score = score_for_distance(dist, c.scale_km);
        let diff = (i64::from(score) - i64::from(c.score)).abs();
        assert!(
            diff <= 1,
            "{} -> {} @ scale {}: score {score} != {} (diff {diff})",
            c.from_name,
            c.to_name,
            c.scale_km,
            c.score,
        );
    }
}
