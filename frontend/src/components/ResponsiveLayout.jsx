import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Home, FileText, CreditCard, Bell, Settings,
  User, ChevronRight, Search, Moon, Sun, Wifi, WifiOff
} from 'lucide-react';

// ── Breakpoint hook ────────────────────────────────────────────────────────
function useBreakpoint() {
  const [bp, setBp] = useState('desktop');
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setBp(w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return bp;
}

// ── Online status hook ─────────────────────────────────────────────────────
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// ── Touch swipe hook ───────────────────────────────────────────────────────
function useSwipe(onSwipeLeft, onSwipeRight) {
  const startX = useRef(null);
  const onTouchStart = useCallback(e => { startX.current = e.touches[0].clientX; }, []);
  const onTouchEnd   = useCallback(e => {
    if (startX.current === null) return;
    const diff = startX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? onSwipeLeft?.() : onSwipeRight?.();
    startX.current = null;
  }, [onSwipeLeft, onSwipeRight]);
  return { onTouchStart, onTouchEnd };
}

// ── Nav items ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',  icon: Home },
  { id: 'claims',    label: 'Claims',     icon: FileText },
  { id: 'payments',  label: 'Payments',   icon: CreditCard },
  { id: 'alerts',    label: 'Alerts',     icon: Bell, badge: 3 },
  { id: 'settings',  label: 'Settings',   icon: Settings },
];

