import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#334155', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 8, color: '#1e293b' }}>404</h1>
      <p style={{ fontSize: 16, color: '#64748b', marginBottom: 24 }}>Screen or resource not found</p>
      <Link href="/dashboard" style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
        Return to Dashboard
      </Link>
    </div>
  );
}
