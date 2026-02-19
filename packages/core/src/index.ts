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
export type RevocationListEntry = {
  readonly revocationId: string;
  readonly revokedAt: number;
  readonly reason: string;
};
export type RevocationListRecord = {
  readonly version: "1.1";
  readonly updatedAt: number;
  readonly issuerDid: string | null;
  readonly signature: string | null;
  readonly entries: RevocationListEntry[];
};
export type RevocationListPolicyStatus = "valid" | "untrusted-issuer" | "invalid-signature";
export type RevocationReplayResult = {
  readonly replayed: OfflineRevocationEntry[];
  readonly remaining: OfflineRevocationEntry[];
};
export type FailedRevocationRetry = {
  readonly revocationId: string;
  readonly failedAt: number;
  readonly retryCount: number;
  readonly nextRetryAt: number;
  readonly lastError: string;
};
export type SecurityAuditEventType =
  | "identity.created"
  | "identity.cleared"
  | "ucan.created"
  | "ucan.revoked"
  | "ucan.expired"
  | "ucan.verified"
  | "revocation.verified"
  | "revocation.replayed";
export type SecurityAuditEntry = {
  readonly id: string;
  readonly event: SecurityAuditEventType;
  readonly detail: string;
  readonly timestamp: number;
};
export type StorageRiskLevel = "low" | "medium" | "high" | "critical";
export type StorageTelemetry = {
  readonly budgetUsd: number;
  readonly spentUsd: number;
  readonly pinningOps: number;
  readonly lastUpdated: number;
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

export const createStorageTelemetry = (budgetUsd = 25, now = Date.now()): StorageTelemetry => {
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
    throw new Error("budgetUsd must be a positive number");
  }
  return {
    budgetUsd,
    spentUsd: 0,
    pinningOps: 0,
    lastUpdated: now
  };
};

export const recordPinCost = (
  telemetry: StorageTelemetry,
  costUsd: number,
  now = Date.now()
): StorageTelemetry => {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    throw new Error("costUsd must be a positive number");
  }
  return {
    budgetUsd: telemetry.budgetUsd,
    spentUsd: Number((telemetry.spentUsd + costUsd).toFixed(4)),
    pinningOps: telemetry.pinningOps + 1,
    lastUpdated: now
  };
};

export const getStorageUsageRatio = (telemetry: StorageTelemetry): number => {
  if (telemetry.budgetUsd <= 0) {
    return 0;
  }
  return telemetry.spentUsd / telemetry.budgetUsd;
};

export const getStorageRiskLevel = (telemetry: StorageTelemetry): StorageRiskLevel => {
  const ratio = getStorageUsageRatio(telemetry);
  if (ratio >= 1) {
    return "critical";
  }
  if (ratio >= 0.9) {
    return "high";
  }
  if (ratio >= 0.7) {
    return "medium";
  }
  return "low";
};

export const serializeStorageTelemetry = (telemetry: StorageTelemetry): string => {
  return JSON.stringify(telemetry);
};

