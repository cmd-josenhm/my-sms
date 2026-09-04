import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { getSocket } from '../socket.js';
import { formatTime, formatDay, isSameDay, formatLastSeen } from '../time.js';
import {
  ChevronLeftIcon,
  SendIcon,
  SmileIcon,
  ArrowDownIcon,
  CheckIcon,
  DoubleCheckIcon,
} from './icons.jsx';

const EMOJIS = [
  '😀', '😂', '😍', '😎', '🤔', '😅', '🙃', '😮',
  '👍', '🙏', '👏', '💪', '🤝', '✌️', '🔥', '✨',
  '❤️', '💚', '🎉', '🥳', '😢', '😡', '☕', '🍕',
  '⚽', '🎬', '🌙', '☀️', '🚀', '🎁', '📅', '👋',
];

const TYPING_TTL = 4000;

function Checks({ status }) {
  if (status === 'read') return <DoubleCheckIcon size={15} className="ticks read" />;
  if (status === 'delivered') return <DoubleCheckIcon size={15} className="ticks" />;
  return <CheckIcon size={15} className="ticks" />;
}

function MessageRow({ m, mine, status, grouped, failed }) {
  return (
    <div className={`msg-row ${mine ? 'mine' : 'theirs'} ${grouped ? 'grouped' : ''}`}>
      <div className={`bubble ${failed ? 'failed' : ''}`}>
        <span className="bubble-text">{m.body}</span>
        <span className="bubble-meta">
          <span className="bubble-time">{formatTime(m.createdAt)}</span>
          {mine && <Checks status={status} />}
        </span>
      </div>
    </div>
  );
}

