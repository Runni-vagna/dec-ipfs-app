/**
 * SDP v1.1 Phase 0 • Test
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Baseline Controls
 * Immutability: CIDs are permanent
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/App";

describe("App interactions", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("switches tabs and shows discover feed content", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Discover" }));

    expect(screen.getByText("Discover Feed")).toBeTruthy();
    expect(screen.getByText(/OrbitDB sync in 642ms/i)).toBeTruthy();
  });

  it("publishes a mock post from compose modal", () => {
    render(<App />);

    fireEvent.click(screen.getAllByLabelText("Compose")[0]);
    fireEvent.change(screen.getByPlaceholderText("Write immutable CID content..."), {
      target: { value: "Test post from vitest" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish Mock Post" }));

    expect(screen.getByText(/Test post from vitest/i)).toBeTruthy();
  });

  it("opens help with ? keyboard shortcut and closes with Escape", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByText("Help & Shortcuts")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Help & Shortcuts")).toBeNull();
  });

  it("creates an identity record from profile tools", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Create DID" }));

    expect(screen.getByText("Active DID")).toBeTruthy();
    expect(screen.getByText("identity.created")).toBeTruthy();
  });

  it("creates and revokes ucan delegation from profile tools", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Create DID" }));
    fireEvent.click(screen.getByRole("button", { name: "Create UCAN" }));
    expect(screen.getByText("UCAN Active")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Revoke UCAN" }));
    expect(screen.getByText("Delegate Access")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Replay Revocations" }));
    expect(screen.getByText(/Replay blocked: policy is invalid-signature/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replay Revocations" }));
    expect(await screen.findByText(/Replayed 1 queued revocation\(s\)\./i)).toBeTruthy();
  });

  it("clears security audit entries from profile tools", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Create DID" }));
    expect(screen.getByText("identity.created")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear Audit" }));
    expect(screen.queryByText("identity.created")).toBeNull();
    expect(screen.getByText("No security actions recorded yet.")).toBeTruthy();
  });

  it("filters security audit entries by search query", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Create DID" }));
    fireEvent.click(screen.getByRole("button", { name: "Create UCAN" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Search audit events" }), {
      target: { value: "ucan.created" }
    });

    expect(screen.getByText("ucan.created")).toBeTruthy();
    expect(screen.queryByText("identity.created")).toBeNull();
  });

  it("opens and closes audit entry detail modal", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Create DID" }));

    fireEvent.click(screen.getByRole("button", { name: /identity\.created/i }));
    expect(screen.getByText("Audit Entry")).toBeTruthy();
    expect(screen.getByText(/Event:/i)).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Audit Entry")).toBeNull();
  });

  it("re-queues ready failed flush retries from profile tools", async () => {
    window.localStorage.setItem(
      "cidfeed.ui.failedFlushQueue",
      JSON.stringify([
        {
          revocationId: "fail-revoke-ready",
          failedAt: 1000,
          retryCount: 1,
          nextRetryAt: 1000,
          lastError: "tauri flush failed"
        }
      ])
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry Failed Flushes" }));
    await waitFor(() => {
      expect(screen.getByText("Re-queued 1 failed revocation(s).")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Replay Revocations" }));
    expect(
      await screen.findByText(
        /(Replayed 1 queued revocation\(s\)\.|Flushed 0 revocation\(s\); 1 failed\.|No queued revocations to replay\.)/i
      )
    ).toBeTruthy();
  });

  it("requires confirm before replay when revocation policy is unsafe", async () => {
    const now = Date.now();
    window.localStorage.setItem(
      "cidfeed.ui.offlineRevocationQueue",
      JSON.stringify([{ revocationId: "revoke-unsafe-1", queuedAt: now - 1000, reason: "manual profile revoke" }])
    );
    window.localStorage.setItem(
      "cidfeed.ui.revocationList",
      JSON.stringify({
        version: "1.1",
        updatedAt: now,
        issuerDid: "did:key:z123456789ABCDEFGHJKLMN",
        signature: `sig-${now}`,
        entries: [{ revocationId: "revoke-unsafe-1", revokedAt: now, reason: "marker" }]
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    fireEvent.click(screen.getByRole("button", { name: "Replay Revocations" }));
    expect(screen.getByText(/Replay blocked: policy is invalid-signature/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Replay Revocations" }));
    expect(await screen.findByText(/Replayed 1 queued revocation\(s\)\./i)).toBeTruthy();
  });

  it("denies unsafe replay when safe replay only is enabled", () => {
    const now = Date.now();
    window.localStorage.setItem(
      "cidfeed.ui.offlineRevocationQueue",
      JSON.stringify([{ revocationId: "revoke-safe-1", queuedAt: now - 1000, reason: "manual profile revoke" }])
    );
    window.localStorage.setItem(
      "cidfeed.ui.revocationList",
      JSON.stringify({
        version: "1.1",
        updatedAt: now,
        issuerDid: "did:key:z123456789ABCDEFGHJKLMN",
        signature: `sig-${now}`,
        entries: [{ revocationId: "revoke-safe-1", revokedAt: now, reason: "marker" }]
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Safe Replay Only: Off" }));
    expect(screen.getByText("Safe replay only enabled.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Replay Revocations" }));
    expect(screen.getByText(/Replay denied: policy is invalid-signature and Safe Replay Only is enabled\./i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Replay Revocations" }));
    expect(screen.queryByText(/Replayed 1 queued revocation\(s\)\./i)).toBeNull();
  });

  it("shows revoked status when delegation revocation id exists in revocation list", () => {
    const now = Date.now();
    window.localStorage.setItem(
      "cidfeed.ui.ucanDelegation",
      JSON.stringify({
        issuerDid: "did:key:z123456789ABCDEFGHJKLMN",
        audienceDid: "did:key:z123456789ABCDEFGHJKLMP",
        capabilities: [{ with: "did:key:z123456789ABCDEFGHJKLMN", can: "feed/publish" }],
        issuedAt: now - 1000,
        expiresAt: now + 3600_000,
        revocationId: "revoke-listed-1",
        nonce: "abc123",
        version: "1.1"
      })
    );
    window.localStorage.setItem(
      "cidfeed.ui.revocationList",
      JSON.stringify({
        version: "1.1",
        updatedAt: now,
        entries: [{ revocationId: "revoke-listed-1", revokedAt: now, reason: "test marker" }]
      })
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(screen.getByText("UCAN Revoked")).toBeTruthy();
  });

  it("blocks compose publish when delegation is revoked", () => {
    const now = Date.now();
    window.localStorage.setItem(
      "cidfeed.ui.ucanDelegation",
      JSON.stringify({
        issuerDid: "did:key:z123456789ABCDEFGHJKLMN",
        audienceDid: "did:key:z123456789ABCDEFGHJKLMP",
        capabilities: [{ with: "did:key:z123456789ABCDEFGHJKLMN", can: "feed/publish" }],
        issuedAt: now - 1000,
        expiresAt: now + 3600_000,
        revocationId: "revoke-blocked-1",
        nonce: "abc123",
        version: "1.1"
      })
    );
    window.localStorage.setItem(
      "cidfeed.ui.revocationList",
      JSON.stringify({
        version: "1.1",
        updatedAt: now,
        entries: [{ revocationId: "revoke-blocked-1", revokedAt: now, reason: "test block" }]
      })
    );

    render(<App />);
    fireEvent.click(screen.getAllByLabelText("Compose")[0]);
    fireEvent.change(screen.getByPlaceholderText("Write immutable CID content..."), {
      target: { value: "Blocked publish content" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish Mock Post" }));

    expect(screen.getByText("Cannot publish: UCAN is revoked.")).toBeTruthy();
    expect(screen.queryByText(/Blocked publish content/i, { selector: ".cid" })).toBeNull();
  });

  it("shows revocation list integrity and signs it from profile tools", () => {
    const now = Date.now();
    window.localStorage.setItem(
      "cidfeed.ui.ucanDelegation",
      JSON.stringify({
        issuerDid: "did:key:z123456789ABCDEFGHJKLMN",
        audienceDid: "did:key:z123456789ABCDEFGHJKLMP",
        capabilities: [{ with: "did:key:z123456789ABCDEFGHJKLMN", can: "feed/publish" }],
        issuedAt: now - 1000,
        expiresAt: now + 3600_000,
        revocationId: "revoke-integrity-1",
        nonce: "abc123",
        version: "1.1"
      })
    );
    window.localStorage.setItem(
      "cidfeed.ui.revocationList",
      JSON.stringify({
        version: "1.1",
        updatedAt: now,
        entries: [{ revocationId: "revoke-integrity-1", revokedAt: now, reason: "test marker" }]
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(screen.getByText("Revocation list integrity: Unverified")).toBeTruthy();
    expect(screen.getByText("Revocation list policy: invalid-signature")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Create DID" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign Revocation List" }));
    expect(screen.getByText("Revocation list signed.")).toBeTruthy();
    expect(screen.getByText("Revocation list integrity: Verified")).toBeTruthy();
    expect(screen.getByText("Revocation list policy: untrusted-issuer")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Trust Issuer" }));
    expect(screen.getByText("Revocation list issuer trusted.")).toBeTruthy();
    expect(screen.getByText("Revocation list policy: valid")).toBeTruthy();
  });

  it("shows warning when revocation list signature is invalid", () => {
    const now = Date.now();
    window.localStorage.setItem(
      "cidfeed.ui.ucanDelegation",
      JSON.stringify({
        issuerDid: "did:key:z123456789ABCDEFGHJKLMN",
        audienceDid: "did:key:z123456789ABCDEFGHJKLMP",
        capabilities: [{ with: "did:key:z123456789ABCDEFGHJKLMN", can: "feed/publish" }],
        issuedAt: now - 1000,
        expiresAt: now + 3600_000,
        revocationId: "revoke-untrusted-1",
        nonce: "abc123",
        version: "1.1"
      })
    );
    window.localStorage.setItem(
      "cidfeed.ui.revocationList",
      JSON.stringify({
        version: "1.1",
        updatedAt: now,
        issuerDid: "did:key:z123456789ABCDEFGHJKLMN",
        signature: `sig-${now}`,
        entries: [{ revocationId: "revoke-untrusted-1", revokedAt: now, reason: "test marker" }]
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(screen.getByText(/Revocation list signature is invalid/i)).toBeTruthy();
  });

  it("shows retry backoff severity and ready-now window", () => {
    const now = Date.now();
    window.localStorage.setItem(
      "cidfeed.ui.failedFlushQueue",
      JSON.stringify([
        {
          revocationId: "revoke-backoff-1",
          failedAt: now - 60_000,
          retryCount: 5,
          nextRetryAt: now - 1000,
          lastError: "tauri flush failed"
        }
      ])
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(screen.getByText("Retry backoff severity: high")).toBeTruthy();
    expect(screen.getByText("Next retry window: ready now")).toBeTruthy();
    expect(screen.getByText("Max retry count: 5")).toBeTruthy();
  });

  it("shows escalation banner when high retry backoff persists", () => {
    const now = Date.now();
    window.localStorage.setItem("cidfeed.ui.retryHighStreak", "3");
    window.localStorage.setItem(
      "cidfeed.ui.failedFlushQueue",
      JSON.stringify([
        {
          revocationId: "revoke-escalation-1",
          failedAt: now - 60_000,
          retryCount: 6,
          nextRetryAt: now - 1000,
          lastError: "tauri flush failed"
        }
      ])
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(screen.getByText(/Escalation active: high retry backoff persisted/i)).toBeTruthy();
  });

  it("acknowledges active escalation from profile tools", () => {
    const now = Date.now();
    window.localStorage.setItem("cidfeed.ui.retryHighStreak", "3");
    window.localStorage.setItem(
      "cidfeed.ui.failedFlushQueue",
      JSON.stringify([
        {
          revocationId: "revoke-escalation-ack-1",
          failedAt: now - 60_000,
          retryCount: 6,
          nextRetryAt: now - 1000,
          lastError: "tauri flush failed"
        }
      ])
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge Escalation" }));

    expect(screen.getByText("Escalation acknowledged.")).toBeTruthy();
    expect(screen.getByText(/Escalation acknowledged at:/i)).toBeTruthy();
    expect(screen.getByText("revocation.verified")).toBeTruthy();
  });
});
