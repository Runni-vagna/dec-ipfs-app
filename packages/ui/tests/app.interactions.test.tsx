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
    expect(screen.queryByText(/Blocked publish content/i)).toBeNull();
  });
});
