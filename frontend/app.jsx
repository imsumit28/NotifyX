// App shell — login, sidebar, topbar, Socket.io, screen router

const { Icon } = window;
const { Dashboard, Queue, Notifications, Settings, Metrics, ApiKeys } = window.Screens;
const { getToken, getUserId, clearAuth, login, signup, API_BASE } = window.NTFX_AUTH;

// ─── Login/Signup screen ─────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [mode, setMode] = React.useState('signin'); // 'signin' or 'signup'
  const [userId, setUserId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const validateSignup = () => {
    if (!userId.trim()) return 'User ID is required';
    if (userId.length < 3 || userId.length > 30) return 'User ID must be 3-30 characters';
    if (!/^[a-z0-9_]+$/i.test(userId)) return 'User ID must be alphanumeric or underscore';
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const validateSignin = () => {
    if (!userId.trim()) return 'User ID is required';
    if (!password) return 'Password is required';
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const validation = mode === 'signin' ? validateSignin() : validateSignup();
    if (validation) return setError(validation);

    setLoading(true);
    try {
      if (mode === 'signin') {
        await login(userId.trim(), password);
      } else {
        await signup(userId.trim(), password);
      }
      onLogin();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="login-overlay">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="login-brand-mark">N</div>
          <div className="login-brand-name">NotifyX</div>
        </div>

        <h1 className="login-title">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="login-sub">
          {mode === 'signin'
            ? 'Enter your credentials to access NotifyX.'
            : 'Create your account to get started.'}
        </p>

        <div className="login-field">
          <label>User ID</label>
          <input
            type="text" placeholder="e.g. user_alice"
            value={userId} onChange={e => setUserId(e.target.value)}
            autoFocus
          />
        </div>

        <div className="login-field">
          <label>Password</label>
          <input
            type="password" placeholder={mode === 'signin' ? 'Your password' : 'Min 8 characters'}
            value={password} onChange={e => setPassword(e.target.value)}
          />
        </div>

        {mode === 'signup' && (
          <div className="login-field">
            <label>Confirm password</label>
            <input
              type="password" placeholder="Repeat your password"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
        )}

        {error && <div className="login-error">{error}</div>}

        <button className="login-btn" type="submit" disabled={loading}>
          {loading ? 'Please wait…' : (mode === 'signin' ? 'Sign in' : 'Create account')}
        </button>

        <div className="login-toggle">
          {mode === 'signin' ? (
            <>
              No account? <button type="button" onClick={toggleMode}>Create one →</button>
            </>
          ) : (
            <>
              Already have one? <button type="button" onClick={toggleMode}>Sign in →</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

// ─── Onboarding popup ─────────────────────────────────────────────────────────
const STEP_ICONS = {
  queue:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>,
  bell:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  chart:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 5-7"/></svg>,
  sliders: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
};

const STEPS = [
  { icon: 'queue',   cls: 'accent',  label: 'Send a notification',   desc: 'Hit the Queue tab and use the form to fire a test notification to any user ID.' },
  { icon: 'bell',    cls: 'green',   label: 'Watch it arrive live',   desc: 'Switch to Notifications — new items appear in real-time via Socket.io without a page refresh.' },
  { icon: 'chart',   cls: 'violet',  label: 'Track delivery metrics', desc: 'The Metrics tab shows success/failure counts and queue depth updated every 10 s.' },
  { icon: 'sliders', cls: 'amber',   label: 'Adjust preferences',     desc: 'Settings lets each user toggle channels, enable quiet hours, and mute specific types.' },
];

const OnboardingModal = ({ onDone }) => (
  <div className="onboard-backdrop" onClick={e => e.target === e.currentTarget && onDone()}>
    <div className="onboard-card">
      <div className="onboard-header">
        <div className="onboard-brand">
          <div className="onboard-brand-mark">N</div>
          <div className="onboard-brand-name">NotifyX</div>
        </div>
        <button type="button" className="onboard-close" onClick={onDone} title="Close">×</button>
      </div>

      <div className="onboard-body">
        <h2 className="onboard-title">Welcome aboard 👋</h2>
        <p className="onboard-sub">Here's how to get the most out of your dashboard in 60 seconds.</p>

        <div className="onboard-steps">
          {STEPS.map((s, i) => (
            <div className="onboard-step" key={i}>
              <div className={`onboard-step-icon onboard-step-icon--${s.cls}`}>{STEP_ICONS[s.icon]}</div>
              <div className="onboard-step-text">
                <h4>{s.label}</h4>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="onboard-footer">
        <button type="button" className="onboard-skip" onClick={onDone}>Skip tour</button>
        <button type="button" className="onboard-cta" onClick={onDone}>Get started →</button>
      </div>
    </div>
  </div>
);

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV = [
  { k:'dashboard',     label:'Dashboard',     icon:'home',     screen:'Overview' },
  { k:'queue',         label:'Queue',         icon:'queue',    screen:'Queue',   badge:'47', badgeKind:'err' },
  { k:'notifications', label:'Notifications', icon:'bell',     screen:'Inbox',   badge:'3',  badgeKind:'' },
  { k:'metrics',       label:'Metrics',       icon:'metrics',  screen:'Metrics' },
  { k:'apikeys',       label:'API Keys',      icon:'key',      screen:'API Keys' },
  { k:'settings',      label:'Settings',      icon:'settings', screen:'Settings' },
];

// ─── Main app ─────────────────────────────────────────────────────────────────
const App = () => {
  const [authed,    setAuthed]    = React.useState(Boolean(getToken()));
  const [route,     setRoute]     = React.useState('dashboard');
  const [socket,    setSocket]    = React.useState(null);
  const [unread,    setUnread]    = React.useState(0);
  const [onboarding, setOnboarding] = React.useState(false);

  // Hash-based routing so refreshing keeps the view
  React.useEffect(() => {
    const apply = () => {
      const h = (location.hash || '').replace('#', '') || 'dashboard';
      if (NAV.find(n => n.k === h)) setRoute(h);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const go = (k) => { location.hash = k; setRoute(k); };

  // Initialise Socket.io after login
  React.useEffect(() => {
    if (!authed) return;
    const token = getToken();
    const s = io(API_BASE, { auth: { token } });
    s.on('connect', () => console.log('[Socket] Connected'));
    s.on('connect_error', (err) => console.warn('[Socket] Connect error:', err.message));
    s.on('notification', () => setUnread(c => c + 1));
    setSocket(s);
    return () => s.disconnect();
  }, [authed]);

  const handleLogin = () => {
    setAuthed(true);
    if (!localStorage.getItem('ntfx_onboarded')) setOnboarding(true);
  };

  const dismissOnboarding = () => {
    localStorage.setItem('ntfx_onboarded', '1');
    setOnboarding(false);
  };

  const handleLogout = () => {
    clearAuth();
    socket?.disconnect();
    setSocket(null);
    setAuthed(false);
    setUnread(0);
  };

  if (!authed) return <LoginScreen onLogin={handleLogin}/>;

  const current = NAV.find(n => n.k === route) || NAV[0];
  const userId  = getUserId() || 'user';

  let Screen;
  switch (route) {
    case 'queue':         Screen = () => <Queue/>; break;
    case 'notifications': Screen = () => <Notifications socket={socket} onUnreadChange={setUnread}/>; break;
    case 'settings':      Screen = () => <Settings/>; break;
    case 'metrics':       Screen = () => <Metrics/>; break;
    case 'apikeys':       Screen = () => <ApiKeys/>; break;
    default:              Screen = () => <Dashboard onNavigate={go}/>;
  }

  return (
    <div className="app">
      {onboarding && <OnboardingModal onDone={dismissOnboarding}/>}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div className="brand-name">NotifyX</div>
          <div className="brand-env">prod</div>
        </div>

        <div className="nav-section-label">Workspace</div>
        {NAV.map(n => {
          const badge = n.k === 'notifications' ? (unread > 0 ? String(unread) : null) : n.badge;
          return (
            <button
              key={n.k}
              className={`nav-item ${route===n.k?'active':''}`}
              onClick={() => go(n.k)}
            >
              <Icon name={n.icon} size={16} className="nav-icon"/>
              <span>{n.label}</span>
              {badge && <span className={`nav-badge ${n.badgeKind||''}`}>{badge}</span>}
            </button>
          );
        })}

        <div className="nav-section-label">Resources</div>
        <a className="nav-item" href={`${API_BASE}/admin/queues`} target="_blank" rel="noopener">
          <Icon name="cube" size={16} className="nav-icon"/>
          <span>Bull Board</span>
          <Icon name="arrow-up" size={11} className="fg-faint" style={{marginLeft:'auto',transform:'rotate(45deg)'}}/>
        </a>
        <a className="nav-item" href="index.html">
          <Icon name="help" size={16} className="nav-icon"/>
          <span>Docs &amp; Demo</span>
          <Icon name="arrow-up" size={11} className="fg-faint" style={{marginLeft:'auto',transform:'rotate(45deg)'}}/>
        </a>

        <div className="sidebar-footer">
          <div className="avatar">{userId.slice(0,2).toUpperCase()}</div>
          <div className="who">
            <span>{userId}</span>
            <span>@{userId}</span>
          </div>
          <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--fg-faint)',padding:0}} onClick={handleLogout} title="Sign out">
            <Icon name="x" size={14}/>
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            <span>NotifyX</span>
            <span className="sep">/</span>
            <span className="current">{current.screen}</span>
          </div>
          <div className="search">
            <Icon name="search" size={13}/>
            <input placeholder="Search jobs, templates, recipients…"/>
            <span className="kbd">⌘K</span>
          </div>
          <div className="topbar-right">
            <button className="icon-btn" title="Help"><Icon name="help" size={14}/></button>
            <button className="icon-btn" title="Notifications" style={{position:'relative'}} onClick={() => go('notifications')}>
              <Icon name="bell" size={14}/>
              {unread > 0 && <span className="bell-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
            <div className="row" style={{gap:8,marginLeft:6,paddingLeft:10,borderLeft:'1px solid var(--border)'}}>
              <div style={{width:26,height:26,borderRadius:'50%',background:'oklch(0.55 0.10 30)',color:'white',display:'grid',placeItems:'center',fontSize:11,fontWeight:600}}>
                {userId.slice(0,2).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div key={route} style={{animation:'fade 180ms ease-out'}}>
          <Screen/>
        </div>
      </main>

      <style>{`@keyframes fade { from { opacity:0; transform:translateY(2px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