function TypingRow() {
  return (
    <div className="msg-row theirs">
      <div className="bubble typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}

export default function ChatWindow({
  conv,
  me,
  messages,
  hasMore,
  loadingHist,
  typing,
  peerOnline,
  peerReadAt,
  connected,
  draft,
  onDraft,
  onSend,
  onLoadOlder,
  onBack,
  onScrollBottom,
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const prevCountRef = useRef(0);
  const atBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const resizeRef = useRef(null);
  const lastTypingRef = useRef(0);

  const peer = useMemo(
    () => ({
      ...conv.peer,
      online: peerOnline?.online ?? conv.peer.online,
      lastSeenAt: peerOnline?.lastSeenAt ?? conv.peer.lastSeenAt,
    }),
    [conv, peerOnline]
  );

  const isTyping = Boolean(typing) && now - typing < TYPING_TTL;

  // Expire l'indicateur de saisie.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Gestion du scroll : premier chargement (bas), anciens messages (ancrage),
  // nouveaux messages (bas seulement si on y est déjà).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = prevCountRef.current;
    prevCountRef.current = messages.length;
    if (!messages.length) return;
    if (prev === 0) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (resizeRef.current) {
      // Des messages plus anciens viennent d’être préfixés : on ré-ancre la vue.
      const r = resizeRef.current;
      resizeRef.current = null;
      el.scrollTop = el.scrollHeight - r.prevScrollHeight + r.prevScrollTop;
      return;
    }
    if (atBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length]);

  // Autosize du champ de saisie.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 132)}px`;
  }, [draft]);

  // Indique « en train d’écrire » à l’interlocuteur (throttlé).
  useEffect(() => {
    if (!draft.trim()) return;
    const t = Date.now();
    if (t - lastTypingRef.current < 1800) return;
    lastTypingRef.current = t;
    getSocket().emit('typing', { conversationId: conv.id });
  }, [draft, conv.id]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    atBottomRef.current = nearBottom;
    setShowJump(!nearBottom);
    if (el.scrollTop < 60 && hasMore && !loadingOlderRef.current) {
      loadingOlderRef.current = true;
      resizeRef.current = { prevScrollHeight: el.scrollHeight, prevScrollTop: el.scrollTop };
      Promise.resolve(onLoadOlder()).finally(() => {
        loadingOlderRef.current = false;
      });
    }
  }

  function doSend() {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    onDraft('');
    atBottomRef.current = true;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }

  function insertEmoji(e) {
    onDraft((draft || '') + e);
    taRef.current?.focus();
  }

  function statusOf(m) {
    if (peerReadAt && new Date(m.createdAt) < new Date(peerReadAt)) return 'read';
    if (
      peerOnline?.online ||
      (peerOnline?.lastSeenAt && new Date(peerOnline.lastSeenAt) > new Date(m.createdAt))
    ) {
      return 'delivered';
    }
    return 'sent';
  }

  const rows = [];
  let prevMsg = null;
  let lastDay = null;
  for (const m of messages) {
    const day = formatDay(m.createdAt);
    if (day !== lastDay) {
      rows.push(
        <div key={`day-${m.id}`} className="day-divider">
          <span>{day}</span>
        </div>
      );
      lastDay = day;
    }
    const grouped =
      prevMsg &&
      prevMsg.senderId === m.senderId &&
      isSameDay(prevMsg.createdAt, m.createdAt) &&
      new Date(m.createdAt) - new Date(prevMsg.createdAt) < 5 * 60 * 1000;
    rows.push(
      <MessageRow
        key={m.id}
        m={m}
        mine={m.senderId === me.id}
        status={m.senderId === me.id ? statusOf(m) : null}
        grouped={grouped}
        failed={Boolean(m.failed)}
      />
    );
    prevMsg = m;
  }

  return (
    <section className="chat">
      <header className="chat-header">
        <button className="icon-btn back-btn" onClick={onBack} title="Retour" aria-label="Retour aux conversations">
          <ChevronLeftIcon size={21} />
        </button>
        <Avatar user={peer} size={42} showStatus={peer.online} />
        <div className="chat-header-info">
          <strong>{peer.displayName}</strong>
          <span
            className={`chat-header-status ${!connected ? 'off' : isTyping ? 'typing' : peer.online ? 'on' : ''}`}
          >
            {!connected ? 'connexion perdue' : isTyping ? 'est en train d’écrire…' : formatLastSeen(peer)}
          </span>
        </div>
      </header>

      {!connected && (
        <div className="conn-banner" role="alert">
          Connexion perdue — reconnexion en cours…
        </div>
      )}

      <div className="chat-body" ref={scrollRef} onScroll={onScroll}>
        {loadingHist && messages.length === 0 && (
          <div className="hist-loading">
            <div className="spinner" />
          </div>
        )}
        {messages.length > 0 && hasMore && (
          <div className="hist-top">
            {loadingHist ? 'Chargement…' : 'Défiler vers le haut pour les messages plus anciens'}
          </div>
        )}
        {rows}
        {isTyping && <TypingRow />}
      </div>

      {showJump && (
        <button
          className="jump-btn"
          onClick={() => {
            scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' });
            onScrollBottom();
          }}
          title="Aller au dernier message"
          aria-label="Aller au dernier message"
        >
          <ArrowDownIcon size={18} />
        </button>
      )}

      <footer className="chat-input">
        <button
          className="icon-btn emoji-btn"
          onClick={() => setShowEmoji((s) => !s)}
          title="Émojis"
          aria-label="Insérer un émoji"
          aria-expanded={showEmoji}
        >
          <SmileIcon size={21} />
        </button>
        {showEmoji && (
          <div className="emoji-pop" role="menu" aria-label="Émojis">
            {EMOJIS.map((e) => (
              <button key={e} role="menuitem" onClick={() => insertEmoji(e)}>{e}</button>
            ))}
          </div>
        )}
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          placeholder="Écris un message…"
          aria-label="Composer un message"
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setShowEmoji(false)}
        />
        <button
          className="send-btn"
          onClick={doSend}
          disabled={!draft.trim()}
          title="Envoyer (Entrée)"
          aria-label="Envoyer le message"
        >
          <SendIcon size={20} />
        </button>
      </footer>
    </section>
  );
}
