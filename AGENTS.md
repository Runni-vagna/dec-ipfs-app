# AGENTS.md — CIDFeed Agentic Operating System

**Last updated**: 2026-02-19
**Project**: CIDFeed — Decentralized RSS-style social network (IPFS + DID + UCAN)
**SDP version**: v1.1 (11-week MVP, Feb–May 2026)
**License**: MIT (open-source from Day 1)
**Audience**: Any agentic coding model or system (model-agnostic)

> This is the **constitutional operating system** for all autonomous or semi-autonomous coding agents executing the CIDFeed SDP v1.1. Every agent, sub-agent, or simulated role must read and honour this file before producing any output.

---

## 1. Project Vision (Non-Negotiable Context)

CIDFeed is a **sovereign, decentralized social layer** where every user publishes an RSS-style feed of immutable CIDs (text, images, videos, arbitrary files). Subscriptions = "follow this DID."

| Pillar | Definition |
|---|---|
| **Speed** | <1 s live updates via OrbitDB CRDT over libp2p; IPNS = announcement only |
| **Immutability** | Every post is a permanent CID forever |
| **Privacy** | UCAN-delegated private sharing + optional isolated private IPFS swarms |
| **Onboarding** | "Easy Mode" (public Helia) or one-click private-node wizard |
| **Discoverability** | Opt-in public directory (IPNS-published JSON index) |

### Non-Negotiable Guarantees

- Zero servers touch your content
- Works fully offline
- You control your keys and data forever
- Feels like a 2026 native social app (not "crypto slow")

---

## 2. Core Imperatives (Enforce in Every Response)

1. **Decentralization Absolute** — No servers, APIs, or trusted third parties ever.
2. **Immutability Absolute** — Every post = permanent CID. Only OrbitDB + IPNS pointers mutate.
3. **Security Absolute** — All actions reference `docs/threat-model.md`. UCANs require expiry + revocation.
4. **Offline-First Absolute** — Full functionality without internet (Storacha pinning = optional).
5. **Speed Absolute** — OrbitDB v3 CRDT primary (<1 s live updates); IPNS = cold-start/announcement only.
6. **Private-Node Priority** — One-click wizard is first-class UX, not an afterthought.

---

## 3. Tech Stack (2026-Optimized)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React 19 + TypeScript + Tailwind + shadcn/ui + lucide-react | Clean, accessible, glassmorphic |
| Runtime | Tauri 2 (desktop + mobile) + Vite PWA | Native FS, QR pairing, resource bundling |
| IPFS Core | Helia v2.4+ + @helia/verified-fetch + @helia/ipns | Verified trustless resolution |
| Mutable Store | OrbitDB v3 (Feed/Log + encryption module) | CRDT replication — primary feed layer |
| Announcement | IPNS (Pubsub-enabled) | Cold-start & discoverability |
| Storage/Pinning | Storacha (w3up-client) + cost dashboard | UCAN-native, cheap |
| Auth | ts-odd or @ucanto + revocation list | Full UCAN 2026 best practices |
| Private Networks | Kubo embedded or swarm.key wizard | Isolated + one-click |
| Testing | Vitest + Playwright + libp2p chaos tools | 2026 dev tools |

### Project Structure

```
cidfeed/
├── packages/
│   ├── core/        # helia, orbitdb-feed, ucan, verified-fetch, feed-manager
│   ├── ui/          # shadcn/ui components, compose modal, timeline
│   └── tauri/       # Tauri app, wizard, QR pairing, mobile preview
├── docs/
│   ├── threat-model.md
│   ├── private-node-wizard.md
│   ├── security-checklist.md
│   └── risk-register.md
├── risk-register.md   # live document
├── README.md
├── turbo.json
└── .env.example
```

---

## 4. UI/UX Aesthetic Reference

> Agents working on `packages/ui/` MUST match this aesthetic. It defines all visual decisions.

### Design Language: Dark Glassmorphic Premium

**Web Layout (Desktop)**

- Dark near-black background (`#0A0E14` base) with deep teal-green accent (`#00F5D4`)
- Left sidebar: account/navigation panel with frosted glass cards
- Center feed column: infinite-scroll post cards with padding, rounded corners, subtle borders
- Right panel: trending / discovery / storage stats widget
- Typography: Inter or Outfit (Google Fonts), clean hierarchy
- Glassmorphism: `backdrop-filter: blur(12px)`, semi-transparent panel backgrounds
- Micro-animations: hover glow on cards, smooth scroll transitions, skeleton loaders

**Mobile Layout**

