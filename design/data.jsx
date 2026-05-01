// Realistic mock data for NotifyX

const STATS = [
  { label: 'Total Notifications', value: '2,847,193', delta: '+4.2%', trend: 'up', since: 'vs last 7d', icon: 'bell',
    spark: [22,24,21,28,30,27,33,36,34,38,37,42] },
  { label: 'Active Jobs', value: '1,284', delta: '+86', trend: 'up', since: 'in queue', icon: 'zap',
    spark: [10,12,14,11,18,22,20,24,26,28,32,34] },
  { label: 'Failed Jobs', value: '47', delta: '-12', trend: 'down', since: 'last hour', icon: 'x',
    spark: [9,12,8,14,10,7,11,8,6,5,4,3] },
  { label: 'Processing Rate', value: '4,127/s', delta: '+0.8%', trend: 'up', since: 'p95 latency 124ms', icon: 'cube',
    spark: [38,40,41,42,40,42,43,44,42,43,44,45] },
];

// Time series for jobs-over-time chart (24 buckets ~ last 24h)
const JOBS_SERIES = {
  labels: ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'],
  sent:      [2100,1840,1620,1480,1390,1410,1620,2100,2980,3640,3920,4180,4320,4280,4120,4040,3960,3880,3720,3460,3220,2980,2740,2510],
  delivered: [2050,1810,1600,1460,1370,1390,1600,2070,2940,3590,3870,4120,4260,4220,4060,3980,3900,3820,3660,3400,3170,2930,2700,2470],
  failed:    [42, 28, 16, 18, 12, 17, 22, 31, 38, 50, 42, 56, 61, 58, 49, 52, 59, 55, 58, 56, 49, 47, 38, 38],
};

