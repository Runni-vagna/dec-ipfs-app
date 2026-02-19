# Progress Log

## 2026-02-19

- Initialized repository scaffold from `AGENTS.md`.
- Created monorepo layout: `packages/core`, `packages/ui`, `packages/tauri`.
- Added baseline governance docs and risk register.
- Implemented Phase 0 runnable baseline:
  - `packages/ui` migrated to React 19 + Vite + Tailwind + PWA manifest/service worker.
  - Dark glassmorphic desktop/mobile shell aligned to inspiration references.
  - `packages/tauri` wired with Tauri 2 config to host UI dev/build output.
- Validation status:
  - `pnpm install`: pass
  - `pnpm --filter @cidfeed/ui build`: pass
  - `pnpm typecheck`: pass
  - `pnpm build`: blocked only at `@cidfeed/tauri` due missing `javascriptcoregtk-4.1`/`webkit2gtk-4.1` system libs in current runtime.
- CI added:
  - `.github/workflows/ci.yml` created with two jobs:
    - workspace checks (`typecheck`, `@cidfeed/core build`, `@cidfeed/ui build`)
    - Linux Tauri build with WebKitGTK dependencies installed on runner
- CI hardening (after first public run):
  - expanded Linux Tauri dependency install list (`build-essential`, `pkg-config`, `libssl-dev`, `libglib2.0-dev`, `libxdo-dev`)
  - added `tauri-build.log` artifact upload (`if: always()`) for actionable failure diagnostics
- Integrated shared feed-domain utilities from `packages/core` into the UI publish flow:
  - added deterministic local CID generation utility in `packages/core/src/index.ts`
  - added draft-post builder aligned with feed entry schema v1.1
  - wired `packages/ui/src/App.tsx` compose publish action to use core-generated CID + timestamp instead of ad-hoc UI-only IDs
  - expanded core test coverage to include CID generation and draft-post creation
- Validation status (latest):
  - `pnpm test`: pass
  - `pnpm typecheck`: pass
- Added first UI -> Tauri command bridge for private-node controls:
  - new UI adapter: `packages/ui/src/tauri-private-node.ts` (web fallback + Tauri invoke path)
  - wired private-node start/stop/status/peer-join controls in `packages/ui/src/App.tsx`
  - implemented Tauri command handlers + shared in-memory state in `packages/tauri/src-tauri/src/main.rs`
  - pinned UI dependency: `@tauri-apps/api` for command invocation
- Runtime caveat (local environment): Tauri Rust build/check still requires Linux WebKitGTK/JSC system packages (`webkit2gtk-4.1`, `javascriptcoregtk-4.1`) before full native compile can pass.
- Consolidated feed interaction logic into shared core domain helpers:
  - added reusable operations in `packages/core/src/index.ts` for post conversion, prepend, filter, remove/restore, and boolean flag toggles
  - updated UI feed actions in `packages/ui/src/App.tsx` to call core helpers for publish/filter/pin/follow/remove/undo
  - expanded core tests to cover these flows (`9` tests passing in core suite)
- Consolidated profile-state import/export/reset logic into core domain helpers:
  - added active-tab parsing + feed UI state/snapshot helpers in `packages/core/src/index.ts`
  - added strict JSON import parser with fallback behavior for invalid or empty post payloads
  - updated `packages/ui/src/App.tsx` profile tools to call shared core state helpers instead of direct UI JSON handling
  - expanded core tests for snapshot serialization and import/reset behavior (`12` tests passing in core suite)
- Added persistent private-node runtime state in Tauri shell:
  - `packages/tauri/src-tauri/src/main.rs` now loads initial private-node state from app data (`private-node-state.json`)
  - start/stop/peer-join commands persist updated state to disk after each mutation
  - app startup restores previous node online/peer count values for UI status sync
- Wired wizard onboarding modes to real Tauri command paths:
  - added `start_private_node_mode` command in `packages/tauri/src-tauri/src/main.rs` with strict mode validation (`easy`/`private`)
  - extended `packages/ui/src/tauri-private-node.ts` with mode-aware invoke helper
  - updated wizard "Quick Start" and "Finish & Start Node" in `packages/ui/src/App.tsx` to call mode-specific node start command with web fallback

### Phase Tracking

- Phase 0: In progress
- Next checkpoint: confirm GitHub Actions green on both jobs, then run local `pnpm dev:tauri` on host desktop for manual Phase 0 sign-off.
