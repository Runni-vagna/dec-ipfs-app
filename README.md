# CIDFeed

Decentralized RSS-style social network (IPFS + DID + UCAN) following SDP v1.1.

## Current Milestone

Phase 0 (Setup + PWA) baseline is initialized with:

- Turbo monorepo (`packages/core`, `packages/ui`, `packages/tauri`)
- React 19 + Vite PWA shell in `packages/ui`
- Tauri 2 desktop wrapper in `packages/tauri/src-tauri`
- Security and threat-model docs under `docs/`

## Run

```bash
pnpm install
pnpm dev:ui
# or desktop shell
pnpm dev:tauri
```

## Environment Notes (Linux)

- Node.js 22+ is required.
- Tauri Linux builds require system WebKitGTK/JavascriptCoreGTK development packages (`webkit2gtk-4.1`, `javascriptcoregtk-4.1`) available to `pkg-config`.
- In containerized runtimes (like Flatpak SDK shells), desktop bundling may fail unless those host packages are mounted/installed.

## Security

- `docs/threat-model.md`
- `docs/security-checklist.md`
- `risk-register.md`
