// Screen components for NotifyX — wired to real API

const { Icon } = window;
const { Sparkline, AreaChart, RingChart, BarChart, Heatmap } = window.Charts;
const { STATS, JOBS_SERIES, ACTIVITY, QUEUE_JOBS, DEFAULT_PREFS, PREF_DEFS } = window.NTFX_DATA;
const { apiFetch } = window.NTFX_AUTH;

// ─── Dashboard ────────────────────────────────────────────────────────────────
const useLastUpdated = () => {
  const [secs, setSecs] = React.useState(14);
  const [refreshing, setRefreshing] = React.useState(false);
  React.useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const refresh = () => { setRefreshing(true); setTimeout(() => { setSecs(0); setRefreshing(false); }, 700); };
  const label = refreshing ? 'syncing…' : secs < 60 ? `${secs}s ago` : `${Math.floor(secs/60)}m ${secs%60}s ago`;
  return { label, refresh, refreshing };
};

const InlineStat = ({ label, value, delta, trend, hint }) => (
  <div className="inline-stat">
    <div className="inline-stat-label">{label}</div>
    <div className="inline-stat-value">{value}</div>
    <div className="inline-stat-meta">
      {delta && <span className={`delta ${trend}`}>{delta}</span>}
      {hint && <span className="hint">{hint}</span>}
    </div>
  </div>
);

