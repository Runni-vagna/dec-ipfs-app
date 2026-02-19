// SDP v1.1 Phase 0 • Tauri
// Model-agnostic implementation
// Security reference: docs/threat-model.md §Baseline Controls
// Immutability: CIDs are permanent

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

struct AppState {
    private_node: Mutex<PrivateNodeState>,
    private_node_state_path: PathBuf,
}

#[derive(Clone, Default, Deserialize, Serialize)]
struct PrivateNodeState {
    online: bool,
    peer_count: u16,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PrivateNodeStatus {
    online: bool,
    peer_count: u16,
}

fn to_status(state: &PrivateNodeState) -> PrivateNodeStatus {
    PrivateNodeStatus {
        online: state.online,
        peer_count: state.peer_count,
    }
}

fn resolve_state_path(handle: &AppHandle) -> PathBuf {
    match handle.path().app_data_dir() {
        Ok(dir) => dir.join("private-node-state.json"),
        Err(_) => PathBuf::from("private-node-state.json"),
    }
}

fn load_private_node_state(path: &PathBuf) -> PrivateNodeState {
    let Ok(raw) = fs::read_to_string(path) else {
        return PrivateNodeState::default();
    };
    serde_json::from_str::<PrivateNodeState>(&raw).unwrap_or_default()
}

fn persist_private_node_state(path: &PathBuf, state: &PrivateNodeState) {
    let Ok(encoded) = serde_json::to_string(state) else {
        return;
    };
    if let Some(parent) = path.parent() {
        if fs::create_dir_all(parent).is_err() {
            return;
        }
    }
    let _ = fs::write(path, encoded);
}

#[tauri::command]
fn node_status(state: State<'_, AppState>) -> PrivateNodeStatus {
    let guard = state.private_node.lock().expect("private node mutex poisoned");
    to_status(&guard)
}

#[tauri::command]
fn start_private_node(state: State<'_, AppState>) -> PrivateNodeStatus {
    let mut guard = state.private_node.lock().expect("private node mutex poisoned");
    guard.online = true;
    if guard.peer_count == 0 {
        guard.peer_count = 3;
    }
    persist_private_node_state(&state.private_node_state_path, &guard);
    to_status(&guard)
}

#[tauri::command]
fn stop_private_node(state: State<'_, AppState>) -> PrivateNodeStatus {
    let mut guard = state.private_node.lock().expect("private node mutex poisoned");
    guard.online = false;
    guard.peer_count = 0;
    persist_private_node_state(&state.private_node_state_path, &guard);
    to_status(&guard)
}

#[tauri::command]
fn simulate_peer_join(state: State<'_, AppState>) -> PrivateNodeStatus {
    let mut guard = state.private_node.lock().expect("private node mutex poisoned");
    if guard.online {
        guard.peer_count = guard.peer_count.saturating_add(1);
        persist_private_node_state(&state.private_node_state_path, &guard);
    }
    to_status(&guard)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let state_path = resolve_state_path(app.handle());
            let private_node = load_private_node_state(&state_path);
            app.manage(AppState {
                private_node: Mutex::new(private_node),
                private_node_state_path: state_path,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            node_status,
            start_private_node,
            stop_private_node,
            simulate_peer_join
        ])
        .run(tauri::generate_context!())
        .expect("error while running CIDFeed Tauri app");
}
