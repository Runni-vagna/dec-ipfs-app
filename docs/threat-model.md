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