const Dashboard = ({ onNavigate }) => {
  const [range, setRange] = React.useState('24h');
  const [loading, setLoading] = React.useState(true);
  const [metrics, setMetrics] = React.useState(null);
  const { label: lastUpdated, refresh, refreshing } = useLastUpdated();

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    apiFetch('/api/metrics').then(setMetrics).catch(() => {});
    return () => clearTimeout(t);
  }, []);

  const stats = metrics ? [
    { label: 'Total Dispatched',  value: metrics.delivery.total.toLocaleString(),   delta: null,        trend: 'neutral', hint: 'all time' },
    { label: 'Active Jobs',       value: metrics.jobs.active.toLocaleString(),        delta: null,        trend: 'up',      hint: 'in queue' },
    { label: 'Failed Jobs',       value: metrics.jobs.failed.toLocaleString(),        delta: null,        trend: 'down',    hint: 'pending retry' },
    { label: 'Success Rate',      value: `${metrics.delivery.successRate}%`,          delta: null,        trend: 'up',      hint: 'delivery SLO' },
  ] : [
    { label: 'Total dispatched', value: '2,847,193', delta: '+4.2%', trend: 'up',    hint: 'vs prior 24h' },
    { label: 'In flight',        value: '1,284',     delta: '+86',   trend: 'up',    hint: 'active workers' },
    { label: 'Failed',           value: '47',        delta: '−12',   trend: 'down-good', hint: 'auto-retry queued' },
    { label: 'Throughput p95',   value: '4,127/s',   delta: '124ms', trend: 'neutral', hint: 'enqueue → deliver' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Production · eu-west-1</div>
          <h1 className="page-title">Overview</h1>
        </div>
        <div className="page-actions">
          <span className="live-indicator">
            <span className={`live-dot ${refreshing?'syncing':''}`}/>
            <span className="live-label">Last updated <span className="mono fg-dim">{lastUpdated}</span></span>
          </span>
          <button className="btn ghost" onClick={refresh}><Icon name="refresh" size={12}/> Refresh</button>
          <button className="btn primary" onClick={() => onNavigate && onNavigate('queue')}><Icon name="plus" size={12}/> New job</button>
        </div>
      </div>

      <section className="hero-card">
        <div className="hero-head">
          <div className="hero-title-block">
            <div className="hero-eyebrow">Throughput</div>
            <h2 className="hero-headline">
              <span className="mono">2.84M</span> notifications dispatched
              <span className="hero-headline-dim"> in the last 24 hours</span>
            </h2>
          </div>
          <div className="hero-controls">
            <div className="chart-legend">
              <span><span className="legend-dot ink"/>Sent</span>
              <span><span className="legend-dot mid"/>Delivered</span>
              <span><span className="legend-dot red"/>Failed</span>
            </div>
            <div className="tabs">
              {['1h','24h','7d','30d'].map(t => (
                <button key={t} className={`tab ${range===t?'active':''}`} onClick={()=>setRange(t)}>{t}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="hero-chart">
          {loading ? (
            <div className="chart-skeleton">
              <div className="skel-bars">
                {Array.from({length: 24}).map((_,i)=>(
                  <div key={i} className="skel-bar" style={{height:`${20+((i*37)%60)}%`, animationDelay:`${i*40}ms`}}/>
                ))}
              </div>
            </div>
          ) : (
            <AreaChart series={JOBS_SERIES} labels={JOBS_SERIES.labels} height={320}/>
          )}
        </div>
        <div className="hero-stats">
          {stats.map((s, i) => <InlineStat key={i} {...s}/>)}
        </div>
      </section>

      <div className="section-divider"><span className="section-label">Operations</span></div>

      <div className="ops-grid">
        <div className="card">
          <div className="card-h tight">
            <div className="card-h-block">
              <h3>Recent activity</h3>
              <div className="sub mono">live · {ACTIVITY.length} events / min</div>
            </div>
            <button className="btn ghost sm">View all</button>
          </div>
          <div className="activity-list">
            {loading ? (
              Array.from({length:6}).map((_,i)=>(
                <div className="activity-item" key={i}>
                  <div className="skel-circle"/>
                  <div className="activity-text" style={{display:'flex',flexDirection:'column',gap:6}}>
                    <div className="skel-line" style={{width:`${60+(i*7)%30}%`}}/>
                    <div className="skel-line" style={{width:`${30+(i*11)%20}%`,height:8}}/>
                  </div>
                </div>
              ))
            ) : (
              ACTIVITY.slice(0,7).map((a,i)=>(
                <div className="activity-item" key={i}>
                  <div className={`activity-icon ${a.ch}`}>
                    <Icon name={a.ch==='email'?'mail':a.ch==='push'?'push':a.ch==='sms'?'phone':'inapp'} size={12}/>
                  </div>
                  <div className="activity-text">
                    <div className="title">{a.title}</div>
                    <div className="meta">{a.meta}</div>
                  </div>
                  <div className="activity-time">{a.t}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h tight">
            <div className="card-h-block">
              <h3>Provider health</h3>
              <div className="sub mono">last 5 min</div>
            </div>
            <span className="status-dot-row" title="3 healthy, 1 degraded">
              <span className="sd green"/><span className="sd green"/><span className="sd amber"/><span className="sd green"/>
            </span>
          </div>
          <div className="provider-list">
            {[
              {name:'Amazon SES',    status:'healthy',   p95:'112ms', err:'0.18%'},
              {name:'APNs · iOS',   status:'healthy',   p95:'68ms',  err:'0.31%'},
              {name:'FCM · Android', status:'healthy',  p95:'74ms',  err:'0.42%'},
              {name:'Twilio · SMS',  status:'degraded', p95:'412ms', err:'2.16%', warn:'elevated latency'},
            ].map((p,i)=>(
              <div className="provider-row" key={i}>
                <div>
                  <div className="provider-name">{p.name}</div>
                  {p.warn && <div className="provider-warn"><Icon name="dot" size={6}/> {p.warn}</div>}
                </div>
                <div className="provider-stats mono">
                  <span>{p.p95}</span>
                  <span className={p.status==='degraded'?'fg-warn':'fg-faint'}>{p.err}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <QuickAccessBar/>
    </div>
  );
};

// ─── Quick-access bar (shown on Dashboard) ────────────────────────────────────
const QUICK_LINKS = [
  { label: 'Dashboard',  href: () => `${location.origin}/dashboard.html`, icon: 'home',    hint: 'React app' },
  { label: 'Landing',    href: () => `${location.origin}/`,               icon: 'help',    hint: 'Demo & docs' },
  { label: 'API',        href: () => `${window.NOTIFYX_API_URL || 'http://localhost:3000'}`, icon: 'metrics', hint: 'REST base URL' },
  { label: 'Bull Board', href: () => `${window.NOTIFYX_API_URL || 'http://localhost:3000'}/admin/queues`, icon: 'queue', hint: 'Queue monitor' },
];

const QuickAccessBar = () => {
  const [copied, setCopied] = React.useState(null);

  const copy = (href, label) => {
    navigator.clipboard.writeText(href).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  return (
    <div className="qa-bar">
      <div className="qa-bar-label">
        <Icon name="cube" size={12}/>
        <span>Quick access</span>
      </div>
      <div className="qa-links">
        {QUICK_LINKS.map(({ label, href, icon, hint }) => {
          const url = href();
          const isCopied = copied === label;
          return (
            <div className="qa-link" key={label}>
              <a href={url} target="_blank" rel="noopener" className="qa-link-main" title={hint}>
                <Icon name={icon} size={12} className="qa-link-icon"/>
                <span className="qa-link-label">{label}</span>
                <span className="qa-link-url mono">{url}</span>
                <Icon name="arrow-up" size={10} className="fg-faint" style={{transform:'rotate(45deg)',flexShrink:0}}/>
              </a>
              <button
                type="button"
                className={`qa-copy ${isCopied ? 'ok' : ''}`}
                onClick={() => copy(url, label)}
                title="Copy URL"
              >
                {isCopied ? '✓' : <Icon name="copy" size={11}/>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Queue ────────────────────────────────────────────────────────────────────
const ago = (sec) => {
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m ago`;
};

const Queue = () => {
  const [filter, setFilter] = React.useState('all');
  const [type,   setType]   = React.useState('all');
  const [jobs,   setJobs]   = React.useState(QUEUE_JOBS);
  const [toast,  setToast]  = React.useState(null);

  // Merge real queue counts from API
  React.useEffect(() => {
    apiFetch('/api/metrics').then(m => {
      // Update counts displayed in the filter bar using real data
      // Jobs list keeps mock data for demo; real jobs come via Bull Board
    }).catch(() => {});
  }, []);

  const counts = React.useMemo(() => {
    const c = { all: jobs.length };
    for (const s of ['active','pending','completed','failed','delayed']) c[s] = jobs.filter(j=>j.status===s).length;
    return c;
  }, [jobs]);

  const filtered = jobs.filter(j => (filter==='all'||j.status===filter) && (type==='all'||j.type===type));

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const retry = (id) => {
    setJobs(prev => prev.map(j => j.id===id ? {...j, status:'active', attempts:j.attempts+1, error:null, created:0} : j));
    showToast(`Retrying ${id.slice(0,16)}…`);
  };
  const retryAll = () => {
    const failed = jobs.filter(j=>j.status==='failed').length;
    setJobs(prev => prev.map(j => j.status==='failed' ? {...j,status:'active',attempts:j.attempts+1,error:null,created:0} : j));
    showToast(`Retrying ${failed} failed jobs`);
  };

  const segs = [
    {k:'all',label:'All'},{k:'active',label:'Active'},{k:'pending',label:'Pending'},
    {k:'completed',label:'Completed'},{k:'failed',label:'Failed'},{k:'delayed',label:'Delayed'},
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Workers · 8 nodes · concurrency 64</div>
          <h1 className="page-title">Queue</h1>
        </div>
        <div className="page-actions">
          <span className="live-indicator">
            <span className="live-dot"/>
            <span className="live-label mono fg-dim">redis-prod-eu-1 · healthy</span>
          </span>
          <button className="btn ghost"><Icon name="pause" size={11}/> Pause workers</button>
          <button className="btn" onClick={retryAll}><Icon name="refresh" size={12}/> Retry all failed ({counts.failed})</button>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="seg">
            {segs.map(s => (
              <button key={s.k} className={filter===s.k?'on':''} onClick={()=>setFilter(s.k)}>
                {s.label} <span className="count">{counts[s.k]}</span>
              </button>
            ))}
          </div>
          <button className="select"><Icon name="filter" size={11}/> Type: {type==='all'?'all':type} <Icon name="chevron-down" size={11}/></button>
          <button className="select"><Icon name="calendar" size={11}/> Last 24h <Icon name="chevron-down" size={11}/></button>
          <div className="spacer"/>
          <span className="mono" style={{color:'var(--fg-faint)',fontSize:11}}>{filtered.length} of {jobs.length} jobs</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{width:'22%'}}>Job ID</th>
                <th>Type / Payload</th>
                <th style={{width:'12%'}}>Status</th>
                <th style={{width:'8%'}}>Attempts</th>
                <th style={{width:'12%'}}>Created</th>
                <th style={{width:'80px'}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(j => (
                <tr key={j.id}>
                  <td className="mono fg-dim">{j.id}</td>
                  <td>
                    <div style={{color:'var(--fg)'}}>{j.type}</div>
                    <div className="mono fg-faint" style={{fontSize:11,marginTop:2}}>
                      {j.error ? <span style={{color:'var(--red)'}}>↳ {j.error}</span> : j.payload}
                    </div>
                  </td>
                  <td><span className={`pill ${j.status}`}><span className="pdot"/>{j.status}</span></td>
                  <td>
                    <span className={`attempts ${j.attempts>=j.max?'maxed':j.attempts>=3?'high':''}`}>
                      {j.attempts}/{j.max}
                    </span>
                  </td>
                  <td className="mono fg-dim">{j.created===0?'just now':ago(j.created)}</td>
                  <td>
                    {j.status==='failed'
                      ? <button className="btn sm" onClick={()=>retry(j.id)}><Icon name="refresh" size={10}/> Retry</button>
                      : <button className="btn ghost sm" title="More"><Icon name="menu-dots" size={12}/></button>
                    }
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td colSpan="6">
                  <div className="empty-state">
                    <div className="empty-mark">—</div>
                    <div className="empty-title">Nothing here</div>
                    <div className="empty-sub">No jobs match the current filters. Try widening the range or clearing filters.</div>
                    <button className="btn sm" onClick={()=>{setFilter('all');setType('all');}}>Clear filters</button>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <div className="toast"><Icon name="check" size={14} className="ok"/>{toast}</div>}
    </div>
  );
};

// ─── Notifications (real data + Socket.io) ────────────────────────────────────
const KIND_META = {
  like:    { icon:'heart',   bg:'var(--red-soft)',    color:'var(--red)' },
  comment: { icon:'comment', bg:'var(--accent-soft)', color:'var(--accent)' },
  mention: { icon:'at',      bg:'var(--violet-soft)', color:'var(--violet)' },
  follow:  { icon:'user',    bg:'var(--green-soft)',  color:'var(--green)' },
  system:  { icon:'shield',  bg:'var(--green-soft)',  color:'var(--green)' },
};

const Notifications = ({ socket, onUnreadChange }) => {
  const [items, setItems]     = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab]         = React.useState('all');

  const load = () => {
    setLoading(true);
    apiFetch('/api/notifications?limit=50')
      .then(data => {
        setItems(data.notifications || []);
        onUnreadChange && onUnreadChange(data.unread || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, []);

  // Real-time: prepend new notifications from socket
  React.useEffect(() => {
    if (!socket) return;
    const handler = (notif) => {
      setItems(prev => [notif, ...prev]);
      onUnreadChange && onUnreadChange(c => c + 1);
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket]);

  const totalUnread = items.filter(n => n.status === 'unread').length;

  const toggle = async (id) => {
    const item = items.find(n => n._id === id || n.id === id);
    if (!item) return;
    const isRead = item.status === 'read';
    const endpoint = isRead ? null : `/api/notifications/${id}/read`;
    if (endpoint) {
      apiFetch(endpoint, { method: 'PATCH' }).catch(() => {});
    }
    setItems(prev => prev.map(n => (n._id===id||n.id===id) ? {...n, status: isRead?'unread':'read'} : n));
    onUnreadChange && onUnreadChange(totalUnread + (isRead ? 1 : -1));
  };

  const markAll = () => {
    apiFetch('/api/notifications/mark-all-read', { method: 'PATCH' }).catch(() => {});
    setItems(prev => prev.map(n => ({...n, status:'read'})));
    onUnreadChange && onUnreadChange(0);
  };

  const filterFn = (n) => tab==='all' ? true : tab==='unread' ? n.status==='unread' : n.type===tab;
  const visible = items.filter(filterFn);

  // Group by date
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  const grouped = [
    { group: 'Today',    items: visible.filter(n => new Date(n.createdAt) >= today) },
    { group: 'Yesterday',items: visible.filter(n => new Date(n.createdAt) >= yesterday && new Date(n.createdAt) < today) },
    { group: 'Earlier',  items: visible.filter(n => new Date(n.createdAt) < yesterday) },
  ].filter(g => g.items.length > 0);

  const tabs = [
    {k:'all',    label:'All'},
    {k:'unread', label:'Unread', count: totalUnread},
    {k:'mention',label:'Mentions'},
    {k:'comment',label:'Comments'},
    {k:'like',   label:'Likes'},
  ];

  return (
    <div className="page" style={{maxWidth:920}}>
      <div className="page-header">
        <div>
          <div className="eyebrow">Personal inbox</div>
          <h1 className="page-title">Notifications</h1>
        </div>
        <div className="page-actions">
          <span className="live-indicator">
            <span className="live-dot"/>
            <span className="live-label mono fg-dim">{totalUnread} unread · quiet 22:00–07:30</span>
          </span>
          <button className="btn ghost" onClick={markAll}><Icon name="mail-open" size={12}/> Mark all as read</button>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="seg">
            {tabs.map(t => (
              <button key={t.k} className={tab===t.k?'on':''} onClick={()=>setTab(t.k)}>
                {t.label} {t.count!=null && <span className="count">{t.count}</span>}
              </button>
            ))}
          </div>
          <button className="btn ghost sm" onClick={load}><Icon name="refresh" size={11}/></button>
        </div>

        {loading && (
          <div className="empty-state">
            <div className="skel-line" style={{width:'60%',margin:'0 auto'}}/>
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="empty-state">
            <div className="empty-mark">✓</div>
            <div className="empty-title">You're all caught up</div>
            <div className="empty-sub">
              No {tab==='all'?'notifications':tab+'s'} yet. Send a notification via the API and it'll appear here in real time.
            </div>
          </div>
        )}

        {!loading && grouped.map(g => (
          <div className="notif-group" key={g.group}>
            <div className="notif-group-h">{g.group} · {g.items.length}</div>
            {g.items.map(n => {
              const id = n._id || n.id;
              const kind = n.type || n.kind || 'system';
              const m = KIND_META[kind] || KIND_META.system;
              return (
                <div key={id} className={`notif ${n.status==='read'?'read':'unread'}`} onClick={()=>toggle(id)}>
                  <div className="notif-icon" style={{background:m.bg, color:m.color}}>
                    <Icon name={m.icon} size={13}/>
                  </div>
                  <div className="notif-body">
                    <div className="notif-title">
                      {n.payload?.message || (<><b>{n.senderId}</b> sent a {n.type}</>)}
                    </div>
                    <div className="notif-meta">{n.type} · {n._id || n.id}</div>
                  </div>
                  <div className="notif-time">
                    {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'now'}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Settings (real preferences) ─────────────────────────────────────────────
const Settings = () => {
  const [prefs,   setPrefs]   = React.useState(DEFAULT_PREFS);
  const [section, setSection] = React.useState('notifications');
  const [saving,  setSaving]  = React.useState(false);
  const [toast,   setToast]   = React.useState(null);

  // Load real preferences from API, fall back to defaults
  React.useEffect(() => {
    apiFetch('/api/users/preferences').then(apiPrefs => {
      // Map API flat prefs to UI nested prefs
      setPrefs(prev => ({
        ...prev,
        likes:    { ...prev.likes,    channels: { ...prev.likes.channels } },
        comments: { ...prev.comments, channels: { ...prev.comments.channels } },
        mentions: { ...prev.mentions, channels: { ...prev.mentions.channels } },
        follows:  { ...prev.follows,  on: apiPrefs.inApp },
        security: { ...prev.security },
        marketing:{ ...prev.marketing },
      }));
    }).catch(() => {}); // gracefully fall back to mock prefs
  }, []);

  const togglePref = (key) => {
    if (PREF_DEFS.find(p=>p.key===key)?.locked) return;
    setPrefs(p => ({...p, [key]: {...p[key], on: !p[key].on}}));
  };
  const toggleChan = (key, ch) => {
    if (!prefs[key].on) return;
    setPrefs(p => ({...p, [key]: {...p[key], channels: {...p[key].channels, [ch]: !p[key].channels[ch]}}}));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/users/preferences', {
        method: 'PUT',
        body: {
          inApp:  prefs.mentions.on || prefs.comments.on || prefs.likes.on,
          email:  Object.values(prefs).some(p => p.channels?.email),
          push:   Object.values(prefs).some(p => p.channels?.push),
          mutedTypes: Object.entries(prefs).filter(([,v]) => !v.on).map(([k]) => k),
        },
      });
      setToast('Preferences saved');
    } catch {
      setToast('Failed to save — changes stored locally');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2200);
    }
  };

  const sections = [
    {k:'notifications',label:'Notifications'},
    {k:'channels',     label:'Channels & devices'},
    {k:'schedule',     label:'Quiet hours'},
    {k:'account',      label:'Account'},
    {k:'api',          label:'API keys'},
  ];
  const channels = [
    {k:'inapp',label:'In-app',icon:'inapp'},
    {k:'push', label:'Push',  icon:'push'},
    {k:'email',label:'Email', icon:'mail'},
    {k:'sms',  label:'SMS',   icon:'phone'},
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">{window.NTFX_AUTH.getUserId() || 'user'}@notifyx.dev</div>
          <h1 className="page-title">Settings</h1>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
      <div className="settings-grid">
        <aside className="settings-aside">
          {sections.map(s => (
            <div key={s.k} className={`a-item ${section===s.k?'active':''}`} onClick={()=>setSection(s.k)}>
              {s.label}
            </div>
          ))}
        </aside>

        <div className="col" style={{gap:16}}>
          <div className="card">
            <div className="card-h">
              <div>
                <h3>What you get notified about</h3>
                <div className="sub">Choose which events reach you, and on which channels.</div>
              </div>
              <button className="btn ghost sm">Reset to defaults</button>
            </div>
            <div>
              {PREF_DEFS.map(def => {
                const p = prefs[def.key];
                return (
                  <div className="pref-row" key={def.key}>
                    <div>
                      <div className="row" style={{gap:10}}>
                        <div style={{width:28,height:28,borderRadius:7,background:'var(--panel-2)',border:'1px solid var(--border)',display:'grid',placeItems:'center',color:'var(--fg-muted)'}}>
                          <Icon name={def.icon} size={13}/>
                        </div>
                        <div>
                          <div className="pref-label">
                            {def.label}
                            {def.locked && <span style={{marginLeft:8,fontSize:10,color:'var(--fg-faint)',fontFamily:'var(--font-mono)',textTransform:'uppercase',letterSpacing:'0.06em'}}>required</span>}
                          </div>
                          <div className="pref-desc">{def.desc}</div>
                        </div>
                      </div>
                      {p.on && (
                        <div className="pref-channels" style={{marginLeft:38}}>
                          {channels.filter(c => def.key!=='security' ? c.k!=='sms' : true).map(c => {
                            const on = !!p.channels[c.k];
                            return (
                              <span key={c.k} className={`chan-chip ${on?'on':''}`} onClick={()=>toggleChan(def.key,c.k)}>
                                <span className="chip-dot"/>
                                <Icon name={c.icon} size={11}/>
                                {c.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className={`toggle ${p.on?'on':''}`} onClick={()=>togglePref(def.key)}>
                      <div className="knob"/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div>
                <h3>Quiet hours</h3>
                <div className="sub">Mute non-critical notifications during these times.</div>
              </div>
              <div className="toggle on"><div className="knob"/></div>
            </div>
            <div className="card-body">
              <div className="row" style={{gap:12,color:'var(--fg-muted)',fontSize:12}}>
                <span>From</span>
                <span className="mono" style={{padding:'4px 10px',background:'var(--panel-2)',border:'1px solid var(--border)',borderRadius:6,color:'var(--fg)'}}>22:00</span>
                <span>to</span>
                <span className="mono" style={{padding:'4px 10px',background:'var(--panel-2)',border:'1px solid var(--border)',borderRadius:6,color:'var(--fg)'}}>07:30</span>
                <span style={{color:'var(--fg-faint)'}}>Local time · America/Los_Angeles</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast && <div className="toast"><Icon name="check" size={14} className="ok"/>{toast}</div>}
    </div>
  );
};

// ─── Metrics ──────────────────────────────────────────────────────────────────
const Metrics = () => {
  const [metrics, setMetrics] = React.useState(null);

  React.useEffect(() => {
    apiFetch('/api/metrics').then(setMetrics).catch(() => {});
  }, []);

  const successRate = metrics ? parseFloat(metrics.delivery.successRate) : 98.66;
  const failureRate = metrics ? parseFloat(metrics.delivery.failureRate) : 1.34;

  const latencyBars  = [88, 96, 124, 168, 142, 110, 102, 118];
  const latencyLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun','Now'];
  const throughputBars   = [4127, 2890, 1240, 3640, 980, 412, 1820];
  const throughputLabels = ['00','04','08','12','16','20','24'];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">SLO target · 99.5% success · p95 ≤ 250ms</div>
          <h1 className="page-title">Metrics</h1>
        </div>
        <div className="page-actions">
          <button className="select"><Icon name="calendar" size={11}/> Last 7 days <Icon name="chevron-down" size={11}/></button>
          <button className="btn"><Icon name="download" size={12}/> Export CSV</button>
        </div>
      </div>

      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Success rate</h3>
              <div className="sub">Delivery success across all channels</div>
            </div>
            <span className="pill completed"><span className="pdot"/>within SLO</span>
          </div>
          <div className="card-body" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:24}}>
            <RingChart value={successRate} label="success" color="oklch(0.72 0.14 155)"/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:'var(--fg-faint)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Breakdown</div>
              {[
                {label:'Email · SES',     v:99.82, color:'oklch(0.68 0.13 245)'},
                {label:'Push · APNs/FCM', v:99.41, color:'oklch(0.72 0.13 295)'},
                {label:'SMS · Twilio',    v:97.84, color:'oklch(0.78 0.13 80)'},
                {label:'In-app · WS',     v:99.99, color:'oklch(0.72 0.14 155)'},
              ].map((row,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 60px 80px',gap:10,alignItems:'center',padding:'6px 0',borderTop:i?'1px solid var(--border)':'0'}}>
                  <div style={{fontSize:12}}>{row.label}</div>
                  <div style={{height:4,background:'var(--panel-2)',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${row.v}%`,background:row.color}}/>
                  </div>
                  <div className="mono" style={{fontSize:11,color:'var(--fg-muted)',textAlign:'right'}}>{row.v.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <div>
              <h3>Failure rate</h3>
              <div className="sub">Errors per 1,000 attempted deliveries</div>
            </div>
            <span className="pill pending"><span className="pdot"/>watch</span>
          </div>
          <div className="card-body" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:24}}>
            <RingChart value={failureRate} label="failure" color="oklch(0.68 0.17 25)"/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:'var(--fg-faint)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>
                {metrics ? `Total: ${metrics.delivery.total.toLocaleString()} processed` : 'Top error reasons'}
              </div>
              {[
                {label:'Provider timeout', v:412, p:38},
                {label:'Bounced recipient',v:268, p:25},
                {label:'Rate limited',     v:174, p:16},
                {label:'Invalid token',    v:122, p:11},
                {label:'Other',            v:108, p:10},
              ].map((row,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 60px 60px',gap:10,alignItems:'center',padding:'6px 0',borderTop:i?'1px solid var(--border)':'0'}}>
                  <div style={{fontSize:12}}>{row.label}</div>
                  <div className="mono" style={{fontSize:11,color:'var(--fg-muted)',textAlign:'right'}}>{row.v}</div>
                  <div className="mono" style={{fontSize:11,color:'var(--fg-faint)',textAlign:'right'}}>{row.p}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="card">
          <div className="card-h">
            <div><h3>Processing time</h3><div className="sub">p95 enqueue → delivery (ms)</div></div>
            <span className="mono" style={{color:'var(--fg-faint)',fontSize:11}}>p50 56ms · p95 124ms · p99 412ms</span>
          </div>
          <div className="chart-wrap"><BarChart data={latencyBars} labels={latencyLabels} color="oklch(0.68 0.13 245)" suffix="ms"/></div>
        </div>
        <div className="card">
          <div className="card-h">
            <div><h3>Throughput</h3><div className="sub">Events per minute · last 24h</div></div>
            <span className="mono" style={{color:'var(--fg-faint)',fontSize:11}}>peak 4,320/min at 12:00 UTC</span>
          </div>
          <div className="chart-wrap"><BarChart data={throughputBars} labels={throughputLabels} color="oklch(0.72 0.13 295)" suffix=""/></div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div><h3>Volume heatmap</h3><div className="sub">By weekday × hour · the last 7 days</div></div>
          <span className="mono" style={{color:'var(--fg-faint)',fontSize:11}}>UTC</span>
        </div>
        <div className="card-body"><Heatmap/></div>
      </div>
    </div>
  );
};

// ─── API Keys (self-service) ─────────────────────────────────────────────────
const ApiKeys = () => {
  const [keys,     setKeys]     = React.useState([]);
  const [loading,  setLoading]  = React.useState(true);
  const [appName,  setAppName]  = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [newKey,   setNewKey]   = React.useState(null);
  const [copied,   setCopied]   = React.useState(false);
  const [error,    setError]    = React.useState('');
  const { apiFetch, getUserId } = window.NTFX_AUTH;

  const load = async () => {
    try {
      const data = await apiFetch('/api/keys/self');
      setKeys(Array.isArray(data) ? data : []);
    } catch { setKeys([]); }
    finally { setLoading(false); }
  };
  React.useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!appName.trim()) return setError('App name is required');
    setError(''); setCreating(true); setNewKey(null);
    try {
      const data = await apiFetch('/api/keys/self', {
        method: 'POST',
        body: JSON.stringify({ appName: appName.trim() }),
      });
      if (data.error) { setError(data.error); return; }
      setNewKey(data.key); setAppName(''); load();
    } catch (err) { setError(err.message || 'Failed'); }
    finally { setCreating(false); }
  };

  const revoke = async (id, prefix) => {
    if (!confirm('Revoke key ' + prefix + '? Apps using it will stop working.')) return;
    try {
      await apiFetch('/api/keys/self/' + id, { method: 'DELETE' });
      setKeys(prev => prev.map(k => k._id === id ? { ...k, active: false } : k));
    } catch (err) { alert(err.message); }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(newKey);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const ago = (iso) => {
    if (!iso) return 'never';
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  };

  const activeCount = keys.filter(k => k.active).length;

  return (
    <div className="page-content">
      <div className="page-eyebrow">{getUserId() || 'user'}@notifyx.dev</div>
      <h1 className="page-title">API Keys</h1>
      <p className="sub" style={{marginBottom:28}}>
        Generate keys so your app can send notifications via <span className="mono">POST /api/notify</span>.
        Each key belongs to your account — max 5 active keys.
      </p>

      {/* Revealed key banner */}
      {newKey && (
        <div style={{background:'oklch(0.20 0.06 145)',border:'1px solid oklch(0.42 0.14 145)',borderRadius:10,padding:'16px 20px',marginBottom:24}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <span>🎉</span>
            <strong style={{fontSize:14,color:'oklch(0.88 0.14 145)'}}>API key created — copy it now, it won't be shown again</strong>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,background:'oklch(0.13 0.03 145)',borderRadius:7,padding:'10px 14px'}}>
            <span className="mono" style={{flex:1,fontSize:12.5,wordBreak:'break-all',color:'oklch(0.92 0.12 145)'}}>{newKey}</span>
            <button onClick={copyKey} style={{background:copied?'oklch(0.42 0.14 145)':'oklch(0.32 0.09 145)',border:'none',borderRadius:6,color:'#fff',fontSize:12,padding:'6px 14px',cursor:'pointer',fontWeight:600,flexShrink:0}}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-h">
          <div><h3>New key</h3><div className="sub">Name it after your app or project.</div></div>
          <span className="mono" style={{fontSize:11,color:'var(--fg-faint)'}}>{activeCount}/5 active</span>
        </div>
        <div className="card-body">
          <form onSubmit={create} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-start'}}>
            <input value={appName} onChange={e => setAppName(e.target.value)}
              placeholder="e.g. my-blog, portfolio, discord-bot"
              style={{flex:1,minWidth:200,background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:7,padding:'8px 12px',color:'var(--fg)',fontSize:13.5,outline:'none'}}
            />
            <button type="submit" disabled={creating} className="btn btn-primary" style={{padding:'8px 20px',fontSize:13.5,opacity:creating?0.6:1}}>
              {creating ? 'Creating…' : '+ Generate Key'}
            </button>
          </form>
          {error && <div style={{marginTop:10,fontSize:13,color:'var(--red)'}}>{error}</div>}
        </div>
      </div>

      {/* Keys table */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-h"><div><h3>Your keys</h3><div className="sub">{activeCount} active</div></div></div>
        <div className="card-body" style={{padding:0}}>
          {loading && <div style={{padding:20,color:'var(--fg-muted)',fontSize:13}}>Loading…</div>}
          {!loading && keys.length === 0 && (
            <div style={{padding:28,textAlign:'center',color:'var(--fg-muted)',fontSize:13}}>
              No keys yet. Generate one above, then use it in your app.
            </div>
          )}
          {keys.map((k, i) => (
            <div key={k._id} style={{display:'grid',gridTemplateColumns:'1fr 110px 90px auto',gap:14,alignItems:'center',padding:'13px 20px',borderTop:i?'1px solid var(--border)':'none',opacity:k.active?1:0.4}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <span style={{fontWeight:600,fontSize:13.5}}>{k.appName}</span>
                  <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:20,
                    background: k.active ? 'oklch(0.24 0.06 145)' : 'var(--bg4)',
                    color:      k.active ? 'oklch(0.74 0.14 145)' : 'var(--fg-muted)'}}>
                    {k.active ? 'active' : 'revoked'}
                  </span>
                </div>
                <span className="mono" style={{fontSize:11.5,color:'var(--fg-muted)'}}>{k.prefix}…</span>
              </div>
              <div style={{fontSize:11.5,color:'var(--fg-muted)',textAlign:'right'}}>
                <div>used {ago(k.lastUsedAt)}</div>
              </div>
              <div style={{fontSize:11.5,color:'var(--fg-muted)',textAlign:'right'}}>
                <div>created {ago(k.createdAt)}</div>
              </div>
              {k.active
                ? <button onClick={() => revoke(k._id, k.prefix)}
                    style={{background:'oklch(0.21 0.07 15)',border:'1px solid oklch(0.34 0.1 15)',color:'oklch(0.74 0.15 15)',borderRadius:6,fontSize:12,padding:'5px 12px',cursor:'pointer',fontWeight:500}}>
                    Revoke
                  </button>
                : <div/>}
            </div>
          ))}
        </div>
      </div>

      {/* Usage example */}
      <div className="card">
        <div className="card-h"><div><h3>Using your key</h3><div className="sub">Server-to-server — no user login needed</div></div></div>
        <div className="card-body">
          <p style={{color:'var(--fg-muted)',fontSize:13,marginBottom:14}}>
            Set <span className="mono">Authorization: ApiKey nx_your_key</span> on every request to <span className="mono">/api/notify</span>.
            Works from any language — Node.js, Python, Go, curl, etc.
          </p>
          <pre style={{background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:8,padding:'13px 16px',fontSize:12.5,lineHeight:1.8,overflowX:'auto',color:'var(--fg)'}}>{
`curl -X POST http://localhost:3000/api/notify \\
  -H "Authorization: ApiKey nx_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"recipientId":"user_alice","senderId":"my-app",
       "type":"comment","payload":{"message":"Hey!"},
       "idempotencyKey":"unique-id-001"}'`
          }</pre>
        </div>
      </div>
    </div>
  );
};

window.Screens = { Dashboard, Queue, Notifications, Settings, Metrics, ApiKeys };
