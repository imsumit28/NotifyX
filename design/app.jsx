// App shell — sidebar + topbar + screen router

const { Icon } = window;
const { Dashboard, Queue, Notifications, Settings, Metrics } = window.Screens;

const NAV = [
  { k:'dashboard',     label:'Dashboard',     icon:'home',      screen: 'Overview' },
  { k:'queue',         label:'Queue',         icon:'queue',     screen: 'Queue', badge:'47', badgeKind:'err' },
  { k:'notifications', label:'Notifications', icon:'bell',      screen: 'Inbox', badge:'3', badgeKind:'' },
  { k:'metrics',       label:'Metrics',       icon:'metrics',   screen: 'Metrics' },
  { k:'settings',      label:'Settings',      icon:'settings',  screen: 'Settings' },
];

const App = () => {
  const [route, setRoute] = React.useState('dashboard');

  // hash routing for refresh persistence
  React.useEffect(() => {
    const apply = () => {
      const h = (location.hash || '').replace('#','') || 'dashboard';
      if (NAV.find(n => n.k===h)) setRoute(h);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
  const go = (k) => { location.hash = k; setRoute(k); };

  const current = NAV.find(n => n.k===route) || NAV[0];

  let Screen;
  switch (route) {
    case 'queue': Screen = Queue; break;
    case 'notifications': Screen = Notifications; break;
    case 'settings': Screen = Settings; break;
    case 'metrics': Screen = Metrics; break;
    default: Screen = Dashboard;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div className="brand-name">NotifyX</div>
          <div className="brand-env">prod</div>
        </div>

        <div className="nav-section-label">Workspace</div>
        {NAV.map(n => (
          <button
            key={n.k}
            data-screen-label={`${String(NAV.findIndex(x=>x.k===n.k)+1).padStart(2,'0')} ${n.label}`}
            className={`nav-item ${route===n.k?'active':''}`}
            onClick={()=>go(n.k)}
          >
            <Icon name={n.icon} size={16} className="nav-icon"/>
            <span>{n.label}</span>
            {n.badge && <span className={`nav-badge ${n.badgeKind||''}`}>{n.badge}</span>}
          </button>
        ))}

        <div className="nav-section-label">Resources</div>
        <button className="nav-item">
          <Icon name="cube" size={16} className="nav-icon"/>
          <span>Templates</span>
        </button>
        <button className="nav-item">
          <Icon name="help" size={16} className="nav-icon"/>
          <span>Docs</span>
        </button>

        <div className="sidebar-footer">
          <div className="avatar">EP</div>
          <div className="who">
            <span>Elena Park</span>
            <span>@elena.p</span>
          </div>
          <Icon name="chevron-down" size={14} className="fg-faint"/>
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
            <button className="icon-btn" title="Notifications" onClick={()=>go('notifications')}>
              <Icon name="bell" size={14}/>
              <span className="dot"/>
            </button>
            <div className="row" style={{gap:8, marginLeft:6, paddingLeft:10, borderLeft:'1px solid var(--border)'}}>
              <div style={{
                width:26, height:26, borderRadius:'50%',
                background:'oklch(0.55 0.10 30)',
                color:'white', display:'grid', placeItems:'center',
                fontSize:11, fontWeight:600,
              }}>EP</div>
            </div>
          </div>
        </div>

        <div data-screen-label={`${String(NAV.findIndex(x=>x.k===route)+1).padStart(2,'0')} ${current.label}`} key={route} style={{animation:'fade 180ms ease-out'}}>
          <Screen/>
        </div>
      </main>

      <style>{`@keyframes fade { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
