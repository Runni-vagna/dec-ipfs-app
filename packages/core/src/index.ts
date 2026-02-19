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

export type ActiveTab = "main" | "discover" | "private" | "alerts" | "profile";
export type FeedTab = ActiveTab | "all";
export type IdentityRecord = {
  readonly did: string;
  readonly createdAt: string;
};
export type UcanCapability = {
  readonly with: string;
  readonly can: string;
};
export type UcanDelegationRecord = {
  readonly issuerDid: string;
  readonly audienceDid: string;
  readonly capabilities: UcanCapability[];
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly revocationId: string;
  readonly nonce: string;
  readonly version: "1.1";
};
export type OfflineRevocationEntry = {
  readonly revocationId: string;
  readonly queuedAt: number;
  readonly reason: string;
};
export type RevocationReplayResult = {
  readonly replayed: OfflineRevocationEntry[];
  readonly remaining: OfflineRevocationEntry[];
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

export type FeedUiState = {
  readonly activeTab: ActiveTab;
  readonly unreadAlerts: number;
  readonly followedCids: Record<string, boolean>;
  readonly pinnedCids: Record<string, boolean>;
  readonly posts: FeedPost[];
};

export type FeedStateSnapshot = FeedUiState & {
  readonly exportedAt: string;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isFeedTab = (value: string): value is FeedTab => {
  return value === "main" || value === "discover" || value === "private" || value === "alerts" || value === "profile" || value === "all";
};

const isActiveTab = (value: string): value is ActiveTab => {
  return value === "main" || value === "discover" || value === "private" || value === "alerts" || value === "profile";
};

const isFeedPost = (value: unknown): value is FeedPost => {
  if (!isObject(value)) {
    return false;
  }
  const { cid, body, tag, timestamp } = value;
  return (
    typeof cid === "string" &&
    cid.trim().length > 0 &&
    typeof body === "string" &&
    body.trim().length > 0 &&
    typeof tag === "string" &&
    isFeedTab(tag) &&
    typeof timestamp === "number" &&
    Number.isFinite(timestamp)
  );
};

const normalizeFlagMap = (value: unknown): Record<string, boolean> => {
  if (!isObject(value)) {
    return {};
  }
  const next: Record<string, boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === true) {
      next[key] = true;
    }
  }
  return next;
};

export const parseActiveTab = (value: string | null | undefined, fallback: ActiveTab = "main"): ActiveTab => {
  if (typeof value !== "string") {
    return fallback;
  }
  if (isActiveTab(value)) {
    return value;
  }
  return fallback;
};

export const createResetFeedState = (defaultPosts: readonly FeedPost[]): FeedUiState => {
  return {
    activeTab: "main",
    unreadAlerts: 0,
    followedCids: {},
    pinnedCids: {},
    posts: [...defaultPosts]
  };
};

export const createFeedStateSnapshot = (state: FeedUiState, exportedAt = new Date().toISOString()): FeedStateSnapshot => {
  return {
    exportedAt,
    activeTab: state.activeTab,
    unreadAlerts: state.unreadAlerts,
    followedCids: { ...state.followedCids },
    pinnedCids: { ...state.pinnedCids },
    posts: [...state.posts]
  };
};

export const serializeFeedStateSnapshot = (snapshot: FeedStateSnapshot): string => {
  return JSON.stringify(snapshot, null, 2);
};

export const parseImportedFeedState = (raw: string, defaultPosts: readonly FeedPost[]): FeedUiState => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Import failed: invalid JSON.");
  }
  if (!isObject(parsed)) {
    throw new Error("Import failed: invalid JSON.");
  }

  const activeTab = parseActiveTab(typeof parsed.activeTab === "string" ? parsed.activeTab : null);
  const unreadAlerts =
    typeof parsed.unreadAlerts === "number" && Number.isFinite(parsed.unreadAlerts) && parsed.unreadAlerts >= 0
      ? Math.floor(parsed.unreadAlerts)
      : 0;

  const followedCids = normalizeFlagMap(parsed.followedCids);
  const pinnedCids = normalizeFlagMap(parsed.pinnedCids);

  const importedPosts = Array.isArray(parsed.posts) ? parsed.posts.filter((entry): entry is FeedPost => isFeedPost(entry)) : [];
  const posts = importedPosts.length > 0 ? importedPosts : [...defaultPosts];

  return {
    activeTab,
    unreadAlerts,
    followedCids,
    pinnedCids,
    posts
  };
};

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const encodeBase58 = (bytes: Uint8Array): string => {
  if (bytes.length === 0) {
    return "";
  }
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = (digits[i] ?? 0) * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let result = "";
  for (const byte of bytes) {
    if (byte !== 0) {
      break;
    }
    result += BASE58_ALPHABET[0] ?? "1";
  }
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    const digit = digits[i];
    if (digit === undefined) {
      continue;
    }
    result += BASE58_ALPHABET[digit] ?? "";
  }
  return result;
};

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
};

