"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Screen } from '@/lib/screens';

type User = { id: string; email: string; display_name: string; status: string; roles: string | null; last_login_at: string | null };
type Role = { id: string; name: string; description: string | null; permissions: string[] };
type Permission = { permission_key: string; description: string };
type Invitation = { id: string; email: string; role_name: string; expires_at: string; accepted_at: string | null; revoked_at: string | null };

export function AdminScreen({ screen }: { screen: Screen }) {
  const [isOwner, setIsOwner] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const [usersResult, rolesResult, permissionsResult, invitationResult, meResult] = await Promise.all([
      api<{ data: User[] }>('/admin/users'),
      api<{ data: Role[] }>('/admin/roles'),
      api<{ data: Permission[] }>('/admin/permissions'),
      api<{ data: Invitation[] }>('/admin/invitations'),
      api<{ data: { role: string } }>('/auth/me'),
    ]);
    setIsOwner(meResult.data.role === 'Owner');
    setUsers(usersResult.data);
    setRoles(rolesResult.data);
    setPermissions(permissionsResult.data);
    setInvitations(invitationResult.data);
    setInviteRole(current => current || rolesResult.data.find(role => role.name !== 'Owner')?.id || rolesResult.data[0]?.id || '');
    setSelectedRole(current => current || rolesResult.data.find(role => role.name !== 'Owner')?.id || '');
    setUserRoles(Object.fromEntries(usersResult.data.map(user => [user.id, rolesResult.data.find(role => role.name === user.roles)?.id || ''])));
  }
  useEffect(() => { void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load administration')).finally(() => setLoading(false)); }, []);
  useEffect(() => { setRolePermissions(roles.find(role => role.id === selectedRole)?.permissions || []); }, [selectedRole, roles]);

  async function act(task: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  async function invite() {
    if (!isOwner) return;
    await act(async () => {
      const result = await api<{ data: { code: string } }>('/admin/invitations', { method: 'POST', body: JSON.stringify({ email, roleId: inviteRole }) });
      setInviteCode(result.data.code); setEmail(''); await refresh();
    }, 'Invitation created. Share the code securely; it is shown only once.');
  }
  async function revokeInvite(id: string) {
    if (!isOwner || !window.confirm('Revoke this invitation? The code will stop working.')) return;
    await act(async () => {
      await api(`/admin/invitations/${id}/revoke`, { method: 'POST' });
      await refresh();
    }, 'Invitation revoked');
  }
  async function setAccess(id: string, change: { status?: string; roleId?: string }) {
    if (change.status === 'suspended' && !window.confirm('Suspend this user in your organization? Their active sessions will end.')) return;
    await act(async () => {
      await api(`/admin/users/${id}/access`, { method: 'PATCH', body: JSON.stringify(change) });
      await refresh();
    }, 'User access updated');
  }
  async function createRole() {
    if (!isOwner) return;
    await act(async () => {
      const result = await api<{ data: { id: string } }>('/admin/roles', { method: 'POST', body: JSON.stringify({ name: roleName, description: roleDescription, permissions: rolePermissions }) });
      setRoleName(''); setRoleDescription(''); await refresh(); setSelectedRole(result.data.id);
    }, 'Role created');
  }
  async function savePermissions() {
    if (!isOwner) return;
    await act(async () => {
      await api(`/admin/roles/${selectedRole}/permissions`, { method: 'PATCH', body: JSON.stringify({ permissions: rolePermissions }) });
      await refresh();
    }, 'Role permissions updated');
  }
  function togglePermission(key: string) {
    setRolePermissions(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  }

  let content: React.ReactNode;
  if (screen.title === 'User Directory') {
    content = <><section className="panel catalog-form"><h2 className="section-title">Invite a user</h2><div className="catalog-form-grid"><label className="field">Email<input className="input" type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label className="field">Role<select className="input" value={inviteRole} onChange={event => setInviteRole(event.target.value)}><option value="">Select role</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label></div><button className="btn btn-primary" disabled={!isOwner || busy || !email.trim() || !inviteRole} onClick={() => void invite()}>Create invitation</button><p className="muted">Give the code to the user securely. They can open /accept-invite and set their own password within seven days.</p>{inviteCode && <div className="alert-success" role="status"><strong>One-time invitation code:</strong> <code>{inviteCode}</code> <button className="btn" onClick={() => void navigator.clipboard.writeText(inviteCode)}>Copy</button></div>}</section><div className="panel table-wrap"><table className="data-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td>{user.display_name}<br /><span className="muted">{user.email}</span></td><td>{user.roles || '—'}</td><td>{user.status}</td><td>{user.last_login_at ? String(user.last_login_at).slice(0, 16) : 'Never'}</td></tr>)}</tbody></table></div><section className="panel catalog-form"><h2 className="section-title">Recent invitations</h2>{invitations.length ? invitations.map(item => <p key={item.id}>{item.email} · {item.role_name} · {item.accepted_at ? 'Accepted' : item.revoked_at ? 'Revoked' : 'Pending'} · expires {String(item.expires_at).slice(0, 10)} {!item.accepted_at && !item.revoked_at && isOwner && <button className="btn" disabled={busy} onClick={() => void revokeInvite(item.id)}>Revoke</button>}</p>) : <p className="muted">No invitations.</p>}</section></>;
  } else if (screen.title === 'User Profile & Access') {
    content = <div className="panel table-wrap"><table className="data-table"><thead><tr><th>User</th><th>Current role</th><th>Organization access</th><th>Change role</th><th>Action</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td>{user.display_name}<br /><span className="muted">{user.email}</span></td><td>{user.roles || '—'}</td><td>{user.status}</td><td><select className="input" value={userRoles[user.id] || ''} onChange={event => setUserRoles(current => ({ ...current, [user.id]: event.target.value }))}><option value="">Select role</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></td><td><div className="button-row"><button className="btn" disabled={!isOwner || busy || !userRoles[user.id] || userRoles[user.id] === roles.find(role => role.name === user.roles)?.id} onClick={() => void setAccess(user.id, { roleId: userRoles[user.id] })}>Save role</button><button className="btn" disabled={busy} onClick={() => void setAccess(user.id, { status: user.status === 'active' ? 'suspended' : 'active' })}>{user.status === 'active' ? 'Suspend' : 'Activate'}</button></div></td></tr>)}</tbody></table></div>;
  } else {
    content = <><section className="panel catalog-form"><h2 className="section-title">Role permissions</h2><label className="field">Role<select className="input" value={selectedRole} onChange={event => setSelectedRole(event.target.value)}><option value="">Select role</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>{selectedRole && roles.find(role => role.id === selectedRole)?.name === 'Owner' ? <p className="muted">Owner has full organization access. Its permissions are managed by the system.</p> : <><div className="catalog-form-grid">{permissions.map(permission => <label key={permission.permission_key} className="field"><span><input type="checkbox" checked={rolePermissions.includes(permission.permission_key)} disabled={!isOwner} onChange={() => togglePermission(permission.permission_key)} /> {permission.permission_key}</span><small className="muted">{permission.description}</small></label>)}</div>{selectedRole && <button className="btn btn-primary" disabled={!isOwner || busy} onClick={() => void savePermissions()}>Save permissions</button>}</>}</section><section className="panel catalog-form"><h2 className="section-title">Create role</h2><div className="catalog-form-grid"><label className="field">Name<input className="input" value={roleName} onChange={event => setRoleName(event.target.value)} /></label><label className="field">Description<input className="input" value={roleDescription} onChange={event => setRoleDescription(event.target.value)} /></label></div><p className="muted">The checked permissions above will be copied to the new role.</p><button className="btn" disabled={!isOwner || busy || !roleName.trim()} onClick={() => void createRole()}>Create role</button></section></>;
  }
  return <><div className="page-heading"><div><h1 className="page-title">{screen.title}</h1><p className="muted">{screen.description}</p></div><button className="btn" onClick={() => void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Refresh failed'))}>Refresh</button></div>{!isOwner && !loading && <p className="muted">Only an Owner can invite users, assign roles, or change role permissions.</p>}{error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="alert-success" role="status">{notice}</p>}{loading ? <div className="panel empty">Loading administration…</div> : content}</>;
}