const ACTIVITY = [
  { ch: 'email', title: <>Order confirmation sent to <b>noah.alvarez@figment.io</b></>, meta: 'evt_01HNZK3 · order.placed · template ord-conf-v3', t: 'just now' },
  { ch: 'push',  title: <>Push fanout to <b>14,208 recipients</b> for <b>release-notes-may</b></>, meta: 'evt_01HNZK1 · campaign · APNs + FCM', t: '14s ago' },
  { ch: 'sms',   title: <>2FA code delivered to <b>+1 (415) ···· 8214</b></>, meta: 'evt_01HNZJW · auth.mfa · twilio · 1 attempt', t: '38s ago' },
  { ch: 'inapp', title: <>3 mentions batched for <b>@priya.k</b> in #design-review</>, meta: 'evt_01HNZJP · inapp.mention · batched ×3', t: '1m ago' },
  { ch: 'email', title: <>Weekly digest queued for <b>8,940 users</b></>, meta: 'evt_01HNZJK · digest.weekly · ses-pool-2', t: '2m ago' },
  { ch: 'push',  title: <>Silent push to refresh inventory caches</>, meta: 'evt_01HNZJC · system.cache · 122 devices', t: '3m ago' },
  { ch: 'email', title: <>Receipt re-sent after bounce retry</>, meta: 'evt_01HNZJ4 · billing.receipt · attempt 2/3', t: '4m ago' },
  { ch: 'inapp', title: <>New comment on <b>Q2 launch plan</b> for <b>@martin.d</b></>, meta: 'evt_01HNZHX · comment.created', t: '6m ago' },
];

// Queue jobs
const JOB_TYPES = [
  'email.transactional', 'email.digest', 'push.broadcast', 'push.silent',
  'sms.otp', 'inapp.mention', 'inapp.comment', 'webhook.outbound',
];
const STATUSES = ['active','pending','completed','failed','delayed'];

function rand(seed) {
  let s = seed; return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const QUEUE_JOBS = (() => {
  const r = rand(42);
  const types = JOB_TYPES;
  const out = [];
  const baseTime = Date.now() - 60_000;
  for (let i = 0; i < 24; i++) {
    const id = `job_01HNZ${(0xA000 + i).toString(16).toUpperCase()}${Math.floor(r()*9999).toString().padStart(4,'0')}`;
    const status = (() => {
      const x = r();
      if (i < 4) return 'failed';
      if (x < 0.10) return 'failed';
      if (x < 0.35) return 'active';
      if (x < 0.50) return 'pending';
      if (x < 0.58) return 'delayed';
      return 'completed';
    })();
    const attempts = status === 'failed' ? Math.ceil(r()*3) + (i<2 ? 2 : 1) : status === 'pending' ? 0 : status === 'active' ? 1 : 1;
    const max = 5;
    const type = types[Math.floor(r()*types.length)];
    const ago = Math.floor(r() * 1800) + i * 12; // seconds
    out.push({
      id, type, status, attempts, max,
      created: ago,
      payload: type.startsWith('email') ? `to=${['noah','priya','marcus','sasha','elena'][i%5]}@…` :
               type.startsWith('push')  ? `topic=release-notes-${i%4}` :
               type.startsWith('sms')   ? `to=+1•••${1000+i}` :
               type.startsWith('webhook')? `url=hooks.partner.io/v1/…` :
                                           `target=workspace/${i%6}`,
      error: status === 'failed' ? ['SMTP 421 throttled','recipient bounced','provider timeout','rate limited'][i%4] : null,
    });
  }
  return out;
})();

// Notifications (in-app, grouped)
const NOTIFICATIONS = [
  { group: 'Today', items: [
    { id:'n1', kind:'comment', read:false, batched: 0,
      title: (<><b>Marcus Lin</b> and <b>2 others</b> commented on <b>Q2 launch plan</b></>),
      meta: 'design-review · comment.created', t: '8 min ago' },
    { id:'n2', kind:'mention', read:false, batched: 3,
      title: (<><b>@priya.k</b> mentioned you 3 times in <b>#design-review</b></>),
      meta: 'inapp.mention · batched ×3', t: '12 min ago' },
    { id:'n3', kind:'system', read:false, batched: 0,
      title: (<>Deploy <b>notifyx-worker@v2.18.0</b> rolled out to <b>prod-eu</b></>),
      meta: 'system.deploy · ci#48214', t: '24 min ago' },
    { id:'n4', kind:'like', read:true, batched: 14,
      title: (<><b>14 people</b> reacted to your post in <b>#general</b></>),
      meta: 'reaction.added · batched ×14', t: '1h ago' },
  ]},
  { group: 'Yesterday', items: [
    { id:'n5', kind:'comment', read:true, batched: 0,
      title: (<><b>Elena Park</b> replied to your thread in <b>#eng-platform</b></>),
      meta: 'thread.reply', t: 'Yesterday, 18:42' },
    { id:'n6', kind:'mention', read:true, batched: 0,
      title: (<><b>@noah.a</b> assigned <b>NTFX-1184</b> to you</>),
      meta: 'task.assigned', t: 'Yesterday, 16:10' },
    { id:'n7', kind:'system', read:true, batched: 0,
      title: (<>Quota threshold reached: <b>SES pool 2</b> at 82% of daily cap</>),
      meta: 'alert.quota · severity=warn', t: 'Yesterday, 11:03' },
  ]},
  { group: 'Earlier this week', items: [
    { id:'n8', kind:'like', read:true, batched: 6,
      title: (<><b>6 teammates</b> followed your runbook <b>incident-response.md</b></>),
      meta: 'follow.added · batched ×6', t: 'Mon, 09:24' },
    { id:'n9', kind:'system', read:true, batched: 0,
      title: (<>Webhook endpoint <b>hooks.partner.io</b> recovered after 4m outage</>),
      meta: 'webhook.recovered', t: 'Mon, 07:58' },
  ]},
];

// Default preferences
const DEFAULT_PREFS = {
  likes: { on: true, channels: { inapp: true, push: false, email: false } },
  comments: { on: true, channels: { inapp: true, push: true, email: false } },
  mentions: { on: true, channels: { inapp: true, push: true, email: true } },
  follows: { on: false, channels: { inapp: true, push: false, email: false } },
  digests: { on: true, channels: { inapp: false, push: false, email: true } },
  security: { on: true, channels: { inapp: true, push: true, email: true, sms: true } },
  marketing: { on: false, channels: { inapp: false, push: false, email: true } },
};

const PREF_DEFS = [
  { key:'likes',     icon:'heart',   label:'Likes & reactions', desc:'When someone reacts to a post or comment you authored.' },
  { key:'comments',  icon:'comment', label:'Comments & replies', desc:'New comments on threads, docs, and tasks you participate in.' },
  { key:'mentions',  icon:'at',      label:'Mentions',           desc:'Direct @-mentions in any channel or document.' },
  { key:'follows',   icon:'user',    label:'New followers',      desc:'When someone follows your profile or runbooks.' },
  { key:'digests',   icon:'mail',    label:'Weekly digest',      desc:'Sunday morning summary of activity you missed.' },
  { key:'security',  icon:'shield',  label:'Security alerts',    desc:'Sign-ins, MFA changes, recovery codes. Cannot be disabled.', locked: true },
  { key:'marketing', icon:'tag',     label:'Product updates',    desc:'New features, changelog highlights, and beta invites.' },
];

window.NTFX_DATA = { STATS, JOBS_SERIES, ACTIVITY, QUEUE_JOBS, NOTIFICATIONS, DEFAULT_PREFS, PREF_DEFS, JOB_TYPES, STATUSES };
