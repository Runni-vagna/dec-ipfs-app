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
    security_state: Mutex<SecurityState>,
    security_state_path: PathBuf,
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

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SecurityState {
    identity_json: Option<String>,
    delegation_json: Option<String>,
    revocation_queue_json: Option<String>,
    audit_log_json: Option<String>,
    failed_flush_queue_json: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FlushRevocationResult {
    flushed_ids: Vec<String>,
    failed_ids: Vec<String>,
}

fn to_status(state: &PrivateNodeState) -> PrivateNodeStatus {
    PrivateNodeStatus {
        online: state.online,
        peer_count: state.peer_count,
    }
}

fn resolve_state_path(handle: &AppHandle, file_name: &str) -> PathBuf {
    match handle.path().app_data_dir() {
        Ok(dir) => dir.join(file_name),
        Err(_) => PathBuf::from(file_name),
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

fn load_security_state(path: &PathBuf) -> SecurityState {
    let Ok(raw) = fs::read_to_string(path) else {
        return SecurityState::default();
    };
    serde_json::from_str::<SecurityState>(&raw).unwrap_or_default()
}

fn persist_security_state(path: &PathBuf, state: &SecurityState) {
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

fn normalize_json_string(value: Option<String>) -> Option<String> {
    match value {
        Some(raw) => {
            let normalized = raw.trim().to_string();
            if normalized.is_empty() {
                None
            } else {
                Some(normalized)
            }
        }
        None => None,
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
    persist_private_node_state(&state.private_node_state_path, &guard);
    to_status(&guard)
}

#[tauri::command]
fn start_private_node_mode(
    state: State<'_, AppState>,
    mode: String,
) -> Result<PrivateNodeStatus, String> {
    let peer_count = match mode.as_str() {
        "easy" => 4,
        "private" => 2,
        _ => return Err("invalid node mode".to_string()),
    };

    let mut guard = state.private_node.lock().expect("private node mutex poisoned");
    guard.online = true;
    guard.peer_count = peer_count;
    persist_private_node_state(&state.private_node_state_path, &guard);
    Ok(to_status(&guard))
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

#[tauri::command]
fn get_security_state(state: State<'_, AppState>) -> SecurityState {
    let guard = state
        .security_state
        .lock()
        .expect("security state mutex poisoned");
    guard.clone()
}

#[tauri::command]
fn set_security_state(
    state: State<'_, AppState>,
    identity_json: Option<String>,
    delegation_json: Option<String>,
    revocation_queue_json: Option<String>,
    audit_log_json: Option<String>,
    failed_flush_queue_json: Option<String>,
) {
    let mut guard = state
        .security_state
        .lock()
        .expect("security state mutex poisoned");
    guard.identity_json = normalize_json_string(identity_json);
    guard.delegation_json = normalize_json_string(delegation_json);
    guard.revocation_queue_json = normalize_json_string(revocation_queue_json);
    guard.audit_log_json = normalize_json_string(audit_log_json);
    guard.failed_flush_queue_json = normalize_json_string(failed_flush_queue_json);
    persist_security_state(&state.security_state_path, &guard);
}

#[tauri::command]
fn flush_revocation_queue(revocation_ids: Vec<String>) -> FlushRevocationResult {
    let mut flushed_ids: Vec<String> = Vec::new();
    let mut failed_ids: Vec<String> = Vec::new();
    for revocation_id in revocation_ids {
        let normalized = revocation_id.trim().to_string();
        if normalized.is_empty() {
            failed_ids.push("<empty>".to_string());
            continue;
        }
        if flushed_ids.iter().any(|existing| existing == &normalized) {
            failed_ids.push(normalized);
            continue;
        }
        if normalized.starts_with("fail-") {
            failed_ids.push(normalized);
            continue;
        }
        flushed_ids.push(normalized);
    }
    FlushRevocationResult {
        flushed_ids,
        failed_ids,
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let private_node_path = resolve_state_path(app.handle(), "private-node-state.json");
            let security_state_path = resolve_state_path(app.handle(), "security-state.json");
            let private_node = load_private_node_state(&private_node_path);
            let security_state = load_security_state(&security_state_path);
            app.manage(AppState {
                private_node: Mutex::new(private_node),
                private_node_state_path: private_node_path,
                security_state: Mutex::new(security_state),
                security_state_path,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            node_status,
            start_private_node,
            start_private_node_mode,
            stop_private_node,
            simulate_peer_join,
            get_security_state,
            set_security_state,
            flush_revocation_queue
        ])
        .run(tauri::generate_context!())
        .expect("error while running CIDFeed Tauri app");
}