export const parseStorageTelemetry = (raw: string | null | undefined): StorageTelemetry | null => {
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
  const budgetUsd = typeof parsed.budgetUsd === "number" ? parsed.budgetUsd : NaN;
  const spentUsd = typeof parsed.spentUsd === "number" ? parsed.spentUsd : NaN;
  const pinningOps = typeof parsed.pinningOps === "number" ? parsed.pinningOps : NaN;
  const lastUpdated = typeof parsed.lastUpdated === "number" ? parsed.lastUpdated : NaN;
  if (
    !Number.isFinite(budgetUsd) ||
    budgetUsd <= 0 ||
    !Number.isFinite(spentUsd) ||
    spentUsd < 0 ||
    !Number.isFinite(pinningOps) ||
    pinningOps < 0 ||
    !Number.isFinite(lastUpdated)
  ) {
    return null;
  }
  return {
    budgetUsd,
    spentUsd,
    pinningOps: Math.floor(pinningOps),
    lastUpdated
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

export const createRevocationList = (updatedAt = Date.now()): RevocationListRecord => {
  return {
    version: "1.1",
    updatedAt,
    issuerDid: null,
    signature: null,
    entries: []
  };
};

export const addRevocationListEntry = (
  list: RevocationListRecord,
  revocationId: string,
  reason: string,
  revokedAt = Date.now()
): RevocationListRecord => {
  const normalizedId = revocationId.trim();
  const normalizedReason = reason.trim();
  if (normalizedId.length === 0) {
    throw new Error("revocationId must be non-empty");
  }
  if (normalizedReason.length === 0) {
    throw new Error("reason must be non-empty");
  }
  const existing = list.entries.filter((entry) => entry.revocationId !== normalizedId);
  return {
    version: "1.1",
    updatedAt: revokedAt,
    issuerDid: list.issuerDid,
    signature: null,
    entries: [...existing, { revocationId: normalizedId, revokedAt, reason: normalizedReason }].sort(
      (left, right) => right.revokedAt - left.revokedAt
    )
  };
};

const createRevocationListSigningPayload = (list: RevocationListRecord, issuerDid: string): string => {
  const entries = [...list.entries].sort((left, right) => right.revokedAt - left.revokedAt);
  return JSON.stringify({
    version: "1.1",
    updatedAt: list.updatedAt,
    issuerDid,
    entries
  });
};

export const signRevocationList = (list: RevocationListRecord, issuerDid: string): RevocationListRecord => {
  const normalizedIssuer = issuerDid.trim();
  if (!isValidDidKey(normalizedIssuer)) {
    throw new Error("issuerDid must be a valid did:key identifier");
  }
  const payload = createRevocationListSigningPayload(list, normalizedIssuer);
  const signature = `sig-${fnv1aHex(payload)}`;
  return {
    version: "1.1",
    updatedAt: list.updatedAt,
    issuerDid: normalizedIssuer,
    signature,
    entries: [...list.entries].sort((left, right) => right.revokedAt - left.revokedAt)
  };
};

export const verifyRevocationListSignature = (list: RevocationListRecord): boolean => {
  if (list.entries.length === 0) {
    return true;
  }
  if (!list.issuerDid || !list.signature || !isValidDidKey(list.issuerDid)) {
    return false;
  }
  const expected = `sig-${fnv1aHex(createRevocationListSigningPayload(list, list.issuerDid))}`;
  return expected === list.signature;
};

export const serializeTrustedDidList = (trustedDidList: readonly string[]): string => {
  const normalized = [...new Set(trustedDidList.map((entry) => entry.trim()).filter((entry) => isValidDidKey(entry)))];
  return JSON.stringify(normalized);
};

export const parseTrustedDidList = (raw: string | null | undefined): string[] => {
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
  const normalized = [...new Set(parsed.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter((entry) => isValidDidKey(entry)))];
  return normalized;
};

export const isRevocationListIssuerTrusted = (
  list: RevocationListRecord,
  trustedDidList: readonly string[]
): boolean => {
  if (list.entries.length === 0) {
    return true;
  }
  if (!list.issuerDid || !isValidDidKey(list.issuerDid)) {
    return false;
  }
  const trusted = new Set(parseTrustedDidList(serializeTrustedDidList(trustedDidList)));
  return trusted.has(list.issuerDid);
};

export const verifyRevocationListPolicy = (
  list: RevocationListRecord,
  trustedDidList: readonly string[]
): RevocationListPolicyStatus => {
  if (!verifyRevocationListSignature(list)) {
    return "invalid-signature";
  }
  if (!isRevocationListIssuerTrusted(list, trustedDidList)) {
    return "untrusted-issuer";
  }
  return "valid";
};

export const serializeRevocationList = (list: RevocationListRecord): string => {
  return JSON.stringify(list);
};

export const parseRevocationList = (raw: string | null | undefined): RevocationListRecord => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return createRevocationList();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createRevocationList();
  }
  if (!isObject(parsed)) {
    return createRevocationList();
  }
  const version = parsed.version;
  const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : NaN;
  const issuerDidRaw = typeof parsed.issuerDid === "string" ? parsed.issuerDid.trim() : "";
  const issuerDid = issuerDidRaw.length > 0 ? issuerDidRaw : null;
  const signatureRaw = typeof parsed.signature === "string" ? parsed.signature.trim() : "";
  const signature = signatureRaw.length > 0 ? signatureRaw : null;
  const entriesRaw = Array.isArray(parsed.entries) ? parsed.entries : [];
  if (version !== "1.1" || !Number.isFinite(updatedAt)) {
    return createRevocationList();
  }
  if (issuerDid && !isValidDidKey(issuerDid)) {
    return createRevocationList();
  }
  const entries: RevocationListEntry[] = [];
  for (const item of entriesRaw) {
    if (!isObject(item)) {
      continue;
    }
    const revocationId = typeof item.revocationId === "string" ? item.revocationId.trim() : "";
    const revokedAt = typeof item.revokedAt === "number" ? item.revokedAt : NaN;
    const reason = typeof item.reason === "string" ? item.reason.trim() : "";
    if (revocationId.length === 0 || !Number.isFinite(revokedAt) || reason.length === 0) {
      continue;
    }
    entries.push({ revocationId, revokedAt, reason });
  }
  return {
    version: "1.1",
    updatedAt,
    issuerDid,
    signature,
    entries: entries.sort((left, right) => right.revokedAt - left.revokedAt)
  };
};

