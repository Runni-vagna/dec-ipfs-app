/**
 * SDP v1.1 Phase 0 • Test
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Baseline Controls
 * Immutability: CIDs are permanent
 */

import { describe, expect, it } from "vitest";
import { createDraftPost, createFeedEntry, createLocalCID } from "../src";

describe("createFeedEntry", () => {
  it("returns an immutable feed entry shape with version 1.1", () => {
    const entry = createFeedEntry("bafybeigdyrzt");

    expect(entry.postCID).toBe("bafybeigdyrzt");
    expect(entry.version).toBe("1.1");
    expect(typeof entry.timestamp).toBe("number");
  });

  it("uses explicit timestamp when provided", () => {
    const entry = createFeedEntry("bafycustomcid", 1700000000000);

    expect(entry.timestamp).toBe(1700000000000);
  });

  it("rejects empty or whitespace-only CIDs", () => {
    expect(() => createFeedEntry("")).toThrow("postCID must be a non-empty string");
    expect(() => createFeedEntry("   ")).toThrow("postCID must be a non-empty string");
  });
});

describe("createLocalCID", () => {
  it("creates deterministic cid for identical content and timestamp", () => {
    const first = createLocalCID("hello", 1700000000000);
    const second = createLocalCID("hello", 1700000000000);
    expect(first).toBe(second);
    expect(first.startsWith("bafy")).toBe(true);
  });

  it("rejects empty content", () => {
    expect(() => createLocalCID("   ")).toThrow("content must be a non-empty string");
  });
});

describe("createDraftPost", () => {
  it("returns post object with feed entry", () => {
    const post = createDraftPost("  ship it  ", "main", 1700000000010);
    expect(post.body).toBe("ship it");
    expect(post.tag).toBe("main");
    expect(post.timestamp).toBe(1700000000010);
    expect(post.cid.startsWith("bafy")).toBe(true);
    expect(post.entry.postCID).toBe(post.cid);
    expect(post.entry.version).toBe("1.1");
  });
});
