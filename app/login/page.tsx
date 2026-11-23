"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity, Bell, BookOpen, Boxes, Building2, CalendarDays, ChartNoAxesCombined,
  Factory, FileText, Globe2, LayoutDashboard, Megaphone, Package,
  PenLine, ReceiptText, RotateCcw, ShieldCheck, ShoppingCart, Truck,
  Users, Wallet,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { allScreens, moduleGroups } from '@/lib/screens';

const modulePresentation: Record<string, { icon: LucideIcon; description: string }> = {
  'dashboard-workspace': { icon: LayoutDashboard, description: 'Operational views and tasks' },
  'publishing-catalog': { icon: BookOpen, description: 'Titles, editions and prices' },
  'manuscript-editorial': { icon: PenLine, description: 'Submissions and editorial work' },
  'authors-contracts-rights': { icon: FileText, description: 'Contributors and agreements' },
  'printing-production': { icon: Factory, description: 'Print planning and production' },
  'suppliers': { icon: Building2, description: 'Supplier directory, bills, advances and ledger' },
  'procurement-suppliers': { icon: ShoppingCart, description: 'Suppliers and purchasing' },
  'inventory-warehouse': { icon: Boxes, description: 'Stock, transfers and counts' },
  'sales-distribution': { icon: Truck, description: 'Orders and distribution' },
  'returns-claims': { icon: RotateCcw, description: 'Returns and claims' },
  'finance-accounting': { icon: Wallet, description: 'Journals and ledgers' },
  'vat-tax': { icon: ReceiptText, description: 'Tax records and rules' },
  'crm-customers': { icon: Users, description: 'Customers and relationships' },
  'book-fair-events': { icon: CalendarDays, description: 'Fairs and event operations' },
  'marketing-promotions': { icon: Megaphone, description: 'Campaigns and promotions' },
  'ecommerce-digital': { icon: Globe2, description: 'Digital channels' },
  'hr-payroll': { icon: Users, description: 'People and payroll' },
  'reports-analytics': { icon: ChartNoAxesCombined, description: 'Reports and analysis' },
  'workflow-approvals': { icon: Activity, description: 'Reviews and approvals' },
  'notifications-tasks': { icon: Bell, description: 'Alerts and assignments' },
  'administration-security': { icon: ShieldCheck, description: 'Access and configuration' },
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ data: { accessToken: string } }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ email: email || 'admin@publishing-erp.local', password: password || 'DemoPass123!' }),
      });
      localStorage.setItem('publishing_erp_token', result.data.accessToken);
      router.replace('/dashboard');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page">
    <section className="panel login-modules" aria-labelledby="modules-heading">
      <div className="login-modules-heading">
        <div><div className="eyebrow">PUBLISHING OPERATIONS</div><h1 id="modules-heading">One workspace for every team</h1><p>Explore the modules available inside PublishERP.</p></div>
        <span className="login-module-count">{moduleGroups.length} modules</span>
      </div>
      <div className="login-module-grid">
        {moduleGroups.map((module, index) => {
          const details = modulePresentation[module.slug] || { icon: Package, description: 'Publishing workspace' };
          const Icon = details.icon;
          const count = allScreens.filter(screen => screen.moduleSlug === module.slug).length;
          return <div className="login-module-card" key={module.slug}>
            <div className="login-module-card-head"><span className="login-module-icon"><Icon size={18} aria-hidden="true" /></span><span className="login-module-number">{String(index + 1).padStart(2, '0')}</span></div>
            <h2>{module.label}</h2><p>{details.description}</p><span className="login-module-foot">{count} registered screens</span>
          </div>;
        })}
      </div>
      <p className="login-module-note">Module preview shows the registered product areas. Availability of individual workflows varies.</p>
    </section>
    <section className="panel login-card" aria-labelledby="sign-in-heading">
      <div className="brand login-brand"><span className="brand-mark">P</span><span>Publish<span className="login-brand-accent">ERP</span><small>ENTERPRISE WORKSPACE</small></span></div>
      <div className="eyebrow">SECURE ACCESS</div>
      <h2 id="sign-in-heading" className="page-title">Welcome back</h2>
      <p className="muted">Sign in to your publishing workspace.</p>
      <form className="login-form" onSubmit={submit}>
        <label className="field">Email address<input className="input" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="admin@publishing-erp.local" /></label>
        <label className="field">Password<input className="input" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••••••" /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn btn-primary login-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
      </form>
      <p className="login-invite"><ShieldCheck size={16} aria-hidden="true" /><Link href="/accept-invite">Have an invitation code? Create your account</Link></p>
    </section>
  </main>;
}
