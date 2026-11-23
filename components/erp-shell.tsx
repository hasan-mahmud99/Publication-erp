"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Bell, BookOpen, ChartNoAxesCombined, ChevronDown, Factory,
  FileText, LayoutDashboard, LogOut, Menu, Package, Search,
  ShieldCheck, Truck, Users, Wallet,
} from 'lucide-react';
import { allScreens, findScreen, moduleGroups, type Screen } from '@/lib/screens';
import { copy } from '@/lib/i18n';
import { api } from '@/lib/api';

const VISIBLE_SCREENS = 6;
const SIDEBAR_SCROLL_KEY = 'publishing_erp_sidebar_scroll';
let sidebarScrollPosition = 0;
let navigationSidebarScroll: number | null = null;

// Redundant or duplicate submodules removed from primary navigation for a cleaner, unified UX
const REDUNDANT_NAVIGATION_SCREENS = new Set([
  '/inventory-warehouse/reserved-and-available-stock',   // Redundant: available & reserved stock are in Inventory Overview
  '/inventory-warehouse/in-transit-stock',               // Redundant: in-transit is a tab inside Stock Transfer
  '/inventory-warehouse/transfer-approval-and-receipt',  // Redundant: receiving is handled inside Stock Transfer
  '/inventory-warehouse/stock-count-variance-approval', // Redundant: variance approval is part of Physical Stock Count
  '/inventory-warehouse/stock-adjustment',              // Redundant: adjustments are audited via Physical Count & Ledger
  '/inventory-warehouse/inventory-movement-analysis',    // Redundant: duplicated by Transaction Ledger & Reports
  '/inventory-warehouse/stock-reconciliation',          // Internal/Admin math check, not an everyday operational tool
  '/inventory-warehouse/stock-by-warehouse-bin',         // Redundant: warehouse & bin tracking is in Overview & Lots
  '/inventory-warehouse/reorder-planning',              // Redundant: replaced by the Low Stock Monitor
  '/inventory-warehouse/batch-lot-register',             // Hidden per request: specialized traceability not required in everyday nav

  // Marketing & Promotions: Consolidated into Release Calendar, Campaign List, and Promotion & Discount Rules
  '/marketing-promotions/create-campaign',           // Redundant: "+ New Campaign" modal is inside Campaign List
  '/marketing-promotions/campaign-budget-approval',  // Redundant: budget approval is handled directly inside Campaign List
  '/marketing-promotions/campaign-performance',      // Redundant: performance metrics are displayed on Campaign List cards
  '/marketing-promotions/event-launch-planner',      // Redundant: book launches are part of Release Calendar
  '/marketing-promotions/promotion-conflict-review', // Redundant: conflict warnings are shown inline inside Promotion & Discount Rules

  // CRM & Customer Management: Consolidated into Customer Profile (Directory & 360°), Opportunity Pipeline, and Complaints & Disputes
  '/crm-customers/crm-dashboard',                     // Redundant: high-level metrics are in Customer Directory KPI cards
  '/crm-customers/customer-contacts-and-addresses',   // Redundant: contacts & godowns are managed inside Customer 360° Profile
  '/crm-customers/customer-segmentation',             // Redundant: segmentation tags are managed on Customer Profile
  '/crm-customers/customer-activity-timeline',        // Redundant: activities & follow-ups are inside Customer 360° Profile
  '/crm-customers/territory-and-sales-assignment',    // Redundant: territory filter & assignment is on Customer Directory
  '/crm-customers/customer-duplicate-review',         // Redundant: duplicate protection is handled automatically on customer creation
  '/crm-customers/customer-profitability',            // Redundant: commercial invoices & returns are in Customer 360° Profile

  // Finance & Accounting: Consolidated into 8 Core Workspaces per business requirements
  '/finance-accounting/create-journal-voucher',            // Integrated inside Journal Voucher List (+ New Voucher modal)
  '/finance-accounting/journal-entry-detail',               // Integrated inside Journal Voucher List (slide-over voucher inspector)
  '/finance-accounting/general-ledger',                     // Integrated inside Journal & General Ledger workspace
  '/finance-accounting/trial-balance',                      // Integrated inside Financial Statements workspace
  '/finance-accounting/customer-ageing',                    // Integrated inside Accounts Receivable (AR Ageing tab)
  '/finance-accounting/supplier-ageing',                    // Integrated inside Accounts Payable (AP Ageing tab)
  '/finance-accounting/payment-voucher',                    // Integrated inside Cash & Bank / AP settlement flow
  '/finance-accounting/receipt-voucher',                    // Integrated inside Cash & Bank / AR collection flow
  '/finance-accounting/bank-reconciliation',                // Integrated inside Cash & Bank Management (Reconciliation tab)
  '/finance-accounting/fixed-assets',                       // Consolidated into Chart of Accounts & Balance Sheet
  '/finance-accounting/cost-centre-setup',                  // Consolidated into Chart of Accounts & Expense Management
  '/finance-accounting/fiscal-period-close',                // Integrated administrative control in Finance Dashboard & Statements
  '/finance-accounting/period-reopen-approval',             // Internal approval control inside Fiscal Period management
  '/finance-accounting/journal-reversal-register',          // Integrated action inside Journal & General Ledger
  '/finance-accounting/unapplied-receipts-and-payments',    // Integrated into Accounts Receivable & Accounts Payable workspaces
  '/finance-accounting/budget-vs-actual',                   // Integrated inside Expense Management
  '/finance-accounting/financial-audit-trail',              // Integrated into Finance Dashboard & Journal audit logs
]);

