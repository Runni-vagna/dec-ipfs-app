/**
 * SDP v1.1 Phase 0 • UI
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Threats
 * Immutability: CIDs are permanent
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, Compass, Home, Plus, Search, Shield, User, X } from "lucide-react";

type Tab = "main" | "discover" | "private" | "alerts" | "profile";

type FeedItem = {
  cid: string;
  body: string;
  tag: Tab | "all";
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
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [actionNote, setActionNote] = useState("Ready");
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
    const lowered = query.trim().toLowerCase();
    if (lowered.length === 0) {
      return tabFiltered;
    }
    return tabFiltered.filter(
      (post) => post.cid.toLowerCase().includes(lowered) || post.body.toLowerCase().includes(lowered)
    );
  }, [activeTab, posts, query]);

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
      if (event.key === "Escape") {
        setWizardOpen(false);
        setComposeOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const resetDemoState = () => {
    setActiveTab("main");
    setSearchOpen(false);
    setQuery("");
    setFollowedCids({});
    setPinnedCids({});
    setWizardOpen(false);
    setComposeOpen(false);
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
              <button
                className="cta"
                onClick={() => {
                  setWizardOpen(true);
                  setActionNote("Private wizard opened.");
                }}
              >
                Open Wizard
              </button>
            </>
          ) : (
            <>
              <h2>Profile Tools</h2>
              <p className="muted">Quick maintenance actions for your local demo state.</p>
              <button className="follow secondary" onClick={resetDemoState}>Reset Demo Data</button>
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
                Easy Mode
              </button>
              <button
                className="follow"
                onClick={() => {
                  setActionNote("Private Swarm selected (mock).");
                  setWizardOpen(false);
                }}
              >
                Private Swarm
              </button>
            </div>
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
    </div>
  );
};