export const isRevocationListed = (list: RevocationListRecord, revocationId: string): boolean => {
  const normalizedId = revocationId.trim();
  if (normalizedId.length === 0) {
    return false;
  }
  return list.entries.some((entry) => entry.revocationId === normalizedId);
};

export const verifyDelegationRevocation = (
  delegation: Pick<UcanDelegationRecord, "revocationId" | "expiresAt">,
  list: RevocationListRecord,
  now = Date.now()
): "active" | "expired" | "revoked" => {
  if (isRevocationListed(list, delegation.revocationId)) {
    return "revoked";
  }
  if (now >= delegation.expiresAt) {
    return "expired";
  }
  return "active";
};

export const createFailedRevocationRetry = (
  revocationId: string,
  failedAt: number,
  retryCount: number,
  nextRetryAt: number,
  lastError: string
): FailedRevocationRetry => {
  const normalizedId = revocationId.trim();
  const normalizedError = lastError.trim();
  if (normalizedId.length === 0) {
    throw new Error("revocationId must be non-empty");
  }
  if (retryCount < 1 || !Number.isFinite(retryCount)) {
    throw new Error("retryCount must be >= 1");
  }
  if (!Number.isFinite(failedAt) || !Number.isFinite(nextRetryAt)) {
    throw new Error("failedAt and nextRetryAt must be finite numbers");
  }
  if (normalizedError.length === 0) {
    throw new Error("lastError must be non-empty");
  }
  return {
    revocationId: normalizedId,
    failedAt,
    retryCount,
    nextRetryAt,
    lastError: normalizedError
  };
};

export const upsertFailedRevocationRetries = (
  current: readonly FailedRevocationRetry[],
  failedIds: readonly string[],
  now = Date.now(),
  errorLabel = "flush failed",
  baseDelayMs = 30_000
): FailedRevocationRetry[] => {
  const byId = new Map(current.map((entry) => [entry.revocationId, entry]));
  for (const rawId of failedIds) {
    const revocationId = rawId.trim();
    if (revocationId.length === 0) {
      continue;
    }
    const existing = byId.get(revocationId);
    const retryCount = existing ? existing.retryCount + 1 : 1;
    const retryDelay = baseDelayMs * Math.max(1, retryCount);
    byId.set(
      revocationId,
      createFailedRevocationRetry(revocationId, now, retryCount, now + retryDelay, errorLabel)
    );
  }
  return [...byId.values()].sort((left, right) => left.nextRetryAt - right.nextRetryAt);
};

export const removeFailedRetries = (
  current: readonly FailedRevocationRetry[],
  flushedIds: readonly string[]
): FailedRevocationRetry[] => {
  if (flushedIds.length === 0) {
    return [...current];
  }
  const flushedSet = new Set(flushedIds.map((id) => id.trim()).filter((id) => id.length > 0));
  return current.filter((entry) => !flushedSet.has(entry.revocationId));
};

