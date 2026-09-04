import { useState } from 'react';
import Avatar from './Avatar.jsx';
import { formatListTime } from '../time.js';
import {
  SearchIcon,
  PencilIcon,
  MoonIcon,
  SunIcon,
  LogoutIcon,
  Logo,
} from './icons.jsx';

function ConvItem({ conv, meId, active, online, onOpen }) {
  const m = conv.lastMessage;
  return (
    <button className={`conv-item ${active ? 'active' : ''}`} onClick={onOpen}>
      <Avatar user={conv.peer} size={52} showStatus={Boolean(online?.online)} />
      <span className="conv-item-body">
        <span className="conv-item-top">
          <span className="conv-item-name">{conv.peer.displayName}</span>
          <span className={`conv-item-time ${conv.unread ? 'unread' : ''}`}>
            {m ? formatListTime(m.createdAt) : ''}
          </span>
        </span>
        <span className="conv-item-bottom">
          <span className={`conv-item-preview ${conv.unread ? 'unread' : ''}`}>
            {m ? `${m.senderId === meId ? 'Vous : ' : ''}${m.body}` : 'Nouvelle conversation'}
          </span>
          {conv.unread > 0 && (
            <span className="badge">{conv.unread > 99 ? '99+' : conv.unread}</span>
          )}
        </span>
      </span>
    </button>
  );
}

export default function Sidebar({
  user,
  conversations,
  online,
  activeId,
  theme,
  onToggleTheme,
  onOpen,
  onNew,
  onLogout,
  mobilePane,
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? conversations.filter((c) => c.peer.displayName.toLowerCase().includes(needle))
    : conversations;

  return (
    <aside className={`sidebar ${mobilePane === 'chat' ? 'hidden' : ''}`}>
      <header className="sidebar-header">
        <div className="sidebar-brand">
          <Logo size={26} />
          <span>my-sms</span>
        </div>
        <div className="sidebar-actions">
          <button
            className="icon-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            aria-label="Changer de thème"
          >
            {theme === 'dark' ? <SunIcon size={19} /> : <MoonIcon size={19} />}
          </button>
          <button className="icon-btn" onClick={onNew} title="Nouvelle conversation" aria-label="Nouvelle conversation">
            <PencilIcon size={19} />
          </button>
          <button className="icon-btn" onClick={onLogout} title="Se déconnecter" aria-label="Se déconnecter">
            <LogoutIcon size={19} />
          </button>
        </div>
      </header>

      <div className="sidebar-search">
        <SearchIcon size={17} className="sidebar-search-icon" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une conversation"
          aria-label="Rechercher une conversation"
        />
      </div>

      <nav className="conv-list" aria-label="Conversations">
        {filtered.length === 0 && (
          <div className="conv-empty">
            {conversations.length === 0
              ? 'Aucune conversation pour l’instant. Touche le crayon pour lancer la première !'
              : 'Aucune conversation ne correspond à ta recherche.'}
          </div>
        )}
        {filtered.map((c) => (
          <ConvItem
            key={c.id}
            conv={c}
            meId={user.id}
            active={c.id === activeId}
            online={online[c.peer.id]}
            onOpen={() => onOpen(c.id)}
          />
        ))}
      </nav>

      <footer className="sidebar-footer">
        <Avatar user={user} size={38} />
        <span className="sidebar-footer-info">
          <strong>{user.displayName}</strong>
          <span>@{user.username}</span>
        </span>
      </footer>
    </aside>
  );
}
