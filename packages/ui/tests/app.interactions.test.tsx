/**
 * SDP v1.1 Phase 0 • Test
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Baseline Controls
 * Immutability: CIDs are permanent
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
