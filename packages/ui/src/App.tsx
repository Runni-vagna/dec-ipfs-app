/**
 * SDP v1.1 Phase 0 • UI
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Threats
 * Immutability: CIDs are permanent
 */

import { Bell, Compass, Home, Plus, Search, Shield, User } from "lucide-react";

const feedRows = [
  "bafybeigd... CIDFeed content sharing post",
  "bafybeih2... Swarm update: private peers online",
  "bafybeiak... OrbitDB sync in 642ms",
  "bafybeip7... Published immutable post CID"
];

export const App = () => {
  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden="true" />
      <main className="layout">
        <aside className="glass panel sidebar">
          <div className="brand">CIDFeed</div>
          <nav className="nav-list" aria-label="Desktop nav">
            <button className="nav-item active"><Home size={16} />Main</button>
            <button className="nav-item"><Compass size={16} />Discover</button>
            <button className="nav-item"><Shield size={16} />Private</button>
            <button className="nav-item"><Bell size={16} />Alerts</button>
            <button className="nav-item"><User size={16} />Profile</button>
          </nav>
          <div className="muted">Offline-first · No server custody</div>
        </aside>

        <section className="glass panel feed">
          <header className="feed-header">
            <h1>Main Feed</h1>
            <button className="icon-btn" aria-label="Search"><Search size={16} /></button>
          </header>
          <div className="timeline" role="list">
            {feedRows.map((row) => (
              <article className="feed-card" key={row} role="listitem">
                <div>
                  <p className="cid">{row}</p>
                  <p className="muted">Immutable CID · live OrbitDB update</p>
                </div>
                <button className="follow">Follow</button>
              </article>
            ))}
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
          <button className="cta">Open Wizard</button>
        </aside>
      </main>

      <nav className="mobile-nav glass" aria-label="Mobile nav">
        <button><Home size={17} /></button>
        <button><Search size={17} /></button>
        <button className="fab" aria-label="Compose"><Plus size={20} /></button>
        <button><Bell size={17} /></button>
        <button><User size={17} /></button>
      </nav>
    </div>
  );
};