export const createIdentityRecord = (timestamp = Date.now()): IdentityRecord => {
  const multicodecPrefix = new Uint8Array([0xed, 0x01]);
  const publicKey = randomBytes(32);
  const prefixedKey = new Uint8Array(multicodecPrefix.length + publicKey.length);
  prefixedKey.set(multicodecPrefix, 0);
  prefixedKey.set(publicKey, multicodecPrefix.length);
  const did = `did:key:z${encodeBase58(prefixedKey)}`;
  return {
    did,
    createdAt: new Date(timestamp).toISOString()
  };
};

export const isValidDidKey = (did: string): boolean => {
  return /^did:key:z[1-9A-HJ-NP-Za-km-z]{10,}$/.test(did);
};

export const serializeIdentityRecord = (identity: IdentityRecord): string => {
  return JSON.stringify(identity);
};

export const parseIdentityRecord = (raw: string | null | undefined): IdentityRecord | null => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed)) {
    return null;
  }
  const did = typeof parsed.did === "string" ? parsed.did : "";
  const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : "";
  if (!isValidDidKey(did) || createdAt.trim().length === 0) {
    return null;
  }
  return {
    did,
    createdAt
  };
};

export const formatDidHandle = (did: string): string => {
  if (did.length <= 24) {
    return did;
  }
  return `${did.slice(0, 18)}...${did.slice(-6)}`;
};

const normalizeCapability = (capability: UcanCapability): UcanCapability => {
  const withValue = capability.with.trim();
  const canValue = capability.can.trim();
  if (withValue.length === 0 || canValue.length === 0) {
    throw new Error("UCAN capability fields must be non-empty");
  }
  return {
    with: withValue,
    can: canValue
  };
};

export const createRevocationId = (timestamp = Date.now()): string => {
  const entropy = encodeBase58(randomBytes(12));
  return `revoke-${timestamp.toString(36)}-${entropy}`;
};

