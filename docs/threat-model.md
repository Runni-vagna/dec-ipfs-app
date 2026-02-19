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
