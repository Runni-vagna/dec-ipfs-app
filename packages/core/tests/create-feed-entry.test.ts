/**
 * SDP v1.1 Phase 0 • Test
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Baseline Controls
 * Immutability: CIDs are permanent
 */

import { describe, expect, it } from "vitest";
import {
  createDraftPost,
  createFeedEntry,
  createLocalCID,
  filterFeedPosts,
  prependFeedPost,
  removeFeedPost,
  restoreFeedPost,
  toFeedPost,
  toggleFlag
} from "../src";

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

describe("feed helpers", () => {
  it("prepends feed post using draft conversion", () => {
    const first = toFeedPost(createDraftPost("first", "main", 100));
    const second = toFeedPost(createDraftPost("second", "main", 200));
    const next = prependFeedPost([first], second);

    expect(next[0]?.body).toBe("second");
    expect(next[1]?.body).toBe("first");
  });

  it("removes and restores feed posts", () => {
    const one = toFeedPost(createDraftPost("one", "main", 100));
    const two = toFeedPost(createDraftPost("two", "discover", 200));
    const three = toFeedPost(createDraftPost("three", "main", 300));
    const posts = [one, two, three];

    const removed = removeFeedPost(posts, two);
    expect(removed.posts).toHaveLength(2);
    expect(removed.removed?.post.body).toBe("two");

    if (!removed.removed) {
      throw new Error("snapshot missing");
    }
    const restored = restoreFeedPost(removed.posts, removed.removed);
    expect(restored).toHaveLength(3);
    expect(restored[1]?.body).toBe("two");
  });

  it("toggles flags and filters posts", () => {
    const a = toFeedPost(createDraftPost("alpha", "main", 100));
    const b = toFeedPost(createDraftPost("bravo node", "discover", 200));
    const c = toFeedPost(createDraftPost("charlie", "main", 300));
    const posts = [a, b, c];

    const pinned = toggleFlag({}, a.cid);
    expect(pinned[a.cid]).toBe(true);

    const filteredByTab = filterFeedPosts(posts, "main", "", false, {});
    expect(filteredByTab).toHaveLength(2);

    const filteredPinned = filterFeedPosts(posts, "main", "", true, pinned);
    expect(filteredPinned).toHaveLength(1);
    expect(filteredPinned[0]?.cid).toBe(a.cid);

    const filteredQuery = filterFeedPosts(posts, "discover", "node", false, {});
    expect(filteredQuery).toHaveLength(1);
    expect(filteredQuery[0]?.cid).toBe(b.cid);
  });
});