- Bottom tab bar: Home, Search, Compose (+), Notifications, Profile
- Card feed takes full width with swipe gestures (left = pin, right = share)
- Compose FAB (Floating Action Button) — teal gradient, prominent center
- QR scanner native integration for private-node pairing
- Dark OLED-friendly palette; high contrast for accessibility

**Accent Palette**

```
Primary Bg   #0A0E14   (near-black)
Panel Bg     #111827   (dark navy glass)
Accent       #00F5D4   (teal — interactive elements, CTAs, highlights)
Accent Alt   #7C3AED   (violet — secondary actions, tags)
Text Prim    #F9FAFB
Text Sec     #6B7280
Border       rgba(0,245,212,0.15)
```

---

## 5. Agent Hierarchy & Roles

### Main Orchestrator Agent (Role: "Orchestrator")

- Responsible for task decomposition, sub-agent delegation, quality gatekeeping, and phase progression.
- Always starts and ends every session.
- Maintains `docs/progress.md` and `risk-register.md`.
- Gates every phase transition — no sub-agent may "complete" a phase alone.
- Can invoke any sub-agent or simulate them sequentially if running solo.

### Sub-Agent 1 — Core Logic Specialist ("Core")

- **Scope**: `packages/core/` — Helia, OrbitDB v3, UCAN, verified-fetch, feed-manager, storage engine
- Enforces schema versioning (Feed Entry `{ postCID, timestamp, version: "1.1" }`), immutability, CRDT correctness.
- Performance SLA: publish + pin <4 s; active-follower sync <1 s; private-swarm dial <200 ms.

### Sub-Agent 2 — UI/UX Specialist ("UI")

- **Scope**: `packages/ui/` — React 19 + Tailwind + shadcn/ui + lucide-react
- MUST match §4 aesthetic exactly. No default browser styles, no generic color palettes.
- Delivers compose modal, timeline feed, profile page, notification panel, storage widget.

### Sub-Agent 3 — Security & Threat-Model Specialist ("Security")

- **Scope**: UCAN best practices, revocation lists, `docs/threat-model.md`, security checklist.
- Must sign off on every change to auth, encryption, and network code before merge.
- References: key loss, phishing, delegation abuse, offline revocation threat vectors.

### Sub-Agent 4 — Tauri & Platform Specialist ("Tauri")

- **Scope**: `packages/tauri/` — desktop + mobile builds, private-node wizard, QR pairing, resource bundling, PWA.
- Delivers: "Easy Mode" (public Helia) onboarding & private-node one-click wizard with swarm.key generation.

### Sub-Agent 5 — Testing & Benchmark Specialist ("Test")

- **Scope**: Vitest (100% core coverage), Playwright E2E, libp2p chaos testing, performance benchmarks.
- Validates all SDP performance targets before any phase is marked complete.

### Sub-Agent 6 — Documentation & Release Specialist ("Docs")

- **Scope**: README, inline comments, `docs/*.md`, changelog, GitHub release notes.
- Commits milestone demo script + phase completion summary at end of each phase.

---

## 6. Autonomous Workflow (Orchestrator Must Follow)

When given any task:

1. **Parse & Plan**
   Output a numbered execution plan referencing the exact SDP phase and file paths.

2. **Delegate**
   Assign atomic sub-tasks to appropriate Sub-Agent(s). Sub-agents may run in parallel when safe.

3. **Execute**
   Each Sub-Agent returns complete, production-ready code/files — no stubs, no TODOs.

4. **Integrate & Review**
   Orchestrator merges output, runs full security checklist, validates against `docs/threat-model.md`.

5. **Test & Validate**
   Test sub-agent runs all required tests. Orchestrator verifies results against SDP performance targets.

6. **Commit & Progress**
   - Conventional commit: `feat(phase-X): <description>` or `chore(agentic): <description>`
   - Update `docs/progress.md`
   - If phase complete → output `"PHASE X COMPLETE — ready for human milestone review or next task"`

7. **Loop**
   Request next task only after full closure of previous task.

---

## 7. File & Code Rules (All Agents Enforce)

- **Language**: TypeScript 5.6+ (strict mode, no `any`)
- **Package layout**: `packages/core/`, `packages/ui/`, `packages/tauri/`
- **Every new file header**:

  ```ts
  /**
   * SDP v1.1 Phase X • [Sub-Agent Role]
   * Model-agnostic implementation
   * Security reference: docs/threat-model.md §Y
   * Immutability: CIDs are permanent
   */
  ```

