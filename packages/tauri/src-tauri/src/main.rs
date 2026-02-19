// SDP v1.1 Phase 0 • Tauri
// Model-agnostic implementation
// Security reference: docs/threat-model.md §Baseline Controls
// Immutability: CIDs are permanent

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running CIDFeed Tauri app");
}
