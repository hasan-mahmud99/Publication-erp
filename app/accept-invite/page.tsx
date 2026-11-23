"use client";

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function AcceptInvitePage() {
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setError('Passwords do not match'); return; }
    setBusy(true); setError('');
    try {
      await api('/auth/accept-invite', { method: 'POST', body: JSON.stringify({ code: code.trim(), displayName: displayName.trim(), password }) });
      setComplete(true); setCode(''); setPassword(''); setConfirmation('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not accept invitation');
    } finally { setBusy(false); }
  }
  return <main className="login-wrap"><section className="panel login-card"><div className="eyebrow">PUBLISHERP ACCESS</div><h1 className="page-title">Accept invitation</h1>{complete ? <><p>Your account is ready. Sign in with your email and new password.</p><Link className="btn btn-primary" href="/login">Go to sign in</Link></> : <form onSubmit={event => void submit(event)} style={{ display: 'grid', gap: 16, marginTop: 24 }}><label className="field">Invitation code<input className="input" autoComplete="off" required value={code} onChange={event => setCode(event.target.value)} /></label><label className="field">Your name<input className="input" autoComplete="name" required value={displayName} onChange={event => setDisplayName(event.target.value)} /></label><label className="field">Password (at least 12 characters)<input className="input" type="password" minLength={12} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><label className="field">Confirm password<input className="input" type="password" minLength={12} autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>{error && <p className="alert-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Creating account…' : 'Create account'}</button><Link href="/login">Already have an account? Sign in</Link></form>}</section></main>;
}
