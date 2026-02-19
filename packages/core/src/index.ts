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

export type FeedPost = {
  readonly cid: string;
  readonly body: string;
  readonly tag: FeedTab;
  readonly timestamp: number;
};

export type RemovedPostSnapshot = {
  readonly post: FeedPost;
  readonly index: number;
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

export const toFeedPost = (draftPost: DraftPost): FeedPost => {
  return {
    cid: draftPost.cid,
    body: draftPost.body,
    tag: draftPost.tag,
    timestamp: draftPost.timestamp
  };
};

export const prependFeedPost = (posts: readonly FeedPost[], post: FeedPost): FeedPost[] => {
  return [post, ...posts];
};

export const removeFeedPost = (posts: readonly FeedPost[], target: FeedPost): {
  posts: FeedPost[];
  removed: RemovedPostSnapshot | null;
} => {
  const index = posts.findIndex((post) => post.cid === target.cid && post.body === target.body);
  if (index === -1) {
    return {
      posts: [...posts],
      removed: null
    };
  }
  const next = [...posts];
  const [removedPost] = next.splice(index, 1);
  if (!removedPost) {
    return {
      posts: next,
      removed: null
    };
  }
  return {
    posts: next,
    removed: {
      post: removedPost,
      index
    }
  };
};

export const restoreFeedPost = (posts: readonly FeedPost[], snapshot: RemovedPostSnapshot): FeedPost[] => {
  const next = [...posts];
  const safeIndex = Math.max(0, Math.min(snapshot.index, next.length));
  next.splice(safeIndex, 0, snapshot.post);
  return next;
};

export const toggleFlag = (flags: Readonly<Record<string, boolean>>, key: string): Record<string, boolean> => {
  const next = !(flags[key] === true);
  return {
    ...flags,
    [key]: next
  };
};

export const filterFeedPosts = (
  posts: readonly FeedPost[],
  activeTab: FeedTab,
  query: string,
  pinnedOnly: boolean,
  pinnedCids: Readonly<Record<string, boolean>>
): FeedPost[] => {
  const tabFiltered = posts.filter((post) => post.tag === activeTab || post.tag === "all");
  const pinFiltered = pinnedOnly ? tabFiltered.filter((post) => pinnedCids[post.cid] === true) : tabFiltered;
  const lowered = query.trim().toLowerCase();
  if (lowered.length === 0) {
    return pinFiltered;
  }
  return pinFiltered.filter(
    (post) => post.cid.toLowerCase().includes(lowered) || post.body.toLowerCase().includes(lowered)
  );
};
