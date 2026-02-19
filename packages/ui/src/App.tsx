/**
 * SDP v1.1 Phase 0 • UI
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Threats
 * Immutability: CIDs are permanent
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Bell, CircleHelp, Compass, Download, Home, Plus, Search, Shield, Trash2, Upload, User, X } from "lucide-react";
import {
  appendSecurityAuditEntry,
  addRevocationListEntry,
  createSecurityAuditEntry,
  createOfflineRevocationEntry,
  createRevocationList,
  createFeedStateSnapshot,
  createIdentityRecord,
  createResetFeedState,
  createDraftPost,
  createUcanDelegation,
  enqueueOfflineRevocation,
  filterFeedPosts,
  formatDidHandle,
  isUcanDelegationExpiringSoon,
  isUcanDelegationExpired,
  parseFailedRevocationRetries,
  parseOfflineRevocationQueue,
  parseIdentityRecord,
  parseTrustedDidList,
  parseRevocationList,
  parseActiveTab,
  parseUcanDelegation,
  parseImportedFeedState,
  parseSecurityAuditLog,
  replayOfflineRevocations,
  removeFailedRetries,
  signRevocationList,
  prependFeedPost,
  splitReadyFailedRetries,
  removeFeedPost,
  restoreFeedPost,
  serializeFailedRevocationRetries,
  serializeOfflineRevocationQueue,
  serializeIdentityRecord,
  serializeRevocationList,
  serializeSecurityAuditLog,
  serializeTrustedDidList,
  serializeUcanDelegation,
  serializeFeedStateSnapshot,
  toFeedPost,
  toggleFlag,
  type ActiveTab,
  type FeedPost,
  type FailedRevocationRetry,
  type IdentityRecord,
  type OfflineRevocationEntry,
  type RevocationListRecord,
  type RemovedPostSnapshot,
  type SecurityAuditEntry,
  type UcanDelegationRecord,
  upsertFailedRevocationRetries,
  verifyRevocationListPolicy,
  verifyRevocationListSignature,
  verifyDelegationRevocation
} from "@cidfeed/core";
import {
  getPrivateNodeStatus,
  simulatePeerJoinCommand,
  startPrivateNodeCommand,
  startPrivateNodeWithModeCommand,
  stopPrivateNodeCommand,
  type NodeStartMode,
  type PrivateNodeStatus
} from "./tauri-private-node";
import {
  flushRevocationQueueCommand,
  loadSecurityStateCommand,
  saveSecurityStateCommand
} from "./tauri-security-state";

type Tab = ActiveTab;
type AuditFilter = "all" | "identity" | "ucan" | "revocation";
type AuditSort = "newest" | "oldest";

type FeedItem = FeedPost;

type WizardMode = "easy" | "private" | null;

type RemovedSnapshot = RemovedPostSnapshot;

const STORAGE_KEYS = {
  tab: "cidfeed.ui.activeTab",
  posts: "cidfeed.ui.posts",
  follows: "cidfeed.ui.follows",
  unread: "cidfeed.ui.unreadAlerts",
  pins: "cidfeed.ui.pinnedCids",
  identity: "cidfeed.ui.identity",
  ucan: "cidfeed.ui.ucanDelegation",
  revocations: "cidfeed.ui.offlineRevocationQueue",
  revocationList: "cidfeed.ui.revocationList",
  trustedRevocationIssuers: "cidfeed.ui.trustedRevocationIssuers",
  auditLog: "cidfeed.ui.securityAuditLog",
  failedFlushQueue: "cidfeed.ui.failedFlushQueue",
  retryHighStreak: "cidfeed.ui.retryHighStreak",
  retryEscalationAcknowledgedAt: "cidfeed.ui.retryEscalationAcknowledgedAt",
  safeReplayOnly: "cidfeed.ui.safeReplayOnly",
  unsafeReplayOverrideUntil: "cidfeed.ui.unsafeReplayOverrideUntil"
} as const;

const DEFAULT_POSTS: FeedItem[] = [
  { cid: "bafybeigd", body: "CIDFeed content sharing post", tag: "main", timestamp: 1700000000000 },
  { cid: "bafybeih2", body: "Swarm update: private peers online", tag: "private", timestamp: 1700000001000 },
  { cid: "bafybeiak", body: "OrbitDB sync in 642ms", tag: "discover", timestamp: 1700000002000 },
  { cid: "bafybeip7", body: "Published immutable post CID", tag: "alerts", timestamp: 1700000003000 }
];

export const App = () => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window === "undefined") {
      return "main";
    }
    return parseActiveTab(window.localStorage.getItem(STORAGE_KEYS.tab));
  });
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [followedCids, setFollowedCids] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.follows);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  const [pinnedCids, setPinnedCids] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.pins);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<WizardMode>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [identity, setIdentity] = useState<IdentityRecord | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return parseIdentityRecord(window.localStorage.getItem(STORAGE_KEYS.identity));
  });
  const [delegation, setDelegation] = useState<UcanDelegationRecord | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return parseUcanDelegation(window.localStorage.getItem(STORAGE_KEYS.ucan));
  });
  const [revocationQueue, setRevocationQueue] = useState<OfflineRevocationEntry[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    return parseOfflineRevocationQueue(window.localStorage.getItem(STORAGE_KEYS.revocations));
  });
  const [revocationList, setRevocationList] = useState<RevocationListRecord>(() => {
    if (typeof window === "undefined") {
      return createRevocationList();
    }
    return parseRevocationList(window.localStorage.getItem(STORAGE_KEYS.revocationList));
  });
  const [trustedRevocationIssuers, setTrustedRevocationIssuers] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    return parseTrustedDidList(window.localStorage.getItem(STORAGE_KEYS.trustedRevocationIssuers));
  });
  const [auditLog, setAuditLog] = useState<SecurityAuditEntry[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    return parseSecurityAuditLog(window.localStorage.getItem(STORAGE_KEYS.auditLog));
  });
  const [failedFlushQueue, setFailedFlushQueue] = useState<FailedRevocationRetry[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    return parseFailedRevocationRetries(window.localStorage.getItem(STORAGE_KEYS.failedFlushQueue));
  });
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditSort, setAuditSort] = useState<AuditSort>("newest");
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<SecurityAuditEntry | null>(null);
  const [securityHydrated, setSecurityHydrated] = useState(false);
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const [retryHighStreak, setRetryHighStreak] = useState<number>(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.retryHighStreak);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  });
  const [retryEscalationAcknowledgedAt, setRetryEscalationAcknowledgedAt] = useState<number | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.retryEscalationAcknowledgedAt);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });
  const [unsafeReplayConfirmArmed, setUnsafeReplayConfirmArmed] = useState(false);
  const [safeReplayOnly, setSafeReplayOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.safeReplayOnly);
    if (raw === null) {
      return true;
    }
    return raw === "true";
  });
  const [unsafeReplayOverrideUntil, setUnsafeReplayOverrideUntil] = useState<number | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.unsafeReplayOverrideUntil);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });

  const recordSecurityEvent = (
    event:
      | "identity.created"
      | "identity.cleared"
      | "ucan.created"
      | "ucan.revoked"
      | "ucan.expired"
      | "ucan.verified"
      | "revocation.verified"
      | "revocation.replayed",
    detail: string
  ) => {
    const entry = createSecurityAuditEntry(event, detail);
    setAuditLog((current) => appendSecurityAuditEntry(current, entry, 120));
  };
  const [privateNodeOnline, setPrivateNodeOnline] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [actionNote, setActionNote] = useState("Ready");
  const [lastRemoved, setLastRemoved] = useState<RemovedSnapshot | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState<number>(() => {
    if (typeof window === "undefined") {
      return 2;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.unread);
    return raw ? Number(raw) || 0 : 2;
  });
  const [posts, setPosts] = useState<FeedItem[]>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_POSTS;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.posts);
      return raw ? (JSON.parse(raw) as FeedItem[]) : DEFAULT_POSTS;
    } catch {
      return DEFAULT_POSTS;
    }
  });

  const filteredPosts = useMemo(() => {
    return filterFeedPosts(posts, activeTab, query, pinnedOnly, pinnedCids);
  }, [activeTab, pinnedOnly, pinnedCids, posts, query]);

  const filteredAuditLog = useMemo(() => {
    const byFilter =
      auditFilter === "all"
        ? auditLog
        : auditFilter === "identity"
          ? auditLog.filter((entry) => entry.event.startsWith("identity."))
          : auditFilter === "ucan"
            ? auditLog.filter((entry) => entry.event.startsWith("ucan."))
            : auditLog.filter((entry) => entry.event.startsWith("revocation."));

    const lowered = auditQuery.trim().toLowerCase();
    const byQuery =
      lowered.length === 0
        ? byFilter
        : byFilter.filter(
            (entry) => entry.event.toLowerCase().includes(lowered) || entry.detail.toLowerCase().includes(lowered)
          );

    const sorted = [...byQuery].sort((left, right) =>
      auditSort === "newest" ? right.timestamp - left.timestamp : left.timestamp - right.timestamp
    );
    return sorted;
  }, [auditFilter, auditLog, auditQuery, auditSort]);

  const delegationStatus = useMemo(() => {
    if (!delegation) {
      return null;
    }
    return verifyDelegationRevocation(delegation, revocationList, timeTick);
  }, [delegation, revocationList, timeTick]);
  const revocationListIntegrity = useMemo(() => verifyRevocationListSignature(revocationList), [revocationList]);
  const revocationListPolicyStatus = useMemo(
    () => verifyRevocationListPolicy(revocationList, trustedRevocationIssuers),
    [revocationList, trustedRevocationIssuers]
  );
  const failedRetryStatus = useMemo(() => {
    if (failedFlushQueue.length === 0) {
      return null;
    }
    const nextRetryAt = Math.min(...failedFlushQueue.map((entry) => entry.nextRetryAt));
    const maxRetryCount = Math.max(...failedFlushQueue.map((entry) => entry.retryCount));
    const waitMs = Math.max(0, nextRetryAt - timeTick);
    const nextRetryWindow = waitMs === 0 ? "ready now" : `in ~${Math.ceil(waitMs / 60_000)}m`;
    const severity = maxRetryCount >= 5 ? "high" : maxRetryCount >= 3 ? "medium" : "low";
    return {
      nextRetryAt,
      nextRetryWindow,
      maxRetryCount,
      severity
    };
  }, [failedFlushQueue, timeTick]);
  const securityWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (revocationList.entries.length > 0 && revocationListPolicyStatus === "invalid-signature") {
      warnings.push("Revocation list signature is invalid. Treat revocation results as untrusted.");
    }
    if (revocationList.entries.length > 0 && revocationListPolicyStatus === "untrusted-issuer") {
      warnings.push("Revocation list issuer is not trusted. Verify issuer DID before accepting list.");
    }
    if (failedRetryStatus) {
      warnings.push(
        `Failed revocation flush queue has ${failedFlushQueue.length} pending item(s), severity ${failedRetryStatus.severity}, next retry ${failedRetryStatus.nextRetryWindow}.`
      );
    }
    if (revocationQueue.length > 25) {
      warnings.push(`Offline revocation queue backlog is ${revocationQueue.length}. Replay soon.`);
    }
    return warnings;
  }, [
    failedFlushQueue.length,
    failedRetryStatus,
    revocationList.entries.length,
    revocationListPolicyStatus,
    revocationQueue.length
  ]);
  const retryEscalationActive = useMemo(() => retryHighStreak >= 3, [retryHighStreak]);
  const retryEscalationAcknowledged = useMemo(
    () => retryEscalationActive && retryEscalationAcknowledgedAt !== null,
    [retryEscalationActive, retryEscalationAcknowledgedAt]
  );
  const unsafeReplayOverrideActive = useMemo(
    () => unsafeReplayOverrideUntil !== null && unsafeReplayOverrideUntil > timeTick,
    [timeTick, unsafeReplayOverrideUntil]
  );

  const navItems: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: "main", label: "Main", icon: <Home size={16} /> },
    { id: "discover", label: "Discover", icon: <Compass size={16} /> },
    { id: "private", label: "Private", icon: <Shield size={16} /> },
    { id: "alerts", label: "Alerts", icon: <Bell size={16} /> },
    { id: "profile", label: "Profile", icon: <User size={16} /> }
  ];

  const publishDraft = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (delegation) {
      const status = verifyDelegationRevocation(delegation, revocationList, Date.now());
      if (status === "revoked" || status === "expired") {
        recordSecurityEvent(
          "ucan.verified",
          `blocked publish because delegation is ${status} for ${formatDidHandle(delegation.audienceDid)}`
        );
        setActionNote(`Cannot publish: UCAN is ${status}.`);
        return;
      }
    }
    const post = toFeedPost(createDraftPost(trimmed, activeTab));
    setPosts((current) => prependFeedPost(current, post));
    if (activeTab !== "alerts") {
      setUnreadAlerts((count) => count + 1);
    }
    setActionNote(`Post published with CID ${post.cid}.`);
    setDraft("");
    setComposeOpen(false);
  };

  const removePost = (target: FeedItem) => {
    setPosts((current) => {
      const result = removeFeedPost(current, target);
      if (result.removed) {
        setLastRemoved(result.removed);
        setActionNote(`Removed ${result.removed.post.cid}...`);
      }
      return result.posts;
    });
  };

  const undoRemove = () => {
    if (!lastRemoved) {
      return;
    }
    setPosts((current) => restoreFeedPost(current, lastRemoved));
    setLastRemoved(null);
    setActionNote("Removal undone.");
  };

  const exportDemoState = () => {
    const payload = createFeedStateSnapshot({
      activeTab,
      unreadAlerts,
      followedCids,
      pinnedCids,
      posts
    });
    const blob = new Blob([serializeFeedStateSnapshot(payload)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cidfeed-demo-state-${Date.now()}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setActionNote("Demo state exported.");
  };

  const exportAuditLog = () => {
    const blob = new Blob([serializeSecurityAuditLog(auditLog)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cidfeed-security-audit-${Date.now()}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setActionNote("Security audit exported.");
  };

  const openWizard = () => {
    setWizardMode(null);
    setWizardStep(1);
    setWizardOpen(true);
    setActionNote("Private wizard opened.");
  };

  const startNodeFromWizard = async (mode: NodeStartMode) => {
    const status = await startPrivateNodeWithModeCommand(mode);
    if (status) {
      applyPrivateNodeStatus(status);
      setWizardOpen(false);
      setActionNote(`Wizard complete. ${mode === "private" ? "Private" : "Easy"} node started.`);
      return;
    }
    setPrivateNodeOnline(true);
    setPeerCount(mode === "private" ? 2 : 4);
    setWizardOpen(false);
    setActionNote(`Wizard complete. ${mode === "private" ? "Private" : "Easy"} node started (web fallback).`);
  };

  const applyPrivateNodeStatus = (status: PrivateNodeStatus) => {
    setPrivateNodeOnline(status.online);
    setPeerCount(status.peerCount);
  };

  const togglePrivateNode = async () => {
    if (privateNodeOnline) {
      const status = await stopPrivateNodeCommand();
      if (status) {
        applyPrivateNodeStatus(status);
        setActionNote("Private node stopped.");
        return;
      }
      setPrivateNodeOnline(false);
      setPeerCount(0);
      setActionNote("Private node stopped (web fallback).");
      return;
    }
    const status = await startPrivateNodeCommand();
    if (status) {
      applyPrivateNodeStatus(status);
      setActionNote("Private node started.");
      return;
    }
    setPrivateNodeOnline(true);
    setPeerCount(3);
    setActionNote("Private node started (web fallback).");
  };

  const simulatePeerJoin = async () => {
    if (!privateNodeOnline) {
      setActionNote("Start private node first.");
      return;
    }
    const status = await simulatePeerJoinCommand();
    if (status) {
      applyPrivateNodeStatus(status);
      setActionNote("Peer joined private swarm.");
      return;
    }
    setPeerCount((count) => count + 1);
    setActionNote("Peer joined private swarm (web fallback).");
  };

  const importDemoState = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseImportedFeedState(text, DEFAULT_POSTS);
      setActiveTab(parsed.activeTab);
      setUnreadAlerts(parsed.unreadAlerts);
      setFollowedCids(parsed.followedCids);
      setPinnedCids(parsed.pinnedCids);
      setPosts(parsed.posts);
      setPinnedOnly(false);
      setActionNote("Demo state imported.");
    } catch (error) {
      if (error instanceof Error) {
        setActionNote(error.message);
      } else {
        setActionNote("Import failed: invalid JSON.");
      }
    } finally {
      event.target.value = "";
    }
  };

  const tabTitle: Record<Tab, string> = {
    main: "Main",
    discover: "Discover",
    private: "Private",
    alerts: "Alerts",
    profile: "Profile"
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.tab, activeTab);
  }, [activeTab]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.posts, JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.follows, JSON.stringify(followedCids));
  }, [followedCids]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.pins, JSON.stringify(pinnedCids));
  }, [pinnedCids]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.unread, String(unreadAlerts));
  }, [unreadAlerts]);

  useEffect(() => {
    void (async () => {
      const payload = await loadSecurityStateCommand();
      if (payload) {
        setIdentity(parseIdentityRecord(payload.identityJson));
        setDelegation(parseUcanDelegation(payload.delegationJson));
        setRevocationQueue(parseOfflineRevocationQueue(payload.revocationQueueJson));
        setRevocationList(parseRevocationList(payload.revocationListJson));
        setTrustedRevocationIssuers(parseTrustedDidList(payload.trustedRevocationIssuersJson));
        setAuditLog(parseSecurityAuditLog(payload.auditLogJson));
        setFailedFlushQueue(parseFailedRevocationRetries(payload.failedFlushQueueJson));
      }
      setSecurityHydrated(true);
    })();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if ((revocationListPolicyStatus === "valid" || safeReplayOnly) && unsafeReplayConfirmArmed) {
      setUnsafeReplayConfirmArmed(false);
    }
  }, [revocationListPolicyStatus, safeReplayOnly, unsafeReplayConfirmArmed]);

  useEffect(() => {
    setRetryHighStreak((current) => {
      if (!failedRetryStatus || failedRetryStatus.severity !== "high") {
        return 0;
      }
      return current + 1;
    });
  }, [failedRetryStatus?.severity, timeTick]);

  useEffect(() => {
    if (retryEscalationActive) {
      return;
    }
    if (retryEscalationAcknowledgedAt !== null) {
      setRetryEscalationAcknowledgedAt(null);
    }
  }, [retryEscalationAcknowledgedAt, retryEscalationActive]);

  useEffect(() => {
    if (!unsafeReplayOverrideUntil) {
      return;
    }
    if (unsafeReplayOverrideUntil <= timeTick) {
      setUnsafeReplayOverrideUntil(null);
    }
  }, [timeTick, unsafeReplayOverrideUntil]);

  useEffect(() => {
    if (!securityHydrated) {
      return;
    }
    const identityJson = identity ? serializeIdentityRecord(identity) : null;
    const delegationJson = delegation ? serializeUcanDelegation(delegation) : null;
    const revocationQueueJson = revocationQueue.length > 0 ? serializeOfflineRevocationQueue(revocationQueue) : null;
    const revocationListJson = revocationList.entries.length > 0 ? serializeRevocationList(revocationList) : null;
    const trustedRevocationIssuersJson =
      trustedRevocationIssuers.length > 0 ? serializeTrustedDidList(trustedRevocationIssuers) : null;
    const auditLogJson = auditLog.length > 0 ? serializeSecurityAuditLog(auditLog) : null;
    const failedFlushQueueJson =
      failedFlushQueue.length > 0 ? serializeFailedRevocationRetries(failedFlushQueue) : null;

    if (identityJson) {
      window.localStorage.setItem(STORAGE_KEYS.identity, identityJson);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.identity);
    }
    if (delegationJson) {
      window.localStorage.setItem(STORAGE_KEYS.ucan, delegationJson);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.ucan);
    }
    if (revocationQueueJson) {
      window.localStorage.setItem(STORAGE_KEYS.revocations, revocationQueueJson);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.revocations);
    }
    if (revocationListJson) {
      window.localStorage.setItem(STORAGE_KEYS.revocationList, revocationListJson);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.revocationList);
    }
    if (trustedRevocationIssuersJson) {
      window.localStorage.setItem(STORAGE_KEYS.trustedRevocationIssuers, trustedRevocationIssuersJson);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.trustedRevocationIssuers);
    }
    if (auditLogJson) {
      window.localStorage.setItem(STORAGE_KEYS.auditLog, auditLogJson);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.auditLog);
    }
    if (failedFlushQueueJson) {
      window.localStorage.setItem(STORAGE_KEYS.failedFlushQueue, failedFlushQueueJson);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.failedFlushQueue);
    }
    if (retryHighStreak > 0) {
      window.localStorage.setItem(STORAGE_KEYS.retryHighStreak, String(retryHighStreak));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.retryHighStreak);
    }
    if (retryEscalationAcknowledgedAt !== null) {
      window.localStorage.setItem(
        STORAGE_KEYS.retryEscalationAcknowledgedAt,
        String(retryEscalationAcknowledgedAt)
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.retryEscalationAcknowledgedAt);
    }
    window.localStorage.setItem(STORAGE_KEYS.safeReplayOnly, safeReplayOnly ? "true" : "false");
    if (unsafeReplayOverrideUntil !== null) {
      window.localStorage.setItem(STORAGE_KEYS.unsafeReplayOverrideUntil, String(unsafeReplayOverrideUntil));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.unsafeReplayOverrideUntil);
    }

    void saveSecurityStateCommand({
      identityJson,
      delegationJson,
      revocationQueueJson,
      revocationListJson,
      trustedRevocationIssuersJson,
      auditLogJson,
      failedFlushQueueJson
    });
  }, [
    auditLog,
    delegation,
    failedFlushQueue,
    identity,
    revocationList,
    revocationQueue,
    retryHighStreak,
    retryEscalationAcknowledgedAt,
    safeReplayOnly,
    securityHydrated,
    trustedRevocationIssuers,
    unsafeReplayOverrideUntil
  ]);

  useEffect(() => {
    if (activeTab === "alerts" && unreadAlerts > 0) {
      setUnreadAlerts(0);
      setActionNote("Alerts marked as read.");
    }
  }, [activeTab, unreadAlerts]);

  useEffect(() => {
    if (!delegation) {
      return;
    }
    if (!isUcanDelegationExpired(delegation, timeTick)) {
      return;
    }
    const entry = createOfflineRevocationEntry(delegation.revocationId, "auto revoke on expiry", timeTick);
    setRevocationQueue((current) => enqueueOfflineRevocation(current, entry));
    setRevocationList((current) =>
      addRevocationListEntry(current, delegation.revocationId, "auto revoke on expiry", timeTick)
    );
    setDelegation(null);
    recordSecurityEvent("ucan.expired", `delegation expired for ${formatDidHandle(delegation.audienceDid)}`);
    setActionNote("UCAN expired and was queued for revocation replay.");
  }, [delegation, timeTick]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inFormField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (!inFormField && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setComposeOpen(true);
        setActionNote("Compose opened (shortcut: C).");
      }
      if (!inFormField && event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
        setActionNote("Search opened (shortcut: /).");
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (!inFormField && event.key.toLowerCase() === "u" && lastRemoved) {
        event.preventDefault();
        undoRemove();
      }
      if (!inFormField && event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        setActionNote("Help opened.");
      }
      if (event.key === "Escape") {
        setWizardOpen(false);
        setComposeOpen(false);
        setHelpOpen(false);
        setSelectedAuditEntry(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lastRemoved]);

  useEffect(() => {
    void (async () => {
      const status = await getPrivateNodeStatus();
      if (!status) {
        return;
      }
      applyPrivateNodeStatus(status);
    })();
  }, []);

  const resetDemoState = () => {
    const reset = createResetFeedState(DEFAULT_POSTS);
    setActiveTab(reset.activeTab);
    setSearchOpen(false);
    setQuery("");
    setFollowedCids(reset.followedCids);
    setPinnedCids(reset.pinnedCids);
    setWizardOpen(false);
    setComposeOpen(false);
    setHelpOpen(false);
    setPrivateNodeOnline(false);
    setPeerCount(0);
    setDraft("");
    setUnreadAlerts(reset.unreadAlerts);
    setPosts(reset.posts);
    setIdentity(null);
    setDelegation(null);
    setRevocationQueue([]);
    setRevocationList(createRevocationList());
    setTrustedRevocationIssuers([]);
    setRetryHighStreak(0);
    setRetryEscalationAcknowledgedAt(null);
    setUnsafeReplayConfirmArmed(false);
    setSafeReplayOnly(true);
    setUnsafeReplayOverrideUntil(null);
    setAuditLog([]);
    setFailedFlushQueue([]);
    window.localStorage.removeItem(STORAGE_KEYS.tab);
    window.localStorage.removeItem(STORAGE_KEYS.posts);
    window.localStorage.removeItem(STORAGE_KEYS.follows);
    window.localStorage.removeItem(STORAGE_KEYS.unread);
    window.localStorage.removeItem(STORAGE_KEYS.pins);
    window.localStorage.removeItem(STORAGE_KEYS.identity);
    window.localStorage.removeItem(STORAGE_KEYS.ucan);
    window.localStorage.removeItem(STORAGE_KEYS.revocations);
    window.localStorage.removeItem(STORAGE_KEYS.revocationList);
    window.localStorage.removeItem(STORAGE_KEYS.trustedRevocationIssuers);
    window.localStorage.removeItem(STORAGE_KEYS.retryHighStreak);
    window.localStorage.removeItem(STORAGE_KEYS.retryEscalationAcknowledgedAt);
    window.localStorage.setItem(STORAGE_KEYS.safeReplayOnly, "true");
    window.localStorage.removeItem(STORAGE_KEYS.unsafeReplayOverrideUntil);
    window.localStorage.removeItem(STORAGE_KEYS.auditLog);
    window.localStorage.removeItem(STORAGE_KEYS.failedFlushQueue);
    setActionNote("Demo state reset.");
  };

  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden="true" />
      <div className="status-pill" aria-live="polite">{actionNote}</div>
      {lastRemoved && (
        <button className="undo-pill" onClick={undoRemove}>
          Undo remove (U)
        </button>
      )}
      <main className="layout">
        <aside className="glass panel sidebar">
          <div className="brand">CIDFeed</div>
          <nav className="nav-list" aria-label="Desktop nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={activeTab === item.id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setActiveTab(item.id);
                  setActionNote(`Switched to ${item.label}.`);
                }}
              >
                {item.icon}
                {item.label}
                {item.id === "alerts" && unreadAlerts > 0 && <span className="badge">{unreadAlerts}</span>}
              </button>
            ))}
          </nav>
          <div className="muted">Offline-first · No server custody</div>
        </aside>

        <section className="glass panel feed">
          <header className="feed-header">
            <h1>{tabTitle[activeTab]} Feed</h1>
            <div className="header-actions">
              <button
                className="icon-btn"
                aria-label="Compose"
                onClick={() => {
                  setComposeOpen(true);
                  setActionNote("Compose opened.");
                }}
              >
                <Plus size={16} />
              </button>
              {isSearchOpen && (
                <div className="search-wrap">
                  <input
                    ref={searchInputRef}
                    className="search-input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search CID or content"
                    aria-label="Search posts"
                  />
                  {query.length > 0 && (
                    <button
                      className="clear-search"
                      aria-label="Clear search"
                      onClick={() => {
                        setQuery("");
                        setActionNote("Search cleared.");
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
              <button
                className="icon-btn"
                aria-label="Search"
                onClick={() => {
                  setSearchOpen((open) => !open);
                  setActionNote("Search toggled.");
                }}
              >
                <Search size={16} />
              </button>
              <button
                className="icon-btn"
                aria-label="Help"
                onClick={() => {
                  setHelpOpen(true);
                  setActionNote("Help opened.");
                }}
              >
                <CircleHelp size={16} />
              </button>
              <button
                className={pinnedOnly ? "icon-btn pinned-active" : "icon-btn"}
                aria-label="Toggle pinned filter"
                onClick={() => {
                  setPinnedOnly((value) => !value);
                  setActionNote(!pinnedOnly ? "Pinned-only filter enabled." : "Pinned-only filter disabled.");
                }}
              >
                <Shield size={16} />
              </button>
            </div>
          </header>
          <div className="timeline" role="list">
            {filteredPosts.length === 0 && (
              <article className="feed-card" role="listitem">
                <div>
                  <p className="cid">No posts match this view.</p>
                  <p className="muted">Try another tab or clear search.</p>
                </div>
              </article>
            )}
            {filteredPosts.map((post) => {
              const key = `${post.cid}-${post.body}`;
              const isFollowed = followedCids[post.cid] === true;
              const isPinned = pinnedCids[post.cid] === true;
              return (
                <article className="feed-card" key={key} role="listitem">
                  <div>
                    <p className="cid">{post.cid}... {post.body}</p>
                    <p className="muted">Immutable CID · live OrbitDB update</p>
                  </div>
                  <div className="card-actions">
                    <button
                      className={isPinned ? "follow following" : "follow secondary"}
                      onClick={() => {
                        const next = !isPinned;
                        setPinnedCids((current) => toggleFlag(current, post.cid));
                        setActionNote(next ? `Pinned ${post.cid}.` : `Unpinned ${post.cid}.`);
                      }}
                    >
                      {isPinned ? "Pinned" : "Pin"}
                    </button>
                    <button
                      className={isFollowed ? "follow following" : "follow"}
                      onClick={() => {
                        const next = !isFollowed;
                        setFollowedCids((current) => toggleFlag(current, post.cid));
                        setActionNote(next ? `Following ${post.cid}...` : `Unfollowed ${post.cid}.`);
                      }}
                    >
                      {isFollowed ? "Following" : "Follow"}
                    </button>
                    <button className="follow secondary" onClick={() => removePost(post)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="glass panel right-rail">
          {activeTab !== "profile" ? (
            <>
              <h2>Private Node</h2>
              <p className="muted">Easy Mode and one-click private swarm wizard are both available.</p>
              <div className="network-map" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="stats-grid">
                <button
                  className="stats-item"
                  onClick={() => {
                    setPinnedOnly(false);
                    setActionNote("Showing all posts.");
                  }}
                >
                  <strong>{posts.length}</strong>
                  <span>Total Posts</span>
                </button>
                <button
                  className="stats-item"
                  onClick={() => {
                    setPinnedOnly(true);
                    setActionNote("Pinned-only filter enabled.");
                  }}
                >
                  <strong>{Object.values(pinnedCids).filter(Boolean).length}</strong>
                  <span>Pinned</span>
                </button>
                <button
                  className="stats-item"
                  onClick={() => {
                    setActiveTab("alerts");
                    setActionNote("Switched to Alerts.");
                  }}
                >
                  <strong>{unreadAlerts}</strong>
                  <span>Unread Alerts</span>
                </button>
              </div>
              <button
                className="cta"
                onClick={() => {
                  openWizard();
                }}
              >
                Open Wizard
              </button>
              <div className="private-controls">
                <button className="follow secondary" onClick={() => void togglePrivateNode()}>
                  {privateNodeOnline ? "Stop Node" : "Start Node"}
                </button>
                <button className="follow secondary" onClick={() => void simulatePeerJoin()}>Simulate Peer Join</button>
                <p className="muted">Private status: {privateNodeOnline ? "Online" : "Offline"} · Peers: {peerCount}</p>
              </div>
            </>
          ) : (
            <>
              <h2>Profile Tools</h2>
              <p className="muted">Quick maintenance actions for your local demo state.</p>
              <div className="alert-row">
                <span>{identity ? formatDidHandle(identity.did) : "No DID identity created"}</span>
                <span className="muted">{identity ? "Active DID" : "Create Identity"}</span>
              </div>
              {identity && <p className="muted">Created: {new Date(identity.createdAt).toLocaleString()}</p>}
              <div className="alert-row">
                <span>{delegation ? formatDidHandle(delegation.audienceDid) : "No UCAN delegation"}</span>
                <span className="muted">
                  {delegation
                    ? delegationStatus === "revoked"
                      ? "UCAN Revoked"
                      : delegationStatus === "expired"
                        ? "UCAN Expired"
                        : isUcanDelegationExpiringSoon(delegation, 5 * 60 * 1000, timeTick)
                          ? "UCAN Expiring Soon"
                          : "UCAN Active"
                    : "Delegate Access"}
                </span>
              </div>
              {delegation && (
                <>
                  <p className="muted">
                    Expires: {new Date(delegation.expiresAt).toLocaleString()} · Revocations queued: {revocationQueue.length} · Revocation list: {revocationList.entries.length} · Failed flush retries: {failedFlushQueue.length}
                  </p>
                  <p className="muted">
                    Revocation list integrity: {revocationListIntegrity ? "Verified" : "Unverified"}
                  </p>
                  <p className="muted">
                    Revocation list policy: {revocationListPolicyStatus}
                  </p>
                </>
              )}
              <div className="alerts-panel">
                <h3>Escalation</h3>
                <div className="alerts-list">
                  {!retryEscalationActive && (
                    <div className="alert-row">
                      <span className="muted">No active escalation.</span>
                    </div>
                  )}
                  {retryEscalationActive && (
                    <>
                      <div className="alert-row">
                        <span>
                          Escalation active: high retry backoff persisted for {retryHighStreak} interval(s). Review
                          swarm connectivity and replay pipeline.
                        </span>
                      </div>
                      <div className="alert-row">
                        <button
                          className="follow secondary"
                          onClick={() => {
                            const acknowledgedAt = Date.now();
                            setRetryEscalationAcknowledgedAt(acknowledgedAt);
                            recordSecurityEvent(
                              "revocation.verified",
                              `escalation acknowledged at ${new Date(acknowledgedAt).toISOString()}`
                            );
                            setActionNote("Escalation acknowledged.");
                          }}
                        >
                          Acknowledge Escalation
                        </button>
                      </div>
                      {retryEscalationAcknowledged && (
                        <div className="alert-row">
                          <span>
                            Escalation acknowledged at: {new Date(retryEscalationAcknowledgedAt ?? 0).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="alerts-panel">
                <h3>Retry Backoff</h3>
                <div className="alerts-list">
                  {!failedRetryStatus && (
                    <div className="alert-row">
                      <span className="muted">No failed retry backoff entries.</span>
                    </div>
                  )}
                  {failedRetryStatus && (
                    <>
                      <div className="alert-row">
                        <span>Retry backoff severity: {failedRetryStatus.severity}</span>
                      </div>
                      <div className="alert-row">
                        <span>Next retry window: {failedRetryStatus.nextRetryWindow}</span>
                      </div>
                      <div className="alert-row">
                        <span>Max retry count: {failedRetryStatus.maxRetryCount}</span>
                      </div>
                      <div className="alert-row">
                        <span>Next retry at: {new Date(failedRetryStatus.nextRetryAt).toLocaleTimeString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="alerts-panel">
                <h3>Security Warnings</h3>
                <div className="alerts-list">
                  {securityWarnings.length === 0 && (
                    <div className="alert-row">
                      <span className="muted">No active security warnings.</span>
                    </div>
                  )}
                  {securityWarnings.map((warning) => (
                    <div className="alert-row" key={warning}>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="alerts-panel">
                <h3>Security Audit</h3>
                <div className="search-wrap">
                  <input
                    className="search-input"
                    value={auditQuery}
                    onChange={(event) => setAuditQuery(event.target.value)}
                    placeholder="Search audit events"
                    aria-label="Search audit events"
                  />
                  {auditQuery.length > 0 && (
                    <button
                      className="clear-search"
                      aria-label="Clear audit search"
                      onClick={() => setAuditQuery("")}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div className="profile-actions">
                  <button
                    className={auditFilter === "all" ? "follow following" : "follow secondary"}
                    onClick={() => setAuditFilter("all")}
                  >
                    All
                  </button>
                  <button
                    className={auditFilter === "identity" ? "follow following" : "follow secondary"}
                    onClick={() => setAuditFilter("identity")}
                  >
                    Identity
                  </button>
                  <button
                    className={auditFilter === "ucan" ? "follow following" : "follow secondary"}
                    onClick={() => setAuditFilter("ucan")}
                  >
                    UCAN
                  </button>
                  <button
                    className={auditFilter === "revocation" ? "follow following" : "follow secondary"}
                    onClick={() => setAuditFilter("revocation")}
                  >
                    Revocations
                  </button>
                  <button
                    className={auditSort === "newest" ? "follow following" : "follow secondary"}
                    onClick={() => setAuditSort("newest")}
                  >
                    Newest
                  </button>
                  <button
                    className={auditSort === "oldest" ? "follow following" : "follow secondary"}
                    onClick={() => setAuditSort("oldest")}
                  >
                    Oldest
                  </button>
                </div>
                <div className="alerts-list">
                  {filteredAuditLog.slice(0, 5).map((entry) => (
                    <button
                      type="button"
                      className="alert-row"
                      key={entry.id}
                      onClick={() => {
                        setSelectedAuditEntry(entry);
                        setActionNote(`Opened audit entry ${entry.event}.`);
                      }}
                    >
                      <span>{entry.event}</span>
                      <span className="muted">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </button>
                  ))}
                  {filteredAuditLog.length === 0 && (
                    <div className="alert-row">
                      <span className="muted">
                        {auditLog.length === 0 ? "No security actions recorded yet." : "No entries match this filter."}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="profile-actions">
                <button
                  className="follow secondary"
                  onClick={() => {
                    const nextIdentity = createIdentityRecord();
                    setIdentity(nextIdentity);
                    recordSecurityEvent("identity.created", `did issued ${formatDidHandle(nextIdentity.did)}`);
                    setActionNote(`Identity created: ${formatDidHandle(nextIdentity.did)}`);
                  }}
                >
                  Create DID
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    setIdentity(null);
                    setDelegation(null);
                    recordSecurityEvent("identity.cleared", "identity and delegation cleared");
                    setActionNote("Identity cleared.");
                  }}
                >
                  Clear DID
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    if (!identity) {
                      setActionNote("Create DID first.");
                      return;
                    }
                    const audience = createIdentityRecord().did;
                    const nextDelegation = createUcanDelegation({
                      issuerDid: identity.did,
                      audienceDid: audience,
                      capabilities: [{ with: identity.did, can: "feed/publish" }],
                      ttlSeconds: 3600
                    });
                    setDelegation(nextDelegation);
                    recordSecurityEvent("ucan.created", `delegated publish to ${formatDidHandle(audience)}`);
                    setActionNote(`UCAN delegated to ${formatDidHandle(audience)}.`);
                  }}
                >
                  Create UCAN
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    if (!delegation) {
                      setActionNote("No active UCAN to revoke.");
                      return;
                    }
                    const entry = createOfflineRevocationEntry(
                      delegation.revocationId,
                      "manual profile revoke"
                    );
                    setRevocationQueue((current) => enqueueOfflineRevocation(current, entry));
                    setRevocationList((current) =>
                      addRevocationListEntry(current, delegation.revocationId, "manual profile revoke")
                    );
                    setDelegation(null);
                    recordSecurityEvent("ucan.revoked", `queued revoke for ${formatDidHandle(delegation.audienceDid)}`);
                    setActionNote("UCAN revoked and queued for offline replay.");
                  }}
                >
                  Revoke UCAN
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    setSafeReplayOnly((current) => !current);
                    setUnsafeReplayConfirmArmed(false);
                    setActionNote(`Safe replay only ${!safeReplayOnly ? "enabled" : "disabled"}.`);
                  }}
                >
                  Safe Replay Only: {safeReplayOnly ? "On" : "Off"}
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    const overrideUntil = Date.now() + 5 * 60 * 1000;
                    setUnsafeReplayOverrideUntil(overrideUntil);
                    setUnsafeReplayConfirmArmed(false);
                    recordSecurityEvent(
                      "revocation.verified",
                      `temporary unsafe replay override granted until ${new Date(overrideUntil).toISOString()}`
                    );
                    setActionNote("Temporary unsafe replay override enabled for 5 minutes.");
                  }}
                >
                  Temporarily Allow Unsafe Replay (5m)
                </button>
                {unsafeReplayOverrideActive && (
                  <div className="alert-row">
                    <span>
                      Unsafe replay override active until {new Date(unsafeReplayOverrideUntil ?? 0).toLocaleTimeString()}.
                    </span>
                  </div>
                )}
                <button
                  className="follow secondary"
                  onClick={() => void (async () => {
                    if (revocationList.entries.length > 0 && revocationListPolicyStatus !== "valid") {
                      if (safeReplayOnly && !unsafeReplayOverrideActive) {
                        recordSecurityEvent(
                          "revocation.verified",
                          `unsafe replay denied (${revocationListPolicyStatus}) due to safe replay mode`
                        );
                        setActionNote(
                          `Replay denied: policy is ${revocationListPolicyStatus} and Safe Replay Only is enabled.`
                        );
                        return;
                      }
                      if (!safeReplayOnly && !unsafeReplayConfirmArmed) {
                        setUnsafeReplayConfirmArmed(true);
                        recordSecurityEvent(
                          "revocation.verified",
                          `unsafe replay confirmation required (${revocationListPolicyStatus})`
                        );
                        setActionNote(
                          `Replay blocked: policy is ${revocationListPolicyStatus}. Press Replay Revocations again to confirm unsafe replay.`
                        );
                        return;
                      }
                    }
                    setUnsafeReplayConfirmArmed(false);
                    const result = replayOfflineRevocations(revocationQueue, 50);
                    if (result.replayed.length === 0) {
                      setActionNote("No queued revocations to replay.");
                      return;
                    }
                    const flushed = await flushRevocationQueueCommand(
                      result.replayed.map((entry) => entry.revocationId)
                    );
                    if (!flushed) {
                      setRevocationQueue(result.remaining);
                      recordSecurityEvent("revocation.replayed", `replayed ${result.replayed.length} queued revoke(s)`);
                      setActionNote(`Replayed ${result.replayed.length} queued revocation(s).`);
                      return;
                    }
                    const replayedSet = new Set(result.replayed.map((entry) => entry.revocationId));
                    setRevocationQueue((current) => current.filter((entry) => !replayedSet.has(entry.revocationId)));
                    setRevocationList((current) => {
                      let next = current;
                      for (const revocationId of flushed.flushedIds) {
                        next = addRevocationListEntry(next, revocationId, "flushed replay");
                      }
                      return next;
                    });
                    setFailedFlushQueue((current) =>
                      upsertFailedRevocationRetries(
                        removeFailedRetries(current, flushed.flushedIds),
                        flushed.failedIds,
                        Date.now(),
                        "tauri flush failed"
                      )
                    );
                    recordSecurityEvent(
                      "revocation.replayed",
                      `flushed ${flushed.flushedIds.length} revoke(s), failed ${flushed.failedIds.length}`
                    );
                    setActionNote(
                      `Flushed ${flushed.flushedIds.length} revocation(s); ${flushed.failedIds.length} failed.`
                    );
                  })()}
                >
                  Replay Revocations
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    if (!identity) {
                      setActionNote("Create DID first to sign revocation list.");
                      return;
                    }
                    setRevocationList((current) => signRevocationList(current, identity.did));
                    recordSecurityEvent("revocation.verified", "revocation list signed");
                    setActionNote("Revocation list signed.");
                  }}
                >
                  Sign Revocation List
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    const verified = verifyRevocationListSignature(revocationList);
                    recordSecurityEvent(
                      "revocation.verified",
                      `revocation list integrity ${verified ? "verified" : "failed"}`
                    );
                    setActionNote(`Revocation list integrity ${verified ? "verified" : "failed"}.`);
                  }}
                >
                  Verify Revocation List
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    const issuerDid = revocationList.issuerDid;
                    if (!issuerDid) {
                      setActionNote("Revocation list has no issuer DID to trust.");
                      return;
                    }
                    setTrustedRevocationIssuers((current) => {
                      if (current.includes(issuerDid)) {
                        return current;
                      }
                      return [...current, issuerDid];
                    });
                    recordSecurityEvent("revocation.verified", `trusted issuer ${issuerDid}`);
                    setActionNote("Revocation list issuer trusted.");
                  }}
                >
                  Trust Issuer
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    const issuerDid = revocationList.issuerDid;
                    if (!issuerDid) {
                      setActionNote("Revocation list has no issuer DID to untrust.");
                      return;
                    }
                    setTrustedRevocationIssuers((current) =>
                      current.filter((did) => did !== issuerDid)
                    );
                    recordSecurityEvent("revocation.verified", `removed trusted issuer ${issuerDid}`);
                    setActionNote("Revocation list issuer removed from trust list.");
                  }}
                >
                  Untrust Issuer
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    if (!delegation) {
                      setActionNote("No active UCAN delegation to verify.");
                      return;
                    }
                    const status = verifyDelegationRevocation(delegation, revocationList, Date.now());
                    recordSecurityEvent(
                      "ucan.verified",
                      `delegation ${status} for ${formatDidHandle(delegation.audienceDid)}`
                    );
                    setActionNote(`UCAN verification result: ${status}.`);
                  }}
                >
                  Verify UCAN
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    if (!delegation) {
                      setActionNote("No active UCAN delegation to mark revoked.");
                      return;
                    }
                    setRevocationList((current) =>
                      addRevocationListEntry(current, delegation.revocationId, "manual verification marker")
                    );
                    recordSecurityEvent("ucan.verified", `marked ${delegation.revocationId} as revoked`);
                    setActionNote("Current delegation marked in revocation list.");
                  }}
                >
                  Mark Revoked
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    setRevocationList(createRevocationList());
                    setActionNote("Revocation list cleared.");
                  }}
                >
                  Clear Revocation List
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    if (failedFlushQueue.length === 0) {
                      setActionNote("No failed flush retries queued.");
                      return;
                    }
                    const { ready, pending } = splitReadyFailedRetries(failedFlushQueue, Date.now());
                    if (ready.length === 0) {
                      const nextRetryAt = pending.length > 0 ? Math.min(...pending.map((entry) => entry.nextRetryAt)) : null;
                      setActionNote(
                        nextRetryAt ? `No retries ready until ${new Date(nextRetryAt).toLocaleTimeString()}.` : "No retries ready."
                      );
                      return;
                    }
                    setRevocationQueue((current) => {
                      let next = [...current];
                      for (const retry of ready) {
                        next = enqueueOfflineRevocation(
                          next,
                          createOfflineRevocationEntry(retry.revocationId, `retry attempt ${retry.retryCount}`)
                        );
                      }
                      return next;
                    });
                    setFailedFlushQueue(pending);
                    recordSecurityEvent("revocation.replayed", `re-queued ${ready.length} failed revoke(s) for replay`);
                    setActionNote(`Re-queued ${ready.length} failed revocation(s).`);
                  }}
                >
                  Retry Failed Flushes
                </button>
                <button className="follow secondary" onClick={resetDemoState}>Reset Demo Data</button>
                <button className="follow secondary" onClick={exportAuditLog}>
                  <Download size={14} />
                  Export Audit
                </button>
                <button
                  className="follow secondary"
                  onClick={() => {
                    setAuditLog([]);
                    setActionNote("Security audit log cleared.");
                  }}
                >
                  Clear Audit
                </button>
                <button className="follow secondary" onClick={exportDemoState}>
                  <Download size={14} />
                  Export Demo State
                </button>
                <button
                  className="follow secondary"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload size={14} />
                  Import Demo State
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden-file"
                  onChange={importDemoState}
                />
              </div>
            </>
          )}
          {activeTab === "alerts" && (
            <div className="alerts-panel">
              <h3>Alert Center</h3>
              <button
                className="follow secondary"
                onClick={() => {
                  setUnreadAlerts(0);
                  setActionNote("All alerts marked as read.");
                }}
              >
                Mark All Read
              </button>
              <div className="alerts-list">
                {posts.filter((post) => post.tag === "alerts").slice(0, 4).map((post) => (
                  <div className="alert-row" key={`${post.cid}-alert`}>
                    <span>{post.cid}...</span>
                    <span className="muted">new</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      <nav className="mobile-nav glass" aria-label="Mobile nav">
        <button
          className={activeTab === "main" ? "active-mobile" : ""}
          onClick={() => {
            setActiveTab("main");
            setActionNote("Switched to Main.");
          }}
        >
          <Home size={17} />
        </button>
        <button
          onClick={() => {
            setSearchOpen((open) => !open);
            setActionNote("Search toggled.");
          }}
        >
          <Search size={17} />
        </button>
        <button
          className="fab"
          aria-label="Compose"
          onClick={() => {
            setComposeOpen(true);
            setActionNote("Compose opened.");
          }}
        >
          <Plus size={20} />
        </button>
        <button
          className={activeTab === "alerts" ? "active-mobile" : ""}
          onClick={() => {
            setActiveTab("alerts");
            setUnreadAlerts(0);
            setActionNote("Switched to Alerts.");
          }}
        >
          <Bell size={17} />
          {unreadAlerts > 0 && <span className="badge mobile-badge">{unreadAlerts}</span>}
        </button>
        <button
          className={activeTab === "profile" ? "active-mobile" : ""}
          onClick={() => {
            setActiveTab("profile");
            setActionNote("Switched to Profile.");
          }}
        >
          <User size={17} />
        </button>
      </nav>

      {isWizardOpen && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Private node wizard"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setWizardOpen(false);
            }
          }}
        >
          <div className="modal-card">
            <button className="close-btn" onClick={() => setWizardOpen(false)} aria-label="Close wizard">
              <X size={16} />
            </button>
            <h3>Private Node Wizard</h3>
            <p className="muted">Choose onboarding path:</p>
            <div className="wizard-actions">
              <button
                className="cta"
                onClick={() => void startNodeFromWizard("easy")}
              >
                Quick Start
              </button>
              <button
                className="follow"
                onClick={() => {
                  setWizardMode("private");
                  setWizardStep(2);
                  setActionNote("Private mode selected.");
                }}
              >
                Advanced Flow
              </button>
            </div>
            <div className="wizard-step">Step {wizardStep} / 3</div>
            {wizardStep === 1 && (
              <div className="wizard-body">
                <button className="follow secondary" onClick={() => { setWizardMode("easy"); setWizardStep(2); }}>
                  Easy Mode (public peers)
                </button>
                <button className="follow secondary" onClick={() => { setWizardMode("private"); setWizardStep(2); }}>
                  Private Mode (swarm key)
                </button>
              </div>
            )}
            {wizardStep === 2 && (
              <div className="wizard-body">
                <p className="muted">
                  Mode selected: <strong>{wizardMode === "private" ? "Private" : "Easy"}</strong>
                </p>
                <button className="follow secondary" onClick={() => setWizardStep(1)}>Back</button>
                <button className="cta" onClick={() => setWizardStep(3)}>Generate Config</button>
              </div>
            )}
            {wizardStep === 3 && (
              <div className="wizard-body">
                <p className="muted">Configuration generated (mock). You can now start the node.</p>
                <button
                  className="cta"
                  onClick={() => void startNodeFromWizard(wizardMode === "private" ? "private" : "easy")}
                >
                  Finish & Start Node
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isComposeOpen && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Compose post"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setComposeOpen(false);
            }
          }}
        >
          <div className="modal-card">
            <button className="close-btn" onClick={() => setComposeOpen(false)} aria-label="Close composer">
              <X size={16} />
            </button>
            <h3>Compose</h3>
            <textarea
              className="compose-textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  publishDraft();
                }
              }}
              placeholder="Write immutable CID content..."
            />
            <div className="compose-footer">
              <span className="muted">Ctrl/Cmd + Enter to publish</span>
              <button className="cta" onClick={publishDraft} disabled={draft.trim().length === 0}>
                Publish Mock Post
              </button>
            </div>
          </div>
        </div>
      )}

      {isHelpOpen && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Help and shortcuts"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false);
            }
          }}
        >
          <div className="modal-card">
            <button className="close-btn" onClick={() => setHelpOpen(false)} aria-label="Close help">
              <X size={16} />
            </button>
            <h3>Help & Shortcuts</h3>
            <div className="help-list">
              <div><kbd>/</kbd> Open search</div>
              <div><kbd>c</kbd> Open compose</div>
              <div><kbd>Ctrl/Cmd + Enter</kbd> Publish compose text</div>
              <div><kbd>u</kbd> Undo last deleted post</div>
              <div><kbd>Esc</kbd> Close active modal</div>
              <div><kbd>?</kbd> Open this help panel</div>
            </div>
          </div>
        </div>
      )}

      {selectedAuditEntry && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Audit entry detail"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedAuditEntry(null);
            }
          }}
        >
          <div className="modal-card">
            <button className="close-btn" onClick={() => setSelectedAuditEntry(null)} aria-label="Close audit detail">
              <X size={16} />
            </button>
            <h3>Audit Entry</h3>
            <div className="help-list">
              <div><strong>Event:</strong> {selectedAuditEntry.event}</div>
              <div><strong>Detail:</strong> {selectedAuditEntry.detail}</div>
              <div><strong>Timestamp:</strong> {new Date(selectedAuditEntry.timestamp).toISOString()}</div>
              <div><strong>ID:</strong> {selectedAuditEntry.id}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
