import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from './api.js';
import { getSocket, closeSocket } from './socket.js';
import AuthScreen from './components/AuthScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import NewConversationModal from './components/NewConversationModal.jsx';
import Toasts from './components/Toast.jsx';
import { Logo, UserPlusIcon } from './components/icons.jsx';

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('mysms-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('mysms-theme', theme);
    } catch {}
  }, [theme]);
  return [theme, useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])];
}

function sortConvs(a, b) {
  const ta = a.lastMessage?.createdAt ? +new Date(a.lastMessage.createdAt) : 0;
  const tb = b.lastMessage?.createdAt ? +new Date(b.lastMessage.createdAt) : 0;
  return tb - ta || b.id - a.id;
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [online, setOnline] = useState({});
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState({});
  const [hasMore, setHasMore] = useState({});
  const [loadingHist, setLoadingHist] = useState(false);
  const [peerReadAt, setPeerReadAt] = useState({});
  const [typing, setTyping] = useState({});
  const [connected, setConnected] = useState(true);
  const [mobilePane, setMobilePane] = useState('list');
  const [showNew, setShowNew] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [toasts, setToasts] = useState([]);

  const userRef = useRef(null);
  const activeIdRef = useRef(null);
  const messagesRef = useRef({});
  const readCursorRef = useRef({});
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const toast = useCallback((text, kind = 'error') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // --- Démarrage : vérification de session ---
  useEffect(() => {
    api.me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  // Fermeture propre du socket au démontage.
  useEffect(() => () => closeSocket(), []);

  // --- Socke.t : événements temps réel ---
  useEffect(() => {
    if (!user) return;
    const s = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onPresence = ({ userId, online: on, lastSeenAt }) =>
      setOnline((m) => ({ ...m, [userId]: { online: on, lastSeenAt } }));

    const onMessageNew = ({ message }) => {
      setMessages((prev) => {
        const arr = prev[message.conversationId] || [];
        if (arr.some((m) => m.id === message.id)) return prev;
        return { ...prev, [message.conversationId]: [...arr, message] };
      });
      const active = activeIdRef.current;
      const focused = document.visibilityState === 'visible';
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== message.conversationId) return c;
          const mine = message.senderId === userRef.current.id;
          return {
            ...c,
            lastMessage: message,
            unread: mine || (active === c.id && focused) ? 0 : c.unread + 1,
          };
        })
      );
      // Accusé de lecture automatique si la conversation est ouverte et visible.
      if (!mine && active === message.conversationId && focused) {
        emitRead(message.conversationId, message.id);
      }
    };
    const onMessagesRead = ({ conversationId, readerId, readAt }) => {
      if (readerId !== userRef.current?.id) {
        setPeerReadAt((prev) => ({ ...prev, [conversationId]: readAt }));
      }
    };
    const onTyping = ({ conversationId, fromId }) => {
      if (fromId === userRef.current?.id) return;
      setTyping((prev) => ({ ...prev, [conversationId]: Date.now() }));
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('presence', onPresence);
    s.on('message:new', onMessageNew);
    s.on('messages:read', onMessagesRead);
    s.on('typing', onTyping);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('presence', onPresence);
      s.off('message:new', onMessageNew);
      s.off('messages:read', onMessagesRead);
      s.off('typing', onTyping);
    };
  }, [user]);

  // --- Chargement initial des conversations ---
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const convs = (await api.conversations()).sort(sortConvs);
        if (cancelled) return;
        setConversations(convs);
        setOnline((prev) => {
          const next = { ...prev };
          for (const c of convs) next[c.peer.id] = { online: c.peer.online, lastSeenAt: c.peer.lastSeenAt };
          return next;
        });
        setPeerReadAt((prev) => {
          const next = { ...prev };
          for (const c of convs) if (c.peerLastReadAt) next[c.id] = c.peerLastReadAt;
          return next;
        });
      } catch (e) {
        toast(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  // --- Lecture : accuse uniquement si on avance le curseur ---
  function emitRead(convId, messageId) {
    const cur = readCursorRef.current[convId];
    if (cur && cur >= messageId) return;
    readCursorRef.current[convId] = messageId;
    getSocket().emit('conversation:read', { conversationId: convId, messageId });
  }

  function markReadIfNeeded(convId) {
    if (!convId) return;
    const arr = messagesRef.current[convId] || [];
    const last = arr[arr.length - 1];
    if (last && last.senderId !== userRef.current?.id) {
      emitRead(convId, last.id);
    }
  }

  // Relecture quand la fenêtre redevient visible.
  useEffect(() => {
    if (!user) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') markReadIfNeeded(activeIdRef.current);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Actions ---
  async function openConversation(convId) {
    setActiveId(convId);
    setMobilePane('chat');
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unread: 0 } : c)));
    const arr = messagesRef.current[convId];
    if (!arr) {
      setLoadingHist(true);
      try {
        const { messages: items, hasMore: more } = await api.messages(convId);
        setMessages((prev) => (prev[convId] ? prev : { ...prev, [convId]: items }));
        setHasMore((prev) => ({ ...prev, [convId]: more }));
        const last = items[items.length - 1];
        if (last && last.senderId !== user.id) emitRead(convId, last.id);
      } catch (e) {
        toast(e.message);
      } finally {
        setLoadingHist(false);
      }
    }
  }

  function sendMessage(text) {
    const body = text.trim();
    const convId = activeId;
    if (!body || !convId) return;
    const tempId = `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const optimistic = {
      id: tempId,
      tempId,
      conversationId: convId,
      senderId: user.id,
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => ({ ...prev, [convId]: [...(prev[convId] || []), optimistic] }));
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, lastMessage: optimistic } : c)));
    getSocket().emit('message:send', { conversationId: convId, body, tempId }, (res) => {
      if (!res?.ok) {
        setMessages((prev) => ({
          ...prev,
          [convId]: prev[convId].map((m) => (m.id === tempId ? { ...m, failed: true } : m)),
        }));
        toast(res?.error === 'slow' ? 'Trop de messages d’un coup — patiente un instant.' : 'Message non envoyé, réessaie.');
        return;
      }
      setMessages((prev) => ({
        ...prev,
        [convId]: prev[convId].map((m) => (m.id === tempId ? res.message : m)),
      }));
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, lastMessage: res.message } : c)));
    });
  }

  async function loadOlder(convId) {
    const arr = messagesRef.current[convId] || [];
    if (!arr.length) return;
    setLoadingHist(true);
    try {
      const { messages: older, hasMore: more } = await api.messages(convId, arr[0].id);
      setMessages((prev) => ({ ...prev, [convId]: [...older, ...(prev[convId] || [])] }));
      setHasMore((prev) => ({ ...prev, [convId]: more }));
    } catch (e) {
      toast(e.message);
    } finally {
      setLoadingHist(false);
    }
  }

  async function startConversation(targetId) {
    try {
      const conv = await api.openConversation(targetId);
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      setOnline((prev) => ({ ...prev, [conv.peer.id]: { online: conv.peer.online, lastSeenAt: conv.peer.lastSeenAt } }));
      setShowNew(false);
      await openConversation(conv.id);
    } catch (e) {
      toast(e.message);
    }
  }

  function logout() {
    closeSocket();
    api.logout().catch(() => {});
    setUser(null);
    setOnline({});
    setConversations([]);
    setActiveId(null);
    setMessages({});
    setHasMore({});
    setPeerReadAt({});
    setTyping({});
    setDrafts({});
    setMobilePane('list');
    readCursorRef.current = {};
  }

  // --- Titre de l'onglet : total des non-lus ---
  const unreadTotal = conversations.reduce((n, c) => n + c.unread, 0);
  useEffect(() => {
    document.title = unreadTotal ? `(${unreadTotal}) my-sms` : 'my-sms';
  }, [unreadTotal]);

  if (booting) {
    return (
      <div className="boot">
        <Logo size={54} />
        <span>my-sms</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthed={setUser} />;
  }

  return (
    <div className="app">
      <Sidebar
        user={user}
        conversations={conversations}
        online={online}
        activeId={activeId}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpen={openConversation}
        onNew={() => setShowNew(true)}
        onLogout={logout}
        mobilePane={mobilePane}
      />

      {activeConv ? (
        <ChatWindow
          key={activeConv.id}
          conv={activeConv}
          me={user}
          messages={messages[activeConv.id] || []}
          hasMore={hasMore[activeConv.id] ?? true}
          loadingHist={loadingHist}
          typing={typing[activeConv.id]}
          peerOnline={online[activeConv.peer.id]}
          peerReadAt={peerReadAt[activeConv.id]}
          connected={connected}
          draft={drafts[activeConv.id] || ''}
          onDraft={(v) => setDrafts((d) => ({ ...d, [activeConv.id]: v }))}
          onSend={sendMessage}
          onLoadOlder={() => loadOlder(activeConv.id)}
          onBack={() => setMobilePane('list')}
          onScrollBottom={() => markReadIfNeeded(activeConv.id)}
        />
      ) : (
        <div className="empty-state">
          <div className="empty-card">
            <Logo size={64} />
            <h2>Bienvenue sur my-sms</h2>
            <p>
              Choisis une conversation dans la liste, ou lance une nouvelle
              discussion avec un ami.
            </p>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <UserPlusIcon size={18} />
              Nouvelle conversation
            </button>
          </div>
        </div>
      )}

      {showNew && (
        <NewConversationModal
          me={user}
          onClose={() => setShowNew(false)}
          onPick={startConversation}
          toast={toast}
        />
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}
