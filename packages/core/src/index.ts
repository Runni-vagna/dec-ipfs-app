/**
 * SDP v1.1 Phase 0 • Core
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Scope
 * Immutability: CIDs are permanent
 */

export type FeedEntry = {
  readonly postCID: string;
  readonly timestamp: number;
  readonly version: "1.1";
};

export type FeedTab = "main" | "discover" | "private" | "alerts" | "profile" | "all";

export const createFeedEntry = (postCID: string, timestamp = Date.now()): FeedEntry => {
  if (postCID.trim().length === 0) {
    throw new Error("postCID must be a non-empty string");
  }

  return {
    postCID,
    timestamp,
    version: "1.1"
  };
};

const fnv1aHex = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const createLocalCID = (content: string, timestamp = Date.now()): string => {
  const normalized = content.trim();
  if (normalized.length === 0) {
    throw new Error("content must be a non-empty string");
  }
  const digest = fnv1aHex(`${normalized}|${timestamp}`);
  return `bafy${digest}`;
};

export type DraftPost = {
  readonly cid: string;
  readonly body: string;
  readonly tag: FeedTab;
  readonly timestamp: number;
  readonly entry: FeedEntry;
};

export const createDraftPost = (body: string, tag: FeedTab, timestamp = Date.now()): DraftPost => {
  const normalizedBody = body.trim();
  const cid = createLocalCID(normalizedBody, timestamp);
  const entry = createFeedEntry(cid, timestamp);
  return {
    cid,
    body: normalizedBody,
    tag,
    timestamp,
    entry
  };
};