const iconFor = (slug: string) => {
  if (slug.includes('dashboard')) return LayoutDashboard;
  if (slug.includes('publishing') || slug.includes('manuscript') || slug.includes('authors')) return BookOpen;
  if (slug.includes('inventory')) return Package;
  if (slug.includes('production') || slug.includes('printing')) return Factory;
  if (slug.includes('finance') || slug.includes('vat')) return Wallet;
  if (slug.includes('sales') || slug.includes('procurement') || slug.includes('supplier')) return Truck;
  if (slug.includes('crm') || slug.includes('hr')) return Users;
  if (slug.includes('report')) return ChartNoAxesCombined;
  if (slug.includes('notification')) return Bell;
  if (slug.includes('administration')) return ShieldCheck;
  if (slug.includes('workflow')) return Activity;
  return FileText;
};

export function ErpShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [mobile, setMobile] = useState(false);
  const currentScreen = findScreen(pathname);
  const [openSection, setOpenSection] = useState<string | null>(() =>
    currentScreen?.moduleSlug ?? (pathname === '/dashboard' ? 'workspace' : null),
  );
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    if (!currentScreen) return {};
    const index = allScreens
      .filter(screen => screen.moduleSlug === currentScreen.moduleSlug)
      .findIndex(screen => screen.path === currentScreen.path);
    return index >= VISIBLE_SCREENS ? { [currentScreen.moduleSlug]: true } : {};
  });
  const t = copy;
  const groups = useMemo(
    () => moduleGroups.map(group => ({
      ...group,
      items: allScreens.filter(screen => screen.moduleSlug === group.slug && !REDUNDANT_NAVIGATION_SCREENS.has(screen.path)),
    })),
    [],
  );
  const matches = query.trim()
    ? allScreens.filter(screen =>
        !REDUNDANT_NAVIGATION_SCREENS.has(screen.path) &&
        `${screen.title} ${screen.module}`.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 8)
    : [];

  function rememberSidebarScroll(forNavigation = false) {
    const position = sidebarRef.current?.scrollTop ?? 0;
    sidebarScrollPosition = position;
    if (forNavigation) navigationSidebarScroll = position;
    try { sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(position)); } catch { /* In-memory position still works. */ }
  }

  useLayoutEffect(() => {
    let stored = navigationSidebarScroll ?? sidebarScrollPosition;
    if (navigationSidebarScroll === null) try { stored = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY)) || stored; } catch { /* Use in-memory position. */ }
    if (!Number.isFinite(stored) || stored <= 0) { navigationSidebarScroll = null; return; }
    if (sidebarRef.current) sidebarRef.current.scrollTop = stored;
    const frame = requestAnimationFrame(() => { if (sidebarRef.current) sidebarRef.current.scrollTop = stored; navigationSidebarScroll = null; });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!localStorage.getItem('publishing_erp_token')) router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (!localStorage.getItem('publishing_erp_token')) return;
    let active = true;
    const refresh = () => { void api<{ data: { unread: number } }>('/notifications/unread-count').then(result => { if (active) setNotificationUnread(result.data.unread); }).catch(() => { if (active) setNotificationUnread(0); }); };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('notifications:changed', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('notifications:changed', refresh); };
  }, [pathname]);

  useEffect(() => {
    const activeScreen = findScreen(pathname);
    setOpenSection(activeScreen?.moduleSlug ?? (pathname === '/dashboard' ? 'workspace' : null));
    if (activeScreen) {
      const index = allScreens
        .filter(screen => screen.moduleSlug === activeScreen.moduleSlug)
        .findIndex(screen => screen.path === activeScreen.path);
      if (index >= VISIBLE_SCREENS) {
        setExpandedModules(current => ({ ...current, [activeScreen.moduleSlug]: true }));
      }
    }
    setMobile(false);
  }, [pathname]);

  async function signOut() {
    try { await api('/auth/logout', { method: 'POST' }); }
    catch { /* Local sign-out still completes if the session has expired. */ }
    finally {
      localStorage.removeItem('publishing_erp_token');
      router.replace('/login');
    }
  }

  function toggleSection(section: string) {
    setOpenSection(current => current === section ? null : section);
  }

  function screenLink(screen: Screen, Icon: ReturnType<typeof iconFor>) {
    const isActive = pathname === screen.path || (pathname === '/publishing-catalog/book-master' && screen.path === '/publishing-catalog/create-book');
    return <Link key={screen.id} href={screen.path} title={screen.title}
      className={`nav-item ${isActive ? 'active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => { rememberSidebarScroll(true); setMobile(false); }}>
      <Icon size={15} aria-hidden="true" /><span>{screen.title}</span>
    </Link>;
  }

  if (!mounted) {
    return (
      <div className="shell" suppressHydrationWarning style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#64748b' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Loading workspace…</span>
        </div>
      </div>
    );
  }

  return <div className="shell" suppressHydrationWarning>
    <aside ref={sidebarRef} id="primary-navigation" className={`sidebar ${mobile ? 'mobile-open' : ''}`} aria-label="Main navigation" onScroll={() => rememberSidebarScroll()} suppressHydrationWarning>
      <Link href="/dashboard" className="brand" onClick={() => setMobile(false)}>
        <span className="brand-mark">P</span>
        <span>Publish<span style={{ color: '#2347a5' }}>ERP</span>
          <small style={{ display: 'block', fontSize: 9, color: '#8993a4', fontWeight: 600, marginTop: 3 }}>ENTERPRISE WORKSPACE</small>
        </span>
      </Link>
      <nav className="sidebar-navigation" aria-label="ERP sections" suppressHydrationWarning>
        <section className="sidebar-section" suppressHydrationWarning>
          <h2 className="sidebar-section-title">
            <button type="button" className={`sidebar-section-toggle ${openSection === 'workspace' ? 'is-open' : ''}`}
              aria-expanded={openSection === 'workspace'} aria-controls="section-workspace"
              onClick={() => toggleSection('workspace')}>
              <span>Workspace</span><ChevronDown className="sidebar-section-chevron" size={16} aria-hidden="true" />
            </button>
          </h2>
          <div id="section-workspace" className="sidebar-section-items" hidden={openSection !== 'workspace'} suppressHydrationWarning>
            <Link href="/dashboard" className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
              aria-current={pathname === '/dashboard' ? 'page' : undefined} onClick={() => { rememberSidebarScroll(true); setMobile(false); }}>
              <LayoutDashboard size={16} aria-hidden="true" /><span>{t.dashboard}</span>
            </Link>
          </div>
        </section>
        {groups.map(group => {
          const isOpen = openSection === group.slug;
          const expanded = Boolean(expandedModules[group.slug]);
          const remaining = Math.max(0, group.items.length - VISIBLE_SCREENS);
          const Icon = iconFor(group.slug);
          return <section className="sidebar-section" key={group.slug} suppressHydrationWarning>
            <h2 className="sidebar-section-title">
              <button type="button" className={`sidebar-section-toggle ${isOpen ? 'is-open' : ''}`}
                aria-expanded={isOpen} aria-controls={`section-${group.slug}`}
                onClick={() => toggleSection(group.slug)}>
                <span>{group.label}</span><ChevronDown className="sidebar-section-chevron" size={16} aria-hidden="true" />
              </button>
            </h2>
            <div id={`section-${group.slug}`} className="sidebar-section-items" hidden={!isOpen} suppressHydrationWarning>
              {group.items.slice(0, VISIBLE_SCREENS).map(screen => screenLink(screen, Icon))}
              {remaining > 0 && <>
                <div id={`extra-${group.slug}`} hidden={!expanded} suppressHydrationWarning>
                  {group.items.slice(VISIBLE_SCREENS).map(screen => screenLink(screen, Icon))}
                </div>
                <button type="button" className="nav-more"
                  aria-expanded={expanded} aria-controls={`extra-${group.slug}`}
                  onClick={() => setExpandedModules(current => ({ ...current, [group.slug]: !expanded }))}>
                  <ChevronDown className={expanded ? 'is-expanded' : ''} size={15} aria-hidden="true" />
                  {expanded ? 'Show fewer screens' : `More ${remaining} screens`}
                </button>
              </>}
            </div>
          </section>;
        })}
      </nav>
    </aside>
    {mobile && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <main className="main" suppressHydrationWarning>
      <header className="topbar" suppressHydrationWarning>
        <button type="button" className="btn menu-toggle" onClick={() => setMobile(current => !current)}
          aria-label="Toggle navigation" aria-controls="primary-navigation" aria-expanded={mobile}>
          <Menu size={16} />
        </button>
        <div style={{ position: 'relative', flex: 1 }} suppressHydrationWarning>
          <div style={{ position: 'relative' }} suppressHydrationWarning>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#8993a4' }} />
            <input className="search" style={{ paddingLeft: 32 }} placeholder={t.search} value={query}
              onChange={event => setQuery(event.target.value)} />
          </div>
          {matches.length > 0 && <div className="panel" style={{ position: 'absolute', top: 43, left: 0, right: 0, zIndex: 20, padding: 6 }}>
            {matches.map(screen => <Link key={screen.id} href={screen.path} onClick={() => setQuery('')}
              style={{ display: 'block', padding: 9, borderRadius: 6, fontSize: 12 }}>
              {screen.title}<small className="muted" style={{ display: 'block' }}>{screen.module}</small>
            </Link>)}
          </div>}
        </div>
        <Link href="/notifications-tasks/notification-center" className="btn" aria-label={`Notifications, ${notificationUnread} unread`}><Bell size={16} aria-hidden="true" />{notificationUnread > 0 && <strong>{notificationUnread > 99 ? '99+' : notificationUnread}</strong>}</Link>
        <button type="button" className="btn" onClick={signOut}><LogOut size={14} />{t.logout}</button>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: '#eaf0ff', color: '#2347a5', display: 'grid', placeItems: 'center', fontWeight: 800 }} suppressHydrationWarning>A</div>
      </header>
      <div className="content" suppressHydrationWarning>{children}</div>
    </main>
  </div>;
}