// ── Demo page content ──────────────────────────────────────────────────────
const PAGE_CONTENT = {
  dashboard: {
    title: 'Dashboard',
    cards: [
      { label: 'Active Policies', value: '12', color: 'bg-blue-500' },
      { label: 'Pending Claims',  value: '4',  color: 'bg-yellow-500' },
      { label: 'Total Paid',      value: '$8,240', color: 'bg-green-500' },
      { label: 'Alerts',          value: '3',  color: 'bg-red-500' },
    ],
  },
  claims: {
    title: 'Claims',
    cards: [
      { label: 'Submitted',  value: '7',  color: 'bg-blue-500' },
      { label: 'Approved',   value: '5',  color: 'bg-green-500' },
      { label: 'Rejected',   value: '1',  color: 'bg-red-500' },
      { label: 'Processing', value: '1',  color: 'bg-yellow-500' },
    ],
  },
  payments: {
    title: 'Payments',
    cards: [
      { label: 'This Month',  value: '$420',   color: 'bg-blue-500' },
      { label: 'Last Month',  value: '$380',   color: 'bg-indigo-500' },
      { label: 'Outstanding', value: '$120',   color: 'bg-red-500' },
      { label: 'Total YTD',   value: '$3,200', color: 'bg-green-500' },
    ],
  },
  alerts: {
    title: 'Alerts',
    cards: [
      { label: 'Critical', value: '1', color: 'bg-red-500' },
      { label: 'Warning',  value: '2', color: 'bg-yellow-500' },
      { label: 'Info',     value: '5', color: 'bg-blue-500' },
      { label: 'Resolved', value: '9', color: 'bg-green-500' },
    ],
  },
  settings: {
    title: 'Settings',
    cards: [
      { label: 'Profile',       value: '→', color: 'bg-gray-500' },
      { label: 'Notifications', value: '→', color: 'bg-gray-500' },
      { label: 'Security',      value: '→', color: 'bg-gray-500' },
      { label: 'Preferences',   value: '→', color: 'bg-gray-500' },
    ],
  },
};

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ active, onSelect, dark }) {
  return (
    <nav className={`h-full flex flex-col py-4 ${dark ? 'bg-gray-900' : 'bg-white border-r border-gray-200'}`}
      role="navigation" aria-label="Main navigation">
      <div className="px-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">HC</span>
          </div>
          <span className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-800'}`}>HealthCare</span>
        </div>
      </div>
      <ul className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => (
          <li key={id}>
            <button
              onClick={() => onSelect(id)}
              aria-current={active === id ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                active === id
                  ? 'bg-blue-600 text-white'
                  : dark
                    ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}>
              <Icon size={18} aria-hidden="true" />
              <span className="flex-1 text-left">{label}</span>
              {badge && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {badge}
                </span>
              )}
              {active === id && <ChevronRight size={14} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
      <div className={`px-4 pt-4 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={16} className="text-blue-600" aria-hidden="true" />
          </div>
          <div>
            <p className={`text-xs font-medium ${dark ? 'text-white' : 'text-gray-800'}`}>John Doe</p>
            <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Provider</p>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ── Mobile bottom nav ──────────────────────────────────────────────────────
function BottomNav({ active, onSelect, dark }) {
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 flex border-t ${
        dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      }`}
      role="navigation" aria-label="Mobile navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          aria-current={active === id ? 'page' : undefined}
          aria-label={label}
          className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 relative ${
            active === id
              ? 'text-blue-600'
              : dark ? 'text-gray-400' : 'text-gray-500'
          }`}>
          <div className="relative">
            <Icon size={20} aria-hidden="true" />
            {badge && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {badge}
              </span>
            )}
          </div>
          <span className="truncate max-w-full px-1">{label}</span>
          {active === id && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>
      ))}
    </nav>
  );
}

// ── Page content area ──────────────────────────────────────────────────────
function PageContent({ pageId, dark }) {
  const page = PAGE_CONTENT[pageId] ?? PAGE_CONTENT.dashboard;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageId}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2 }}>
        <h1 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${dark ? 'text-white' : 'text-gray-900'}`}>
          {page.title}
        </h1>

        {/* Stats grid — responsive columns */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {page.cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl p-4 ${dark ? 'bg-gray-800' : 'bg-white border border-gray-200'} shadow-sm`}>
              <div className={`w-8 h-8 ${card.color} rounded-lg mb-3 flex items-center justify-center`}>
                <span className="text-white text-xs font-bold">{card.value.charAt(0)}</span>
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                {card.value}
              </p>
              <p className={`text-xs mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{card.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Recent activity list */}
        <div className={`rounded-xl ${dark ? 'bg-gray-800' : 'bg-white border border-gray-200'} shadow-sm overflow-hidden`}>
          <div className={`px-4 py-3 border-b ${dark ? 'border-gray-700' : 'border-gray-100'}`}>
            <h2 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>Recent Activity</h2>
          </div>
          <ul>
            {[1, 2, 3, 4].map(n => (
              <li key={n}
                className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 ${
                  dark ? 'border-gray-700' : 'border-gray-50'
                }`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 ${
                  ['bg-blue-100','bg-green-100','bg-yellow-100','bg-red-100'][n-1]
                } flex items-center justify-center`}>
                  <span className={`text-xs font-bold ${
                    ['text-blue-600','text-green-600','text-yellow-600','text-red-600'][n-1]
                  }`}>{n}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${dark ? 'text-white' : 'text-gray-800'}`}>
                    Activity item {n}
                  </p>
                  <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {n} hour{n > 1 ? 's' : ''} ago
                  </p>
                </div>
                <ChevronRight size={14} className={dark ? 'text-gray-500' : 'text-gray-400'} aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════
export default function ResponsiveLayout() {
  const bp       = useBreakpoint();
  const online   = useOnlineStatus();
  const [active,      setActive]      = useState('dashboard');
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [dark,        setDark]        = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';

  // Close drawer on desktop resize
  useEffect(() => { if (!isMobile && !isTablet) setMenuOpen(false); }, [isMobile, isTablet]);

  const swipe = useSwipe(
    () => setMenuOpen(false),
    () => isMobile && setMenuOpen(true)
  );

  const handleSelect = (id) => {
    setActive(id);
    setMenuOpen(false);
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}
      {...swipe}>

      {/* ── Top bar ── */}
      <header className={`sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b ${
        dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      } shadow-sm`}
        role="banner">

        {/* Hamburger (mobile/tablet) */}
        {(isMobile || isTablet) && (
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="sidebar-drawer"
            className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              dark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            }`}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}

        <span className={`font-semibold text-sm flex-1 ${dark ? 'text-white' : 'text-gray-800'}`}>
          {isMobile ? 'HC Portal' : 'HealthCare Portal'}
        </span>

        {/* Offline indicator */}
        {!online && (
          <span className="flex items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-1 rounded-full">
            <WifiOff size={12} aria-hidden="true" /> Offline
          </span>
        )}
        {online && !isMobile && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Wifi size={12} aria-hidden="true" />
          </span>
        )}

        {/* Search */}
        <div className="relative">
          {searchOpen ? (
            <input
              autoFocus
              type="search"
              aria-label="Search"
              placeholder="Search…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onBlur={() => { setSearchOpen(false); setSearchQuery(''); }}
              className={`w-40 sm:w-56 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                dark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300'
              }`}
            />
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
              className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                dark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
              }`}>
              <Search size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDark(d => !d)}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            dark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          }`}>
          {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Desktop sidebar ── */}
        {!isMobile && !isTablet && (
          <aside className="w-56 flex-shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
            <Sidebar active={active} onSelect={handleSelect} dark={dark} />
          </aside>
        )}

        {/* ── Mobile/tablet drawer ── */}
        <AnimatePresence>
          {(isMobile || isTablet) && menuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/40"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              {/* Drawer */}
              <motion.aside
                id="sidebar-drawer"
                key="drawer"
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.25 }}
                className={`fixed top-0 left-0 z-50 w-64 h-full shadow-xl ${
                  dark ? 'bg-gray-900' : 'bg-white'
                }`}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu">
                <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-700">
                  <span className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-800'}`}>Menu</span>
                  <button onClick={() => setMenuOpen(false)} aria-label="Close menu"
                    className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <X size={18} />
                  </button>
                </div>
                <Sidebar active={active} onSelect={handleSelect} dark={dark} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Main content ── */}
        <main
          className={`flex-1 overflow-y-auto p-4 sm:p-6 ${isMobile ? 'pb-20' : ''}`}
          role="main"
          id="main-content">
          {/* Breakpoint badge (dev helper) */}
          <div className="mb-4 flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isMobile ? 'bg-orange-100 text-orange-700'
              : isTablet ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
            }`}>
              {bp.charAt(0).toUpperCase() + bp.slice(1)} view
            </span>
            <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-400'}`}>
              {isMobile ? 'Swipe right to open menu' : isTablet ? 'Tap ☰ to open menu' : 'Sidebar always visible'}
            </span>
          </div>

          <PageContent pageId={active} dark={dark} />
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      {isMobile && <BottomNav active={active} onSelect={handleSelect} dark={dark} />}
    </div>
  );
}
