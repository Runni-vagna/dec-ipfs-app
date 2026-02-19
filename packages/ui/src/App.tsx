/**
 * SDP v1.1 Phase 0 • UI
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Threats
 * Immutability: CIDs are permanent
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Bell, CircleHelp, Compass, Download, Home, Plus, Search, Shield, Trash2, Upload, User, X } from "lucide-react";

type Tab = "main" | "discover" | "private" | "alerts" | "profile";

type FeedItem = {
  cid: string;
  body: string;
  tag: Tab | "all";
};

type WizardMode = "easy" | "private" | null;

type RemovedSnapshot = {
  post: FeedItem;
  index: number;
};

const STORAGE_KEYS = {
  tab: "cidfeed.ui.activeTab",
  posts: "cidfeed.ui.posts",
  follows: "cidfeed.ui.follows",
  unread: "cidfeed.ui.unreadAlerts",
  pins: "cidfeed.ui.pinnedCids"
} as const;

const DEFAULT_POSTS: FeedItem[] = [
  { cid: "bafybeigd", body: "CIDFeed content sharing post", tag: "main" },
  { cid: "bafybeih2", body: "Swarm update: private peers online", tag: "private" },
  { cid: "bafybeiak", body: "OrbitDB sync in 642ms", tag: "discover" },
  { cid: "bafybeip7", body: "Published immutable post CID", tag: "alerts" }
];

const parseTab = (value: string | null): Tab => {
  if (value === "main" || value === "discover" || value === "private" || value === "alerts" || value === "profile") {
    return value;
  }
  return "main";
};

export const App = () => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window === "undefined") {
      return "main";
    }
    return parseTab(window.localStorage.getItem(STORAGE_KEYS.tab));
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
    const tabFiltered = posts.filter((post) => post.tag === activeTab || post.tag === "all");
    const pinFiltered = pinnedOnly ? tabFiltered.filter((post) => pinnedCids[post.cid] === true) : tabFiltered;
    const lowered = query.trim().toLowerCase();
    if (lowered.length === 0) {
      return pinFiltered;
    }
    return pinFiltered.filter(
      (post) => post.cid.toLowerCase().includes(lowered) || post.body.toLowerCase().includes(lowered)
    );
  }, [activeTab, pinnedOnly, pinnedCids, posts, query]);

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
    const stamp = Date.now().toString(36);
    setPosts((current) => [
      { cid: `bafy${stamp.slice(0, 5)}`, body: trimmed, tag: activeTab },
      ...current
    ]);
    if (activeTab !== "alerts") {
      setUnreadAlerts((count) => count + 1);
    }
    setActionNote("Post published to local mock feed.");
    setDraft("");
    setComposeOpen(false);
  };

  const removePost = (target: FeedItem) => {
    setPosts((current) => {
      const index = current.findIndex((post) => post.cid === target.cid && post.body === target.body);
      if (index === -1) {
        return current;
      }
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) {
        setLastRemoved({ post: removed, index });
        setActionNote(`Removed ${removed.cid}...`);
      }
      return next;
    });
  };

  const undoRemove = () => {
    if (!lastRemoved) {
      return;
    }
    setPosts((current) => {
      const next = [...current];
      const safeIndex = Math.max(0, Math.min(lastRemoved.index, next.length));
      next.splice(safeIndex, 0, lastRemoved.post);
      return next;
    });
    setLastRemoved(null);
    setActionNote("Removal undone.");
  };

  const exportDemoState = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      activeTab,
      unreadAlerts,
      followedCids,
      pinnedCids,
      posts
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cidfeed-demo-state-${Date.now()}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    setActionNote("Demo state exported.");
  };

  const openWizard = () => {
    setWizardMode(null);
    setWizardStep(1);
    setWizardOpen(true);
    setActionNote("Private wizard opened.");
  };

  const togglePrivateNode = () => {
    if (privateNodeOnline) {
      setPrivateNodeOnline(false);
      setPeerCount(0);
      setActionNote("Private node stopped.");
      return;
    }
    setPrivateNodeOnline(true);
    setPeerCount(3);
    setActionNote("Private node started.");
  };

  const simulatePeerJoin = () => {
    if (!privateNodeOnline) {
      setActionNote("Start private node first.");
      return;
    }
    setPeerCount((count) => count + 1);
    setActionNote("Peer joined private swarm (mock).");
  };

  const importDemoState = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as {
        activeTab?: string;
        unreadAlerts?: number;
        followedCids?: Record<string, boolean>;
        pinnedCids?: Record<string, boolean>;
        posts?: FeedItem[];
      };
      setActiveTab(parseTab(payload.activeTab ?? "main"));
      setUnreadAlerts(typeof payload.unreadAlerts === "number" ? Math.max(0, payload.unreadAlerts) : 0);
      setFollowedCids(payload.followedCids ?? {});
      setPinnedCids(payload.pinnedCids ?? {});
      setPosts(Array.isArray(payload.posts) && payload.posts.length > 0 ? payload.posts : DEFAULT_POSTS);
      setPinnedOnly(false);
      setActionNote("Demo state imported.");
    } catch {
      setActionNote("Import failed: invalid JSON.");
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
    if (activeTab === "alerts" && unreadAlerts > 0) {
      setUnreadAlerts(0);
      setActionNote("Alerts marked as read.");
    }
  }, [activeTab, unreadAlerts]);

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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lastRemoved]);

  const resetDemoState = () => {
    setActiveTab("main");
    setSearchOpen(false);
    setQuery("");
    setFollowedCids({});
    setPinnedCids({});
    setWizardOpen(false);
    setComposeOpen(false);
    setHelpOpen(false);
    setPrivateNodeOnline(false);
    setPeerCount(0);
    setDraft("");
    setUnreadAlerts(0);
    setPosts(DEFAULT_POSTS);
    window.localStorage.removeItem(STORAGE_KEYS.tab);
    window.localStorage.removeItem(STORAGE_KEYS.posts);
    window.localStorage.removeItem(STORAGE_KEYS.follows);
    window.localStorage.removeItem(STORAGE_KEYS.unread);
    window.localStorage.removeItem(STORAGE_KEYS.pins);
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
                        setPinnedCids((current) => ({
                          ...current,
                          [post.cid]: next
                        }));
                        setActionNote(next ? `Pinned ${post.cid}.` : `Unpinned ${post.cid}.`);
                      }}
                    >
                      {isPinned ? "Pinned" : "Pin"}
                    </button>
                    <button
                      className={isFollowed ? "follow following" : "follow"}
                      onClick={() => {
                        const next = !isFollowed;
                        setFollowedCids((current) => ({
                          ...current,
                          [post.cid]: next
                        }));
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
                <button className="follow secondary" onClick={togglePrivateNode}>
                  {privateNodeOnline ? "Stop Node" : "Start Node"}
                </button>
                <button className="follow secondary" onClick={simulatePeerJoin}>Simulate Peer Join</button>
                <p className="muted">Private status: {privateNodeOnline ? "Online" : "Offline"} · Peers: {peerCount}</p>
              </div>
            </>
          ) : (
            <>
              <h2>Profile Tools</h2>
              <p className="muted">Quick maintenance actions for your local demo state.</p>
              <div className="profile-actions">
                <button className="follow secondary" onClick={resetDemoState}>Reset Demo Data</button>
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
                onClick={() => {
                  setActionNote("Easy Mode selected (mock).");
                  setWizardOpen(false);
                }}
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
                  onClick={() => {
                    setPrivateNodeOnline(true);
                    setPeerCount(wizardMode === "private" ? 2 : 4);
                    setWizardOpen(false);
                    setActionNote("Wizard complete. Node started.");
                  }}
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
    </div>
  );
};
