'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Building,
  CheckSquare,
  Square,
  RefreshCw,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

type ComplianceTask = {
  id: string;
  period: string;
  title: string;
  description: string;
  due_date: string;
  category: 'mushak_9_1' | 'vds' | 'tds' | 'record_keeping';
  is_completed: number | boolean;
  completed_at: string | null;
  completed_by_name: string | null;
  notes: string | null;
};

type ComplianceDashboard = {
  period: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  complianceRatePercent: number;
  deadlines: {
    mushak91Deadline: string;
    vdsTreasuryDeadline: string;
    tdsTreasuryDeadline: string;
  };
  tasks: ComplianceTask[];
};

export function TaxComplianceScreen() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(currentMonth);
  const [data, setData] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ data: ComplianceDashboard }>(`/tax/compliance?period=${period}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || 'Could not load compliance dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [period]);

  async function toggleTask(task: ComplianceTask) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const nextCompleted = !Boolean(task.is_completed);
      await api(`/tax/compliance/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          completed: nextCompleted,
          notes: nextCompleted ? 'Completed as per statutory NBR protocol' : '',
        }),
      });
      setNotice(`Task "${task.title}" updated.`);
      await loadDashboard();
    } catch (err: any) {
      setError(err?.message || 'Could not update compliance task');
    } finally {
      setBusy(false);
    }
  }

  const daysToFifteenth = () => {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth(), 15);
    if (today.getDate() > 15) {
      target.setMonth(target.getMonth() + 1);
    }
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eyebrow" style={{ color: '#16a34a' }}>
              Statutory Governance & Compliance Tracking
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: '#dcfce7',
                color: '#15803d',
              }}
            >
              Bangladesh NBR Regulatory Calendar
            </span>
          </div>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            Tax Compliance Checklist & Calendar
          </h1>
          <p className="muted">
            Track mandatory statutory deadlines: 15th of month for Mushak 9.1 Return and VDS Treasury deposit, 7th of month for TDS, and official NBR readiness checklist.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Filing Month:</span>
            <input
              type="month"
              className="input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ width: 160, height: 40 }}
            />
          </div>
          <button className="btn" onClick={() => void loadDashboard()}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="alert-success" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* Statutory Calendar Countdown Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {/* Mushak 9.1 Return Deadline Card */}
        <div
          className="panel"
          style={{
            padding: 20,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderLeft: '5px solid #2563eb',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
              VAT Return (Mushak 9.1)
            </span>
            <Clock size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px' }}>
            15th of the Month
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Next statutory deadline: <strong>{data?.deadlines?.mushak91Deadline || `${period}-15`}</strong> ({daysToFifteenth()} days remaining)
          </p>
        </div>

        {/* VDS Treasury Deposit Card */}
        <div
          className="panel"
          style={{
            padding: 20,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderLeft: '5px solid #16a34a',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
              VDS Treasury Deposit
            </span>
            <Building size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px' }}>
            Treasury Code 0311
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Deposit supplier withheld VAT to Bangladesh Treasury code <strong>1/1101/0020/0311</strong>
          </p>
        </div>

        {/* TDS Treasury Deposit Card */}
        <div
          className="panel"
          style={{
            padding: 20,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderLeft: '5px solid #d97706',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
              Author Royalty TDS Deposit
            </span>
            <ShieldCheck size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px' }}>
            7th of the Month
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Income Tax Act 2023 Sec 106/117 deposit via code <strong>1/1141/0010/0111</strong>
          </p>
        </div>
      </div>

      {/* Readiness Progress Meter */}
      <div className="panel" style={{ padding: 22, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Monthly Statutory Readiness Meter ({period})
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              {data?.completedTasks || 0} of {data?.totalTasks || 0} compliance checkpoints completed
            </p>
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>
            {data?.complianceRatePercent || 0}%
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              width: `${data?.complianceRatePercent || 0}%`,
              height: '100%',
              background: data?.complianceRatePercent === 100 ? '#16a34a' : '#2563eb',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Interactive Compliance Tasks Checklist */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Mandatory Tax Compliance Checkpoints
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              Loading compliance checkpoints...
            </div>
          ) : !Array.isArray(data?.tasks) || data.tasks.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              No compliance tasks found for this period.
            </div>
          ) : (
            (data?.tasks || []).map((task) => {
              const isDone = Boolean(task.is_completed);

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    padding: '16px 20px',
                    borderBottom: '1px solid #f1f5f9',
                    background: isDone ? '#fcfdfd' : '#ffffff',
                    transition: 'background 0.1s',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void toggleTask(task)}
                    disabled={busy}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: isDone ? '#16a34a' : '#94a3b8',
                      marginTop: 2,
                    }}
                  >
                    {isDone ? <CheckSquare size={22} /> : <Square size={22} />}
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong
                        style={{
                          fontSize: 14.5,
                          color: isDone ? '#64748b' : '#0f172a',
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </strong>
                      {(() => {
                        const cat = String(task.category || (task as any).task_key || 'statutory').toLowerCase();
                        const isM91 = cat.includes('mushak') || cat.includes('9_1');
                        const isVds = cat.includes('vds');
                        return (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              textTransform: 'uppercase',
                              background: isM91 ? '#eff6ff' : isVds ? '#f0fdf4' : '#fffbeb',
                              color: isM91 ? '#1d4ed8' : isVds ? '#15803d' : '#b45309',
                            }}
                          >
                            {cat.replace(/_/g, ' ')}
                          </span>
                        );
                      })()}
                    </div>

                    {task.description && (
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
                        {task.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b', marginTop: 6, flexWrap: 'wrap' }}>
                      <span>Due: <strong>{task.due_date ? String(task.due_date).slice(0, 10) : 'End of Month'}</strong></span>
                      {isDone && task.completed_at && (
                        <span style={{ color: '#16a34a' }}>
                          ✓ Completed on {String(task.completed_at).slice(0, 10)}
                        </span>
                      )}
                      {task.notes && (
                        <span>Note: {task.notes}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
