import { useState } from 'react';
import { api, ApiError } from '../api.js';
import { Logo } from './icons.jsx';

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError(null);
  };

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === 'login'
          ? await api.login(form.email, form.password)
          : await api.register({
              email: form.email,
              password: form.password,
              username: form.username.trim(),
              displayName: form.displayName.trim(),
            });
      onAuthed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue, réessaie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="brand-line">
            <Logo size={38} />
            <span className="brand-name">my-sms</span>
          </div>
          <h1>
            Discutez simplement.
            <br />
            Sans le bruit du web.
          </h1>
          <p className="brand-sub">
            Des conversations privées en temps réel, entre amis. Pas de fil
            d’actualité, pas de publicité, pas de distraction — juste vous et
            vos proches.
          </p>
          <ul className="brand-points">
            <li><span>⚡</span> Messages en temps réel</li>
            <li><span>🔒</span> Conversations directes, entre amis</li>
            <li><span>🎨</span> Épuré, clair ou sombre, sur tous les écrans</li>
          </ul>
          <div className="brand-bubbles" aria-hidden="true">
            <div className="brand-bubble">Salut ! Tu es là ? 👋</div>
            <div className="brand-bubble me">Oui, ça va très bien et toi ?</div>
            <div className="brand-bubble">Top ! On se voit ce week-end 🎉</div>
          </div>
        </div>
        <div className="brand-glow" aria-hidden="true" />
      </aside>

      <main className="auth-main">
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-tabs" role="tablist" aria-label="Authentification">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => { setMode('login'); setError(null); }}
            >
              Se connecter
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => { setMode('register'); setError(null); }}
            >
              Créer un compte
            </button>
          </div>

          <h2>{mode === 'login' ? 'Bon retour !' : 'Rejoins my-sms'}</h2>
          <p className="auth-sub">
            {mode === 'login'
              ? 'Continue ta conversation d’où tu l’as laissée.'
              : 'Un compte en 30 secondes, rien de plus.'}
          </p>

          {mode === 'register' && (
            <>
              <label className="field">
                <span>Nom d’affichage</span>
                <input
                  value={form.displayName}
                  onChange={set('displayName')}
                  placeholder="Ex. Camille N."
                  required
                  minLength={2}
                  maxLength={50}
                  autoFocus
                  autoComplete="name"
                />
              </label>
              <label className="field">
                <span>Nom d’utilisateur</span>
                <input
                  value={form.username}
                  onChange={set('username')}
                  placeholder="ex. camille_n"
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="off"
                />
              </label>
            </>
          )}

          <label className="field">
            <span>Adresse e-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="toi@exemple.fr"
              required
              autoComplete="email"
              autoFocus={mode === 'login'}
            />
          </label>

          <label className="field">
            <span>Mot de passe</span>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="8 caractères minimum"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>

          <p className="auth-hint">
            Comptes de démonstration : <code>alice@demo.dev</code> ·{' '}
            <code>bob@demo.dev</code> / <code>demo1234</code>
          </p>
        </form>
      </main>
    </div>
  );
}
