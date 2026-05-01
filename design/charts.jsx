// Charts: hand-rolled SVG line/area + bar charts with grid + tooltip-on-hover.

const Sparkline = ({ data, w = 88, h = 28, color = 'currentColor' }) => {
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i*step, h - ((v-min)/span)*h]);
  const d = pts.map((p, i) => (i===0?'M':'L') + p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const area = d + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'block'}}>
      <path d={area} fill={color} fillOpacity="0.10" stroke="none"/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
};

const AreaChart = ({ series, labels, height = 240, range = '24h' }) => {
  const W = 760, H = height, pad = { l: 36, r: 12, t: 16, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const all = [...series.sent, ...series.delivered];
  const maxRaw = Math.max(...all);
  const max = Math.ceil(maxRaw / 1000) * 1000;
  const yTicks = 4;
  const xs = (i) => pad.l + (i/(labels.length-1))*iw;
  const ys = (v) => pad.t + ih - (v/max)*ih;

  const linePath = (arr) => arr.map((v,i)=> (i===0?'M':'L') + xs(i).toFixed(1)+','+ys(v).toFixed(1)).join(' ');
  const areaPath = (arr) => linePath(arr) + ` L${xs(arr.length-1)},${pad.t+ih} L${xs(0)},${pad.t+ih} Z`;

  const [hover, setHover] = React.useState(null);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    if (x < pad.l || x > pad.l + iw) { setHover(null); return; }
    const ratio = (x - pad.l) / iw;
    const i = Math.round(ratio * (labels.length-1));
    setHover(i);
  };

  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseMove={onMove} onMouseLeave={()=>setHover(null)}>
        <defs>
          <linearGradient id="grad-sent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.18 0 0)" stopOpacity="0.10"/>
            <stop offset="100%" stopColor="oklch(0.18 0 0)" stopOpacity="0"/>
          </linearGradient>
          <pattern id="diag" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="oklch(0.18 0 0)" strokeOpacity="0.05" strokeWidth="2"/>
          </pattern>
        </defs>
        {/* y grid */}
        {Array.from({length: yTicks+1}).map((_,i)=>{
          const y = pad.t + (ih/yTicks)*i;
          const v = max - (max/yTicks)*i;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W-pad.r} y1={y} y2={y} stroke="oklch(0.91 0 0)" strokeWidth="1" strokeDasharray={i===yTicks?'':'2 3'}/>
              <text x={pad.l-8} y={y+3} textAnchor="end" fontSize="10" fill="oklch(0.64 0 0)" fontFamily="ui-monospace,monospace">
                {v >= 1000 ? (v/1000).toFixed(0)+'k' : v.toFixed(0)}
              </text>
            </g>
          );
        })}
        {/* x labels (every 4) */}
        {labels.map((l,i)=> i%4===0 ? (
          <text key={i} x={xs(i)} y={H-pad.b+14} textAnchor="middle" fontSize="10" fill="oklch(0.64 0 0)" fontFamily="ui-monospace,monospace">{l}:00</text>
        ): null)}
        {/* area + lines */}
        <path d={areaPath(series.sent)} fill="url(#grad-sent)"/>
        <path d={linePath(series.sent)} fill="none" stroke="oklch(0.18 0 0)" strokeWidth="1.5"/>
        <path d={linePath(series.delivered)} fill="none" stroke="oklch(0.52 0 0)" strokeWidth="1.3" strokeDasharray="3 3"/>
        <path d={linePath(series.failed)} fill="none" stroke="oklch(0.54 0.16 25)" strokeWidth="1.3"/>

        {/* hover */}
        {hover != null && (
          <g>
            <line x1={xs(hover)} x2={xs(hover)} y1={pad.t} y2={pad.t+ih} stroke="oklch(0.64 0 0)" strokeWidth="1" strokeDasharray="2 3"/>
            <circle cx={xs(hover)} cy={ys(series.sent[hover])} r="3.5" fill="oklch(0.18 0 0)" stroke="var(--panel)" strokeWidth="2"/>
            <circle cx={xs(hover)} cy={ys(series.delivered[hover])} r="3" fill="oklch(0.52 0 0)" stroke="var(--panel)" strokeWidth="2"/>
            <circle cx={xs(hover)} cy={ys(series.failed[hover])} r="3" fill="oklch(0.54 0.16 25)" stroke="var(--panel)" strokeWidth="2"/>
          </g>
        )}
      </svg>
      {hover != null && (
        <div style={{
          position:'absolute',
          left: `calc(${(xs(hover)/W)*100}% + 8px)`,
          top: 12,
          background:'var(--bg-elev)',
          border:'1px solid var(--border-strong)',
          borderRadius:8, padding:'8px 10px',
          fontSize:11, minWidth:170,
          boxShadow:'var(--shadow-md)',
          pointerEvents:'none',
          fontFamily:'var(--font-mono)',
        }}>
          <div style={{color:'var(--fg-faint)', marginBottom:6}}>{labels[hover]}:00 — {labels[hover]}:59</div>
          <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
            <span><span className="legend-dot" style={{background:'oklch(0.68 0.13 245)'}}/>Sent</span>
            <span style={{color:'var(--fg)'}}>{series.sent[hover].toLocaleString()}</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
            <span><span className="legend-dot" style={{background:'oklch(0.72 0.14 155)'}}/>Delivered</span>
            <span style={{color:'var(--fg)'}}>{series.delivered[hover].toLocaleString()}</span>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
            <span><span className="legend-dot" style={{background:'oklch(0.68 0.17 25)'}}/>Failed</span>
            <span style={{color:'var(--fg)'}}>{series.failed[hover].toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const RingChart = ({ value, label, color = 'oklch(0.72 0.14 155)' }) => {
  const r = 44, c = 2*Math.PI*r;
  const off = c - (value/100)*c;
  return (
    <div style={{display:'flex', alignItems:'center', gap:16}}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="oklch(0.91 0 0)" strokeWidth="8"/>
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
                strokeDasharray={c} strokeDashoffset={off}
                strokeLinecap="round" transform="rotate(-90 60 60)"/>
        <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="600" fill="oklch(0.18 0 0)" fontFamily="Inter">
          {value.toFixed(2)}%
        </text>
        <text x="60" y="76" textAnchor="middle" fontSize="10" fill="oklch(0.64 0 0)" fontFamily="ui-monospace,monospace" letterSpacing="0.06em">
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
};

const BarChart = ({ data, labels, color = 'oklch(0.18 0 0)', height = 200, suffix = '' }) => {
  const W = 600, H = height, pad = { l: 40, r: 12, t: 12, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.ceil(Math.max(...data) * 1.15);
  const bw = iw / data.length * 0.62;
  const gap = iw / data.length * 0.38;
  const [hover, setHover] = React.useState(null);
  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {Array.from({length:5}).map((_,i)=>{
          const y = pad.t + (ih/4)*i;
          const v = max - (max/4)*i;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W-pad.r} y1={y} y2={y} stroke="oklch(0.91 0 0)" strokeDasharray={i===4?'':'2 3'}/>
              <text x={pad.l-8} y={y+3} textAnchor="end" fontSize="10" fill="oklch(0.64 0 0)" fontFamily="ui-monospace,monospace">
                {v.toFixed(0)}{suffix}
              </text>
            </g>
          );
        })}
        {data.map((v,i)=>{
          const x = pad.l + i*(bw+gap) + gap/2;
          const h = (v/max)*ih;
          const y = pad.t + ih - h;
          return (
            <g key={i} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}>
              <rect x={x} y={y} width={bw} height={h} rx="1"
                    fill={hover===i? 'oklch(0.32 0 0)' : color} fillOpacity={hover===i?1:0.85}/>
              <text x={x+bw/2} y={H-pad.b+14} textAnchor="middle" fontSize="10" fill="oklch(0.64 0 0)" fontFamily="ui-monospace,monospace">{labels[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const Heatmap = ({ rows = 7, cols = 24 }) => {
  // synthetic intensities
  const r = (() => { let s = 7; return () => { s = (s*9301 + 49297) % 233280; return s/233280; }; })();
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const base = 0.15 + (x>=8 && x<=20 ? 0.55 : 0.1) + (y>=1 && y<=5 ? 0.20 : 0);
    const v = Math.min(1, base * (0.6 + r()*0.8));
    cells.push({x,y,v});
  }
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return (
    <div>
      <div style={{display:'grid', gridTemplateColumns:`28px repeat(${cols}, 1fr)`, gap:3, alignItems:'center'}}>
        <div></div>
        {Array.from({length:cols}).map((_,i)=>(
          <div key={i} style={{fontFamily:'var(--font-mono)', fontSize:9, color:'var(--fg-faint)', textAlign:'center'}}>{i%4===0?String(i).padStart(2,'0'):''}</div>
        ))}
        {days.map((d, y)=>(
          <React.Fragment key={d}>
            <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--fg-faint)'}}>{d}</div>
            {Array.from({length:cols}).map((_,x)=>{
              const cell = cells[y*cols + x];
              return <div key={x} title={`${d} ${x}:00 — intensity ${(cell.v*100).toFixed(0)}%`}
                          style={{
                            aspectRatio:'1', borderRadius:2,
                            background:`oklch(0.18 0 0 / ${0.04 + cell.v*0.55})`,
                            border:'1px solid oklch(0.91 0 0)',
                          }}/>;
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:6, marginTop:10, fontSize:10, color:'var(--fg-faint)', fontFamily:'var(--font-mono)'}}>
        <span>less</span>
        {[0.1,0.25,0.45,0.65,0.85].map((v,i)=>(
          <div key={i} style={{width:12, height:12, borderRadius:2, background:`oklch(0.18 0 0 / ${0.04+v*0.55})`, border:'1px solid var(--border)'}}/>
        ))}
        <span>more</span>
      </div>
    </div>
  );
};

window.Charts = { Sparkline, AreaChart, RingChart, BarChart, Heatmap };
