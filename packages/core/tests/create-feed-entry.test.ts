/**
 * SDP v1.1 Phase 0 • Test
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Baseline Controls
 * Immutability: CIDs are permanent
 */

import { describe, expect, it } from "vitest";
import { createFeedEntry } from "../src";

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
