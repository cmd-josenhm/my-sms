import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Avatar from './Avatar.jsx';
import { SearchIcon, XIcon, UserPlusIcon } from './icons.jsx';

export default function NewConversationModal({ me, onClose, onPick, toast }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const users = await api.searchUsers(needle);
        setResults(users);
      } catch (e) {
        toast?.(e.message);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  function onKey(e) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Nouvelle conversation" onKeyDown={onKey}>
        <div className="modal-header">
          <h2>Nouvelle conversation</h2>
          <button className="icon-btn" onClick={onClose} title="Fermer" aria-label="Fermer">
            <XIcon size={19} />
          </button>
        </div>
        <div className="modal-search">
          <SearchIcon size={17} className="modal-search-icon" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un ami (nom, @pseudo, e-mail)…"
            aria-label="Rechercher un utilisateur"
          />
        </div>
        <div className="modal-body">
          {q.trim().length === 0 && (
            <div className="modal-empty">
              <UserPlusIcon size={34} />
              <p>
                Tape au moins un caractère pour trouver un ami.
                <br />
                La conversation s’ouvrira automatiquement.
              </p>
            </div>
          )}
          {q.trim().length > 0 && loading && (
            <div className="modal-loading"><div className="spinner" /></div>
          )}
          {!loading && q.trim().length > 0 && results.length === 0 && (
            <div className="modal-empty">
              <p>Aucun utilisateur trouvé pour « {q.trim()} ».</p>
            </div>
          )}
          {!loading &&
            results.map((u) => (
              <button
                key={u.id}
                className="user-row"
                onClick={() => {
                  if (u.id === me.id) return;
                  onPick(u.id);
                }}
                disabled={u.id === me.id}
              >
                <Avatar user={u} size={42} showStatus={u.online} />
                <span className="user-row-info">
                  <strong>{u.displayName}</strong>
                  <span>@{u.username}</span>
                </span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
