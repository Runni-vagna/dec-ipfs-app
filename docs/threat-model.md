# Threat Model (SDP v1.1)

## Scope

CIDFeed identity, feed publication, replication, and private-swarm onboarding.

## Primary Assets

- DID private keys
- UCAN delegation chains
- Private swarm configuration (`swarm.key`)
- Feed integrity (`postCID`, timestamps, version)

## Threats

- Delegation abuse from over-broad UCAN capabilities
- Phishing and malicious DID/CID links
- Key exfiltration from local disk or logs
- Revocation desync while offline
- Eclipse/sybil-style replication interference in open swarms

## Baseline Controls

- UCANs must include expiry and revocation reference
- No key material in source, bundles, or logs
- Input validation on CID/DID/UCAN values before processing
- Private swarm secrets are local-only and never transmitted by default
- Offline revocation queue persisted and replayed on reconnect

## UCAN Scaffold Status (Phase 1)

- Core library now enforces delegation TTL bounds and requires non-empty revocation IDs.
- Delegation payload parser rejects malformed DID/capability/version/expiry fields.
- Offline revocation queue primitives exist for local persistence + replay on reconnect.
- Revocation-list verification path now exists in core (`active`/`expired`/`revoked`) and is surfaced in UI profile status.
- Revocation list state is persisted via Tauri security-state bridge for offline integrity checks.
- Compose publish flow now blocks when delegation verification returns `revoked` or `expired`.
- Revocation-list signing and integrity verification scaffolding added (`issuerDid` + deterministic signature check) with profile controls to sign/verify list state.
- Trust policy added for revocation-list issuer verification (`valid` / `untrusted-issuer` / `invalid-signature`) with explicit issuer trust controls in profile.
- Profile now surfaces security warnings when revocation policy is unsafe (`invalid-signature`/`untrusted-issuer`) or replay queues accumulate.
- Profile now surfaces retry backoff severity and next retry window to reduce stale offline revocation state.
- Escalation banner now activates after repeated high-severity retry intervals to force operator attention on replay path degradation.
- Escalation acknowledgement is now explicitly captured in local state and audit log for operator accountability.
- Replay operation now enforces an explicit unsafe confirmation step when revocation policy is not `valid`.
