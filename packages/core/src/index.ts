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
