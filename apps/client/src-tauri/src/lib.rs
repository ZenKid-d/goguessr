//! Tauri shell: hosts the WebView and exposes local-storage commands backed by
//! SQLite (rusqlite). Personal records, settings and history live here; the
//! multiplayer server is a separate process the client reaches over WebSocket.

use std::fs;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

/// SQLite connection guarded for use across command invocations.
struct Db(Mutex<Connection>);

/// A finished game, mirrored on the TS side as `GameRecord` (camelCase).
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameRecordDto {
    played_at: i64,
    mode: String,
    rounds: u32,
    total_score: u32,
    max_score: u32,
}

#[tauri::command]
fn load_settings(db: State<'_, Db>) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT value FROM settings WHERE key = 'settings'",
        [],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(db: State<'_, Db>, value: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('settings', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [value],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_record(db: State<'_, Db>, record: GameRecordDto) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO records (played_at, mode, rounds, total_score, max_score)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            record.played_at,
            record.mode,
            record.rounds,
            record.total_score,
            record.max_score
        ],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_records(db: State<'_, Db>, limit: u32) -> Result<Vec<GameRecordDto>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT played_at, mode, rounds, total_score, max_score
             FROM records ORDER BY played_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([limit], |row| {
            Ok(GameRecordDto {
                played_at: row.get(0)?,
                mode: row.get(1)?,
                rounds: row.get(2)?,
                total_score: row.get(3)?,
                max_score: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn best_score(db: State<'_, Db>) -> Result<Option<i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // MAX() always returns one row; its value is NULL (→ None) when empty.
    conn.query_row("SELECT MAX(total_score) FROM records", [], |row| {
        row.get::<_, Option<i64>>(0)
    })
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            fs::create_dir_all(&dir)?;
            let conn = Connection::open(dir.join("geoguess.db"))?;
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS settings (
                    key   TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                 );
                 CREATE TABLE IF NOT EXISTS records (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    played_at   INTEGER NOT NULL,
                    mode        TEXT    NOT NULL,
                    rounds      INTEGER NOT NULL,
                    total_score INTEGER NOT NULL,
                    max_score   INTEGER NOT NULL
                 );",
            )?;
            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            add_record,
            list_records,
            best_score
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
