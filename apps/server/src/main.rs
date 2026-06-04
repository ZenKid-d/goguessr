//! geo-guess multiplayer server binary.
//!
//! Run from the repo root:  `cargo run -p server`
//! Env: `PORT` (default 8787), `POOL_PATH` (else searches data/locations*.json).

use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use axum::routing::get;
use tokio::net::TcpListener;

use server::pool::Pool;
use server::room::Rooms;
use server::ws::ws_handler;

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8787);

    let pool = load_pool();
    if pool.is_empty() {
        eprintln!("Pool is empty — clients can join rooms but games cannot start.");
    }
    let rooms = Rooms::new(pool);

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(|| async { "ok" }))
        .with_state(rooms);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("failed to bind {addr}: {e}"));
    println!("geo-guess server listening on ws://{addr}/ws");

    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
            println!("\nshutting down");
        })
        .await
        .expect("server error");
}

/// Find and load the canonical pool, falling back to the committed sample.
fn load_pool() -> Pool {
    let candidates = pool_candidates();
    for path in &candidates {
        if path.exists() {
            match Pool::load(path) {
                Ok(p) => {
                    println!("Loaded {} locations from {}", p.len(), path.display());
                    return p;
                }
                Err(e) => eprintln!("Could not read {}: {e}", path.display()),
            }
        }
    }
    eprintln!("No pool file found (looked in {candidates:?}).");
    Pool::default()
}

fn pool_candidates() -> Vec<PathBuf> {
    if let Ok(p) = std::env::var("POOL_PATH") {
        return vec![PathBuf::from(p)];
    }
    let cwd = std::env::current_dir().unwrap_or_default();
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    vec![
        cwd.join("data/locations.json"),
        cwd.join("data/locations.sample.json"),
        manifest.join("../../data/locations.json"),
        manifest.join("../../data/locations.sample.json"),
    ]
}
