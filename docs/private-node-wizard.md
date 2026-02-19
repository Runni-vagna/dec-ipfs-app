# Private Node Wizard

## Goal

One-click flow to create an isolated private swarm and connect additional devices via QR pairing.

## Baseline Steps

1. Choose `Easy Mode` or `Private Node`.
2. Generate private swarm configuration and local key material.
3. Start embedded node with private networking enabled.
4. Pair a second device using a time-boxed QR payload.
5. Validate replication and private feed visibility.

## Guardrails

- Never print `swarm.key` in logs/UI.
- Pairing payloads expire quickly and are one-time use.
- Device trust confirmations are explicit.
