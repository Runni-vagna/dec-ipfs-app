# CIDFeed Risk Register

Last updated: 2026-02-19

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R1 | Key loss prevents account recovery | Medium | High | Recovery-kit flow, key rotation education, backup prompts | Security | Open |
| R2 | OrbitDB replication edge cases under churn | Medium | High | libp2p chaos test suite in CI, replay tests | Core/Test | Open |
| R3 | Storacha pinning costs exceed budget | Medium | Medium | Cost dashboard, pin policy controls, alerts | Core | Open |
| R4 | Public discoverability adoption remains low | Medium | Medium | Opt-in directory UX + launch content plan | UI/Docs | Open |
| R5 | Pre-release audit finds critical issues | Low | High | Phase-5 hardening buffer and external audit window | Security | Open |
| R6 | Offline revocation replay backlog causes stale trust state | Medium | High | Profile warnings for queue backlog, periodic replay prompts, flush retry queue with backoff | Security/Core/UI | Open |
| R7 | Revocation list accepted from untrusted issuer | Medium | High | Explicit trusted issuer list, policy status UI (`valid`/`untrusted-issuer`), manual trust controls | Security/UI | Open |
| R8 | Revocation list tampering undetected in local storage | Low | High | Deterministic revocation-list signature verification and invalid-signature warnings before use | Security/Core | Open |
