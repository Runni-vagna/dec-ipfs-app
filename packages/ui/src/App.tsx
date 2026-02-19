/**
 * SDP v1.1 Phase 0 • UI
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Threats
 * Immutability: CIDs are permanent
 */

import { useMemo, useState, type ReactNode } from "react";
import { Bell, Compass, Home, Plus, Search, Shield, User, X } from "lucide-react";

type Tab = "main" | "discover" | "private" | "alerts" | "profile";

type FeedItem = {
  cid: string;
  body: string;
  tag: Tab | "all";
};

export const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>("main");
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [followedCids, setFollowedCids] = useState<Record<string, boolean>>({});
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [actionNote, setActionNote] = useState("Ready");
  const [posts, setPosts] = useState<FeedItem[]>([
    { cid: "bafybeigd", body: "CIDFeed content sharing post", tag: "main" },
    { cid: "bafybeih2", body: "Swarm update: private peers online", tag: "private" },
    { cid: "bafybeiak", body: "OrbitDB sync in 642ms", tag: "discover" },
    { cid: "bafybeip7", body: "Published immutable post CID", tag: "alerts" }
  ]);

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
                <input
                  className="search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search CID or content"
                  aria-label="Search posts"
                />
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
              return (
                <article className="feed-card" key={key} role="listitem">
                  <div>
                    <p className="cid">{post.cid}... {post.body}</p>
                    <p className="muted">Immutable CID · live OrbitDB update</p>
                  </div>
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
                </article>
              );
            })}
          </div>
        </section>

        <aside className="glass panel right-rail">
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
            setActionNote("Switched to Alerts.");
          }}
        >
          <Bell size={17} />
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
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Private node wizard">
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
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Compose post">
          <div className="modal-card">
            <button className="close-btn" onClick={() => setComposeOpen(false)} aria-label="Close composer">
              <X size={16} />
            </button>
            <h3>Compose</h3>
            <textarea
              className="compose-textarea"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write immutable CID content..."
            />
            <button className="cta" onClick={publishDraft}>Publish Mock Post</button>
          </div>
        </div>
      )}
    </div>
  );
};
