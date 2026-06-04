//! Axum WebSocket endpoint: one task per connection. Incoming JSON is parsed
//! into [`ClientMessage`] and dispatched to [`Rooms`]; outgoing
//! [`ServerMessage`]s are queued on an unbounded channel and written to the
//! socket by a forwarding task.

use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::Response;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc::unbounded_channel;

use crate::protocol::{ClientMessage, ServerMessage};
use crate::room::{Rooms, Tx};

pub async fn ws_handler(ws: WebSocketUpgrade, State(rooms): State<Rooms>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, rooms))
}

async fn handle_socket(socket: WebSocket, rooms: Rooms) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let (tx, mut rx) = unbounded_channel::<ServerMessage>();

    // Drain the outgoing queue to the socket.
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let Ok(text) = serde_json::to_string(&msg) else {
                continue;
            };
            if ws_tx.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });

    // This connection's identity within a room, set on create/join.
    let mut ident: Option<(String, String)> = None;

    loop {
        tokio::select! {
            incoming = ws_rx.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => match serde_json::from_str::<ClientMessage>(text.as_str()) {
                        Ok(msg) => ident = dispatch(&rooms, msg, ident, &tx),
                        Err(_) => {
                            let _ = tx.send(ServerMessage::Error {
                                code: "bad_message".to_string(),
                                message: "Could not parse message.".to_string(),
                            });
                        }
                    },
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {} // ignore binary / ping / pong
                    Some(Err(_)) => break,
                }
            }
            _ = &mut send_task => break,
        }
    }

    if let Some((code, pid)) = ident {
        rooms.disconnect(&code, &pid);
    }
    send_task.abort();
}

fn dispatch(
    rooms: &Rooms,
    msg: ClientMessage,
    ident: Option<(String, String)>,
    tx: &Tx,
) -> Option<(String, String)> {
    match msg {
        ClientMessage::CreateRoom { settings, name } => {
            Some(rooms.create_room(settings, name, tx.clone()))
        }
        ClientMessage::JoinRoom { code, name } => match rooms.join_room(&code, name, tx.clone()) {
            Ok(pid) => Some((code, pid)),
            Err(message) => {
                let _ = tx.send(ServerMessage::Error {
                    code: "join_failed".to_string(),
                    message,
                });
                ident
            }
        },
        ClientMessage::UpdateSettings { settings } => {
            if let Some((code, pid)) = &ident {
                rooms.update_settings(code, pid, settings);
            }
            ident
        }
        ClientMessage::StartGame => {
            if let Some((code, pid)) = &ident {
                rooms.start_game(code, pid);
            }
            ident
        }
        ClientMessage::SubmitGuess { round, lat, lng } => {
            if let Some((code, pid)) = &ident {
                rooms.submit_guess(code, pid, round, lat, lng);
            }
            ident
        }
        ClientMessage::LeaveRoom => {
            if let Some((code, pid)) = &ident {
                rooms.leave_room(code, pid);
            }
            None
        }
    }
}
