/**
 * SDP v1.1 Phase 0 • Test
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Baseline Controls
 * Immutability: CIDs are permanent
 */

import { describe, expect, it } from "vitest";
import {
  appendSecurityAuditEntry,
  createOfflineRevocationEntry,
  createRevocationId,
  createSecurityAuditEntry,
  createUcanDelegation,
  createIdentityRecord,
  createFeedStateSnapshot,
  createResetFeedState,
  createDraftPost,
  createFeedEntry,
  createLocalCID,
  enqueueOfflineRevocation,
  filterFeedPosts,
  formatDidHandle,
  getUcanRemainingMs,
  isUcanDelegationExpiringSoon,
  isUcanDelegationExpired,
  isValidDidKey,
  parseOfflineRevocationQueue,
  parseFailedRevocationRetries,
  parseSecurityAuditLog,
  replayOfflineRevocations,
  parseIdentityRecord,
  parseActiveTab,
  parseUcanDelegation,
  parseImportedFeedState,
  prependFeedPost,
  removeFeedPost,
  removeFailedRetries,
  restoreFeedPost,
  serializeFailedRevocationRetries,
  serializeOfflineRevocationQueue,
  serializeSecurityAuditLog,
  serializeIdentityRecord,
  serializeUcanDelegation,
  serializeFeedStateSnapshot,
  splitReadyFailedRetries,
  toFeedPost,
  toggleFlag,
  upsertFailedRevocationRetries
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

describe("feed state serialization", () => {
  const defaults = [toFeedPost(createDraftPost("default", "main", 100))];

  it("creates reset state and parses active tab safely", () => {
    const state = createResetFeedState(defaults);
    expect(state.activeTab).toBe("main");
    expect(state.posts).toHaveLength(1);
    expect(parseActiveTab("alerts")).toBe("alerts");
    expect(parseActiveTab("all")).toBe("main");
    expect(parseActiveTab(null)).toBe("main");
  });

  it("serializes and parses imported snapshot", () => {
    const state = {
      activeTab: "discover" as const,
      unreadAlerts: 3,
      followedCids: { abc: true },
      pinnedCids: { def: true },
      posts: [toFeedPost(createDraftPost("imported", "discover", 200))]
    };
    const snapshot = createFeedStateSnapshot(state, "2026-02-19T00:00:00.000Z");
    const raw = serializeFeedStateSnapshot(snapshot);
    const parsed = parseImportedFeedState(raw, defaults);

    expect(parsed.activeTab).toBe("discover");
    expect(parsed.unreadAlerts).toBe(3);
    expect(parsed.followedCids.abc).toBe(true);
    expect(parsed.pinnedCids.def).toBe(true);
    expect(parsed.posts[0]?.body).toBe("imported");
  });

  it("falls back to defaults and rejects invalid json", () => {
    const parsed = parseImportedFeedState(
      JSON.stringify({
        activeTab: "main",
        unreadAlerts: -2,
        followedCids: { ok: true, nope: "x" },
        pinnedCids: { p1: true, p2: 1 },
        posts: [{ bad: true }]
      }),
      defaults
    );

    expect(parsed.unreadAlerts).toBe(0);
    expect(parsed.followedCids.ok).toBe(true);
    expect(parsed.pinnedCids.p1).toBe(true);
    expect(parsed.posts[0]?.body).toBe("default");
    expect(() => parseImportedFeedState("not json", defaults)).toThrow("Import failed: invalid JSON.");
  });
});

describe("identity helpers", () => {
  it("creates a valid did:key identity record", () => {
    const identity = createIdentityRecord(1700000000000);
    expect(isValidDidKey(identity.did)).toBe(true);
    expect(identity.createdAt).toBe("2023-11-14T22:13:20.000Z");
  });

  it("serializes and parses identity", () => {
    const identity = createIdentityRecord(1700000000000);
    const raw = serializeIdentityRecord(identity);
    const parsed = parseIdentityRecord(raw);
    expect(parsed?.did).toBe(identity.did);
    expect(parsed?.createdAt).toBe(identity.createdAt);
  });

  it("rejects invalid identity payload and formats did handles", () => {
    expect(parseIdentityRecord("{\"did\":\"invalid\",\"createdAt\":\"x\"}")).toBeNull();
    expect(parseIdentityRecord("not-json")).toBeNull();
    const formatted = formatDidHandle("did:key:z123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
    expect(formatted.includes("...")).toBe(true);
  });
});

describe("ucan and revocation helpers", () => {
  const issuer = createIdentityRecord(1700000000000).did;
  const audience = createIdentityRecord(1700000000100).did;

  it("creates delegation with expiry and revocation id", () => {
    const delegation = createUcanDelegation({
      issuerDid: issuer,
      audienceDid: audience,
      capabilities: [{ with: issuer, can: "feed/publish" }],
      issuedAt: 1700000000000,
      ttlSeconds: 120
    });
    expect(delegation.version).toBe("1.1");
    expect(delegation.expiresAt).toBe(1700000120000);
    expect(delegation.revocationId.startsWith("revoke-")).toBe(true);
    expect(isUcanDelegationExpired(delegation, 1700000119000)).toBe(false);
    expect(isUcanDelegationExpired(delegation, 1700000120000)).toBe(true);
    expect(getUcanRemainingMs(delegation, 1700000119000)).toBe(1000);
    expect(isUcanDelegationExpiringSoon(delegation, 5000, 1700000119000)).toBe(true);
    expect(isUcanDelegationExpiringSoon(delegation, 500, 1700000119000)).toBe(false);
  });

  it("serializes and parses delegation", () => {
    const delegation = createUcanDelegation({
      issuerDid: issuer,
      audienceDid: audience,
      capabilities: [{ with: issuer, can: "feed/read" }],
      issuedAt: 1700000000000,
      ttlSeconds: 300,
      revocationId: createRevocationId(1700000000000)
    });
    const raw = serializeUcanDelegation(delegation);
    const parsed = parseUcanDelegation(raw);
    expect(parsed?.issuerDid).toBe(issuer);
    expect(parsed?.audienceDid).toBe(audience);
    expect(parsed?.capabilities[0]?.can).toBe("feed/read");
  });

  it("rejects invalid delegation payloads", () => {
    expect(
      () =>
        createUcanDelegation({
          issuerDid: "did:key:invalid",
          audienceDid: audience,
          capabilities: [{ with: "x", can: "feed/read" }]
        })
    ).toThrow("UCAN issuer and audience must be valid did:key identifiers");
    expect(parseUcanDelegation("{\"issuerDid\":\"bad\"}")).toBeNull();
    expect(parseUcanDelegation("not-json")).toBeNull();
  });

  it("handles offline revocation queue", () => {
    const entry = createOfflineRevocationEntry(" revoke-1 ", " key compromise ", 1700000005000);
    const queue = enqueueOfflineRevocation([], entry);
    const deduped = enqueueOfflineRevocation(queue, entry);
    expect(queue).toHaveLength(1);
    expect(deduped).toHaveLength(1);
    const raw = serializeOfflineRevocationQueue(queue);
    const parsed = parseOfflineRevocationQueue(raw);
    expect(parsed[0]?.revocationId).toBe("revoke-1");
    expect(parsed[0]?.reason).toBe("key compromise");
    expect(parseOfflineRevocationQueue("bad-json")).toHaveLength(0);
  });

  it("replays queue entries in batches", () => {
    const first = createOfflineRevocationEntry("revoke-a", "test-a", 1);
    const second = createOfflineRevocationEntry("revoke-b", "test-b", 2);
    const third = createOfflineRevocationEntry("revoke-c", "test-c", 3);
    const queue = [first, second, third];

    const partial = replayOfflineRevocations(queue, 2);
    expect(partial.replayed).toHaveLength(2);
    expect(partial.remaining).toHaveLength(1);
    expect(partial.remaining[0]?.revocationId).toBe("revoke-c");

    const full = replayOfflineRevocations(partial.remaining, 10);
    expect(full.replayed).toHaveLength(1);
    expect(full.remaining).toHaveLength(0);
  });
});

describe("security audit log helpers", () => {
  it("creates and appends audit entries with max cap", () => {
    const one = createSecurityAuditEntry("identity.created", "created did", 10);
    const two = createSecurityAuditEntry("ucan.created", "created ucan", 20);
    const entries = appendSecurityAuditEntry([one], two, 1);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.event).toBe("ucan.created");
  });

  it("serializes and parses audit entries safely", () => {
    const entry = createSecurityAuditEntry("revocation.replayed", "flushed queue", 30);
    const raw = serializeSecurityAuditLog([entry]);
    const parsed = parseSecurityAuditLog(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.event).toBe("revocation.replayed");
    expect(parseSecurityAuditLog("bad-json")).toHaveLength(0);
  });
});

describe("failed revocation retry helpers", () => {
  it("upserts failed ids and removes flushed ids", () => {
    const first = upsertFailedRevocationRetries([], ["revoke-a"], 1000, "network", 10_000);
    expect(first).toHaveLength(1);
    expect(first[0]?.retryCount).toBe(1);
    const second = upsertFailedRevocationRetries(first, ["revoke-a", "revoke-b"], 2000, "network", 10_000);
    expect(second).toHaveLength(2);
    const updatedA = second.find((entry) => entry.revocationId === "revoke-a");
    expect(updatedA?.retryCount).toBe(2);

    const removed = removeFailedRetries(second, ["revoke-a"]);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.revocationId).toBe("revoke-b");
  });

  it("splits ready retries and supports parse/serialize", () => {
    const base = upsertFailedRevocationRetries([], ["revoke-a", "revoke-b"], 1000, "network", 10_000);
    const split = splitReadyFailedRetries(base, 15_000);
    expect(split.ready).toHaveLength(2);
    expect(split.pending).toHaveLength(0);

    const raw = serializeFailedRevocationRetries(base);
    const parsed = parseFailedRevocationRetries(raw);
    expect(parsed).toHaveLength(2);
    expect(parseFailedRevocationRetries("bad-json")).toHaveLength(0);
  });
});
