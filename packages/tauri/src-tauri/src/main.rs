// SDP v1.1 Phase 0 • Tauri
// Model-agnostic implementation
// Security reference: docs/threat-model.md §Baseline Controls
// Immutability: CIDs are permanent

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use serde::Serialize;
use tauri::State;

#[derive(Default)]
struct AppState {
    private_node: Mutex<PrivateNodeState>,
}

#[derive(Default)]
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
    to_status(&guard)
}

#[tauri::command]
fn stop_private_node(state: State<'_, AppState>) -> PrivateNodeStatus {
    let mut guard = state.private_node.lock().expect("private node mutex poisoned");
    guard.online = false;
    guard.peer_count = 0;
    to_status(&guard)
}

#[tauri::command]
fn simulate_peer_join(state: State<'_, AppState>) -> PrivateNodeStatus {
    let mut guard = state.private_node.lock().expect("private node mutex poisoned");
    if guard.online {
        guard.peer_count = guard.peer_count.saturating_add(1);
    }
    to_status(&guard)
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            node_status,
            start_private_node,
            stop_private_node,
            simulate_peer_join
        ])
        .run(tauri::generate_context!())
        .expect("error while running CIDFeed Tauri app");
}