export const createUcanDelegation = (params: {
  issuerDid: string;
  audienceDid: string;
  capabilities: readonly UcanCapability[];
  ttlSeconds?: number;
  issuedAt?: number;
  revocationId?: string;
}): UcanDelegationRecord => {
  if (!isValidDidKey(params.issuerDid) || !isValidDidKey(params.audienceDid)) {
    throw new Error("UCAN issuer and audience must be valid did:key identifiers");
  }
  if (params.capabilities.length === 0) {
    throw new Error("UCAN delegation requires at least one capability");
  }
  const issuedAt = params.issuedAt ?? Date.now();
  const ttlSeconds = params.ttlSeconds ?? 3600;
  if (!Number.isFinite(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 31_536_000) {
    throw new Error("UCAN ttlSeconds must be between 60 and 31536000");
  }
  const capabilities = params.capabilities.map((capability) => normalizeCapability(capability));
  const revocationId = (params.revocationId ?? createRevocationId(issuedAt)).trim();
  if (revocationId.length === 0) {
    throw new Error("UCAN revocationId must be non-empty");
  }
  return {
    issuerDid: params.issuerDid,
    audienceDid: params.audienceDid,
    capabilities,
    issuedAt,
    expiresAt: issuedAt + Math.floor(ttlSeconds * 1000),
    revocationId,
    nonce: encodeBase58(randomBytes(8)),
    version: "1.1"
  };
};

export const isUcanDelegationExpired = (
  delegation: Pick<UcanDelegationRecord, "expiresAt">,
  now = Date.now()
): boolean => {
  return now >= delegation.expiresAt;
};

export const getUcanRemainingMs = (
  delegation: Pick<UcanDelegationRecord, "expiresAt">,
  now = Date.now()
): number => {
  return delegation.expiresAt - now;
};

export const isUcanDelegationExpiringSoon = (
  delegation: Pick<UcanDelegationRecord, "expiresAt">,
  thresholdMs = 5 * 60 * 1000,
  now = Date.now()
): boolean => {
  const remainingMs = getUcanRemainingMs(delegation, now);
  return remainingMs > 0 && remainingMs <= thresholdMs;
};

export const serializeUcanDelegation = (delegation: UcanDelegationRecord): string => {
  return JSON.stringify(delegation);
};

export const parseUcanDelegation = (raw: string | null | undefined): UcanDelegationRecord | null => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed)) {
    return null;
  }
  const issuerDid = typeof parsed.issuerDid === "string" ? parsed.issuerDid : "";
  const audienceDid = typeof parsed.audienceDid === "string" ? parsed.audienceDid : "";
  if (!isValidDidKey(issuerDid) || !isValidDidKey(audienceDid)) {
    return null;
  }
  if (!Array.isArray(parsed.capabilities)) {
    return null;
  }
  const capabilities: UcanCapability[] = [];
  for (const capability of parsed.capabilities) {
    if (!isObject(capability)) {
      return null;
    }
    const withValue = typeof capability.with === "string" ? capability.with.trim() : "";
    const canValue = typeof capability.can === "string" ? capability.can.trim() : "";
    if (withValue.length === 0 || canValue.length === 0) {
      return null;
    }
    capabilities.push({ with: withValue, can: canValue });
  }
  if (capabilities.length === 0) {
    return null;
  }
  const issuedAt = typeof parsed.issuedAt === "number" ? parsed.issuedAt : NaN;
  const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : NaN;
  const revocationId = typeof parsed.revocationId === "string" ? parsed.revocationId.trim() : "";
  const nonce = typeof parsed.nonce === "string" ? parsed.nonce.trim() : "";
  const version = parsed.version;
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= issuedAt ||
    revocationId.length === 0 ||
    nonce.length === 0 ||
    version !== "1.1"
  ) {
    return null;
  }
  return {
    issuerDid,
    audienceDid,
    capabilities,
    issuedAt,
    expiresAt,
    revocationId,
    nonce,
    version: "1.1"
  };
};

export const createOfflineRevocationEntry = (
  revocationId: string,
  reason: string,
  queuedAt = Date.now()
): OfflineRevocationEntry => {
  const normalizedRevocationId = revocationId.trim();
  const normalizedReason = reason.trim();
  if (normalizedRevocationId.length === 0) {
    throw new Error("revocationId must be non-empty");
  }
  if (normalizedReason.length === 0) {
    throw new Error("reason must be non-empty");
  }
  return {
    revocationId: normalizedRevocationId,
    queuedAt,
    reason: normalizedReason
  };
};

export const enqueueOfflineRevocation = (
  queue: readonly OfflineRevocationEntry[],
  entry: OfflineRevocationEntry
): OfflineRevocationEntry[] => {
  if (queue.some((queued) => queued.revocationId === entry.revocationId)) {
    return [...queue];
  }
  return [...queue, entry];
};

export const serializeOfflineRevocationQueue = (queue: readonly OfflineRevocationEntry[]): string => {
  return JSON.stringify(queue);
};

export const parseOfflineRevocationQueue = (raw: string | null | undefined): OfflineRevocationEntry[] => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const queue: OfflineRevocationEntry[] = [];
  for (const item of parsed) {
    if (!isObject(item)) {
      continue;
    }
    const revocationId = typeof item.revocationId === "string" ? item.revocationId.trim() : "";
    const reason = typeof item.reason === "string" ? item.reason.trim() : "";
    const queuedAt = typeof item.queuedAt === "number" ? item.queuedAt : NaN;
    if (revocationId.length === 0 || reason.length === 0 || !Number.isFinite(queuedAt)) {
      continue;
    }
    queue.push({ revocationId, reason, queuedAt });
  }
  return queue;
};

export const replayOfflineRevocations = (
  queue: readonly OfflineRevocationEntry[],
  maxBatch = 25
): RevocationReplayResult => {
  const safeBatch = Number.isFinite(maxBatch) && maxBatch > 0 ? Math.floor(maxBatch) : queue.length;
  const replayed = queue.slice(0, safeBatch);
  const remaining = queue.slice(safeBatch);
  return {
    replayed,
    remaining
  };
};