export const splitReadyFailedRetries = (
  current: readonly FailedRevocationRetry[],
  now = Date.now()
): { ready: FailedRevocationRetry[]; pending: FailedRevocationRetry[] } => {
  const ready: FailedRevocationRetry[] = [];
  const pending: FailedRevocationRetry[] = [];
  for (const entry of current) {
    if (entry.nextRetryAt <= now) {
      ready.push(entry);
    } else {
      pending.push(entry);
    }
  }
  return { ready, pending };
};

export const serializeFailedRevocationRetries = (entries: readonly FailedRevocationRetry[]): string => {
  return JSON.stringify(entries);
};

export const parseFailedRevocationRetries = (raw: string | null | undefined): FailedRevocationRetry[] => {
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
  const next: FailedRevocationRetry[] = [];
  for (const item of parsed) {
    if (!isObject(item)) {
      continue;
    }
    const revocationId = typeof item.revocationId === "string" ? item.revocationId.trim() : "";
    const failedAt = typeof item.failedAt === "number" ? item.failedAt : NaN;
    const retryCount = typeof item.retryCount === "number" ? item.retryCount : NaN;
    const nextRetryAt = typeof item.nextRetryAt === "number" ? item.nextRetryAt : NaN;
    const lastError = typeof item.lastError === "string" ? item.lastError.trim() : "";
    if (
      revocationId.length === 0 ||
      !Number.isFinite(failedAt) ||
      !Number.isFinite(retryCount) ||
      retryCount < 1 ||
      !Number.isFinite(nextRetryAt) ||
      lastError.length === 0
    ) {
      continue;
    }
    next.push({
      revocationId,
      failedAt,
      retryCount: Math.floor(retryCount),
      nextRetryAt,
      lastError
    });
  }
  return next.sort((left, right) => left.nextRetryAt - right.nextRetryAt);
};

export const createSecurityAuditEntry = (
  event: SecurityAuditEventType,
  detail: string,
  timestamp = Date.now()
): SecurityAuditEntry => {
  const normalizedDetail = detail.trim();
  if (normalizedDetail.length === 0) {
    throw new Error("detail must be non-empty");
  }
  return {
    id: `audit-${timestamp.toString(36)}-${encodeBase58(randomBytes(6))}`,
    event,
    detail: normalizedDetail,
    timestamp
  };
};

export const appendSecurityAuditEntry = (
  current: readonly SecurityAuditEntry[],
  entry: SecurityAuditEntry,
  maxEntries = 100
): SecurityAuditEntry[] => {
  const next = [entry, ...current];
  const safeMax = Number.isFinite(maxEntries) && maxEntries > 0 ? Math.floor(maxEntries) : 100;
  return next.slice(0, safeMax);
};

export const serializeSecurityAuditLog = (entries: readonly SecurityAuditEntry[]): string => {
  return JSON.stringify(entries);
};

export const parseSecurityAuditLog = (raw: string | null | undefined): SecurityAuditEntry[] => {
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
  const entries: SecurityAuditEntry[] = [];
  for (const item of parsed) {
    if (!isObject(item)) {
      continue;
    }
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const event = typeof item.event === "string" ? item.event : "";
    const detail = typeof item.detail === "string" ? item.detail.trim() : "";
    const timestamp = typeof item.timestamp === "number" ? item.timestamp : NaN;
    if (id.length === 0 || detail.length === 0 || !Number.isFinite(timestamp)) {
      continue;
    }
    if (
      event !== "identity.created" &&
      event !== "identity.cleared" &&
      event !== "ucan.created" &&
      event !== "ucan.revoked" &&
      event !== "ucan.expired" &&
      event !== "ucan.verified" &&
      event !== "revocation.verified" &&
      event !== "revocation.replayed"
    ) {
      continue;
    }
    entries.push({
      id,
      event,
      detail,
      timestamp
    });
  }
  return entries;
};