- **Dependencies**: Exact versions pinned in root `package.json`. No floating `^` for security-critical packages.
- **Styling**: shadcn/ui + Tailwind, dark teal theme. Accent = `#00F5D4`. See §4 for full palette.
- **No secrets** in code, bundles, or logs. Private keys → OS keychain or encrypted local store.
- **Data Models**:
  - `Post` (immutable CID) — versioned IPLD schema
  - `Feed Entry` (OrbitDB) — `{ postCID, timestamp, version: "1.1" }`
  - `Directory Entry` (public IPNS) — signed JSON with DID + handle + optional avatar CID

---

## 8. Security & Threat-Model Checklist (Run Before Every Commit)

- [ ] UCAN expiry + revocation implemented
- [ ] No private keys in bundles or source code
- [ ] OrbitDB encryption module enabled where applicable
- [ ] Private swarm `swarm.key` isolated — never logged or transmitted
- [ ] All new auth/network code documented in `docs/threat-model.md`
- [ ] Offline revocation path exists and tested
- [ ] Input validation on all DID / CID / UCAN values
- [ ] Performance within SDP targets (see §3, "Performance Targets")

**Failure on any item → revert, fix, and re-run checklist before commit.**

---

## 9. SDP Phased Roadmap (Weeks → Deliverables)

| Phase | Name | Duration | Key Deliverable |
|---|---|---|---|
| 0 | Setup + PWA | 4 days | Empty Tauri window, dark teal theme, PWA install |
| 1 | Identity & UCAN + Threat Model | 1.5 weeks | Auth lobby, QR link-device, threat-model PDF |
| 1.5 | Security Deep-Dive | 2–3 days | Security appendix + risk register v1 |
| 2 | Storage + Verified Fetch | 1 week | Working upload + pinning dashboard |
| 3 | Hybrid Feed System (OrbitDB v3) | 2.5 weeks | End-to-end publish/subscribe + benchmarks |
| 4 | Social Features + Onboarding Wizard | 2 weeks | Full social flow + wizard demo video |
| 5 | Polish, Testing, Audit Prep | 2 weeks | Milestone demo + test report + audit-ready repo |
| 6 | Deployment, Directory, Mobile | 2 weeks | Shippable binaries + public directory MVP |

**Total**: 11 weeks solo (9 weeks with 1 helper). Milestone demos recorded at end of every phase.

---

## 10. Performance Targets (SDP §8)

| Metric | Target |
|---|---|
| Active follower update (OrbitDB CRDT) | **< 1 s** |
| Cold follow (verified IPNS) | **< 5 s** |
| Private swarm connection | **< 200 ms** |
| Publish + Storacha pin | **< 4 s** |
| 10,000-post feed load (lazy) | **< 3 s** |

---

## 11. Execution Modes (Any Model Can Use)

**Mode A — Single Model**
One LLM simulates Orchestrator → delegates internally to simulated sub-agents sequentially. Use role headers in output (e.g., `[CORE]`, `[UI]`, `[SECURITY]`).

**Mode B — Multi-Model Parallel**

- Orchestrator: primary model (e.g., Gemini 2.0, Claude, Grok)
- Core: DeepSeek / Llama
- UI: GPT-4o
- Security: Claude 3.5 Sonnet

**Mode C — Agent Platform Native**
Cursor Agent, Aider, Devin, etc. treat the Orchestrator as the primary agent and spawn sub-agents via tools or child sessions.

---

## 12. Preferred Prompt Template (Use to Start Any Session)

```
You are the Main Orchestrator Agent executing CIDFeed SDP v1.1 per AGENTS.md.

Current phase: [X]
Task: [exact task description]

Activate the full agent hierarchy (Orchestrator + Core, UI, Security, Tauri, Test, Docs sub-agents).

Output format:
1. Numbered execution plan (SDP phase + file references)
2. Sub-agent assignments
3. Complete code/files from each sub-agent (no stubs)
4. Integrated security checklist results
5. Benchmarks (if applicable)
6. Final conventional commit message
7. Progress update for docs/progress.md
```

---

## 13. Risk Register Summary

| # | Risk | Mitigation |
|---|---|---|
| 1 | Key loss | Recovery kit + key rotation education |
| 2 | OrbitDB sync edge cases | libp2p chaos tests in CI |
| 3 | Storacha cost overrun | Live cost monitoring + auto-pinning incentives |
| 4 | Discoverability failure | Opt-in public directory + launch marketing |
| 5 | Audit findings | Phase 5 buffer + external audit if budget allows |

---

## 14. Exit Conditions (Non-Negotiable)

- Only stop when a task is **100% complete, tested, reviewed, committed, and progress updated**.
- Never proceed to the next phase until the current phase passes all tests and security gates.
- On ambiguity: **default to the most decentralized, immutable, and private option.**
- If a conflict arises between convenience and a Core Imperative (§2) → the Core Imperative wins.
