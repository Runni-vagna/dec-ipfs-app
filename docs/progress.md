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

### Phase Tracking

- Phase 0: In progress
- Next checkpoint: confirm GitHub Actions green on both jobs, then run local `pnpm dev:tauri` on host desktop for manual Phase 0 sign-off.
