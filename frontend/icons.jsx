// Lightweight inline icons. Stroke-based, monochrome (currentColor).
const Icon = ({ name, size = 14, className = '', strokeWidth = 1.6 }) => {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    className,
  };
  switch (name) {
    case 'home': return (<svg {...props}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z"/></svg>);
    case 'queue': return (<svg {...props}><path d="M4 6h16M4 12h16M4 18h10"/></svg>);
    case 'bell': return (<svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>);
    case 'metrics': return (<svg {...props}><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 5-7"/></svg>);
    case 'settings': return (<svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.31.2.65.2 1s-.07.69-.2 1z"/></svg>);
    case 'search': return (<svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>);
    case 'help': return (<svg {...props}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>);
    case 'mail': return (<svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>);
    case 'phone': return (<svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg>);
    case 'push': return (<svg {...props}><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>);
    case 'inapp': return (<svg {...props}><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 22h10M9 18v4M15 18v4"/></svg>);
    case 'refresh': return (<svg {...props}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>);
    case 'plus': return (<svg {...props}><path d="M12 5v14M5 12h14"/></svg>);
    case 'check': return (<svg {...props}><path d="M5 12l5 5L20 7"/></svg>);
    case 'x': return (<svg {...props}><path d="M6 6l12 12M6 18L18 6"/></svg>);
    case 'filter': return (<svg {...props}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>);
    case 'calendar': return (<svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>);
    case 'download': return (<svg {...props}><path d="M12 3v12M6 11l6 6 6-6M5 21h14"/></svg>);
    case 'spark': return (<svg {...props}><path d="M12 2l2.4 5.6L20 8l-4 4 1 6-5-3-5 3 1-6-4-4 5.6-.4z"/></svg>);
    case 'chevron-down': return (<svg {...props}><path d="M6 9l6 6 6-6"/></svg>);
    case 'arrow-up': return (<svg {...props}><path d="M12 19V5M5 12l7-7 7 7"/></svg>);
    case 'arrow-down': return (<svg {...props}><path d="M12 5v14M19 12l-7 7-7-7"/></svg>);
    case 'dot': return (<svg {...props}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>);
    case 'heart': return (<svg {...props}><path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.07a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.79 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>);
    case 'comment': return (<svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
    case 'at': return (<svg {...props}><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>);
    case 'shield': return (<svg {...props}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/></svg>);
    case 'tag': return (<svg {...props}><path d="M20.59 13.41L13.41 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>);
    case 'clock': return (<svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
    case 'zap': return (<svg {...props}><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg>);
    case 'cube': return (<svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>);
    case 'play': return (<svg {...props}><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>);
    case 'pause': return (<svg {...props}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>);
    case 'menu-dots': return (<svg {...props}><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>);
    case 'logo': return (<svg {...props} viewBox="0 0 24 24"><path d="M4 6l8 6 8-6M4 6v12h16V6M4 6l8 8 8-8" stroke="currentColor" strokeWidth="1.6" fill="none"/></svg>);
    case 'user': return (<svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>);
    case 'eye': return (<svg {...props}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>);
    case 'mail-open': return (<svg {...props}><path d="M21 19V9l-9-6-9 6v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M3 9l9 6 9-6"/></svg>);
    case 'copy': return (<svg {...props}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>);
    case 'key': return (<svg {...props}><circle cx="7.5" cy="15.5" r="4.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L21 8l-3-3"/></svg>);
    default: return null;
  }
};

window.Icon = Icon;
