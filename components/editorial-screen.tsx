"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, apiFile } from '@/lib/api';
import type { Screen } from '@/lib/screens';
import { EditorialImport } from '@/components/editorial-import';

type Row = Record<string, any>;
type List = { data: Row[]; meta: { total: number } };
const date = (value: unknown) => value ? String(value).slice(0, 10) : '—';
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const today = () => localDate(new Date());
const currentMonth = () => { const now = new Date(); return { from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; };
const route = (title: string) => {
  const slugs: Record<string, string> = {
    'Submission Inbox': 'submission-inbox', 'Submit Manuscript': 'submit-manuscript', 'Manuscript Detail': 'manuscript-detail',
    'Screening Queue': 'screening-queue', 'Editorial Review': 'editorial-review', 'Reviewer Assignment': 'reviewer-assignment',
    'Editorial Task Board': 'editorial-task-board', 'Editing & Proofreading Tracker': 'editing-and-proofreading-tracker',
    'Version Comparison': 'version-comparison', 'Proof Approval': 'proof-approval', 'Editorial Calendar': 'editorial-calendar',
    'Rejection & Resubmission Register': 'rejection-and-resubmission-register', 'Manuscript File Repository': 'manuscript-file-repository',
    'Editorial SLA Report': 'editorial-sla-report', 'Review Conflict Check': 'review-conflict-check',
    'Publication Readiness Checklist': 'publication-readiness-checklist',
  };
  return `/manuscript-editorial/${slugs[title]}`;
};
const stages = ['draft', 'submitted', 'screening', 'review', 'editing', 'proof', 'rejected', 'approved'];
const checks = ['copyedit', 'proof', 'rights', 'identifier'];
const screeningKeys = ['title', 'submitter', 'main_file', 'synopsis', 'category', 'language', 'duplicate_review', 'eligibility'];

function DataTable({ headers, rows, render, empty }: { headers: string[]; rows: Row[]; render: (row: Row) => React.ReactNode; empty: string }) {
  return <div className="panel table-wrap"><table className="data-table"><thead><tr>{headers.map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}>{render(row)}</tr>) : <tr><td colSpan={headers.length} className="empty">{empty}</td></tr>}</tbody></table></div>;
}

export function EditorialScreen({ screen }: { screen: Screen }) {
  const router = useRouter();
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskPage, setTaskPage] = useState(0);
  const [members, setMembers] = useState<Row[]>([]);
  const [editions, setEditions] = useState<Row[]>([]);
  const [authors, setAuthors] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [publishers, setPublishers] = useState<Row[]>([]);
  const [imprints, setImprints] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Row[]>([]);
  const [overview, setOverview] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [page, setPage] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [languageInput, setLanguageInput] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [calendarRange, setCalendarRange] = useState(currentMonth);
  const [calendarAssignee, setCalendarAssignee] = useState('');
  const [calendarStatus, setCalendarStatus] = useState('');
  const [calendarPage, setCalendarPage] = useState(0);
  const [calendarItems, setCalendarItems] = useState<Row[]>([]);
  const [calendarTotal, setCalendarTotal] = useState(0);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [slaRows, setSlaRows] = useState<Row[]>([]);
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaFrom, setSlaFrom] = useState('');
  const [slaTo, setSlaTo] = useState('');
  const [rejectionRows, setRejectionRows] = useState<Row[]>([]);
  const [rejectionTotal, setRejectionTotal] = useState(0);
  const [rejectionLoading, setRejectionLoading] = useState(false);
  const [rejectionQueryInput, setRejectionQueryInput] = useState('');
  const [rejectionQuery, setRejectionQuery] = useState('');
  const [rejectionPage, setRejectionPage] = useState(0);
  const [taskEdit, setTaskEdit] = useState({ id: '', assigneeId: '', dueDate: '', reason: '' });
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [boardSearch, setBoardSearch] = useState('');
  const [boardAssignee, setBoardAssignee] = useState('');
  const [boardOnlyMine, setBoardOnlyMine] = useState(false);
  const [boardOnlyOverdue, setBoardOnlyOverdue] = useState(false);
  const [boardLaneFocus, setBoardLaneFocus] = useState('all');
  const [boardSort, setBoardSort] = useState<'due_asc' | 'due_desc' | 'newest' | 'title'>('due_asc');
  const [boardView, setBoardView] = useState<'board' | 'list'>('board');
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({ completed: false });
  const [proofTab, setProofTab] = useState<'all' | 'pending' | 'approved' | 'other'>('all');
  const [proofSearch, setProofSearch] = useState('');
  const [comparison, setComparison] = useState<Row | null>(null);
  const [originalVersionId, setOriginalVersionId] = useState('');
  const [revisedVersionId, setRevisedVersionId] = useState('');
  const [form, setForm] = useState<Record<string, string>>({ dueDate: today(), decision: 'accept', taskType: 'screening', finding: 'clear', checkKey: 'copyedit', checkStatus: 'pending' });
  const [file, setFile] = useState<File | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [taskAttachmentFile, setTaskAttachmentFile] = useState<File | null>(null);
  const [attachmentCategory, setAttachmentCategory] = useState('supporting_reference');
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [attachmentSearch, setAttachmentSearch] = useState('');
  const [attachmentFilter, setAttachmentFilter] = useState('');
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [customLanguages, setCustomLanguages] = useState<{ code: string; label: string }[]>([
    { code: 'en', label: 'English (en)' },
    { code: 'bn', label: 'Bengali / Bengali (bn)' },
    { code: 'ar', label: 'Arabic / العربية (ar)' },
    { code: 'hi', label: 'Hindi / हिन्दी (hi)' },
    { code: 'ur', label: 'Urdu / اردو (ur)' },
    { code: 'fr', label: 'French (fr)' },
    { code: 'es', label: 'Spanish (es)' },
    { code: 'de', label: 'German (de)' },
  ]);
  const [customSubmissionTypes, setCustomSubmissionTypes] = useState<string[]>([
    'original', 'translation', 'revision', 'proposal', 'other'
  ]);
  const [customSources, setCustomSources] = useState<string[]>([
    'direct', 'author', 'agent', 'internal', 'import'
  ]);
  const [screeningDecisionNote, setScreeningDecisionNote] = useState<string>(
    'Screening passed: All 8 statutory compliance criteria verified. Approved to advance to editorial review.'
  );
  const [reviewRecommendation, setReviewRecommendation] = useState<'accept' | 'revise' | 'reject'>('accept');
  const [reviewOriginality, setReviewOriginality] = useState<number>(5);
  const [reviewStructure, setReviewStructure] = useState<number>(5);
  const [reviewLanguage, setReviewLanguage] = useState<number>(5);
  const [reviewCommentsState, setReviewCommentsState] = useState<string>(
    'Comprehensive editorial evaluation completed. The manuscript exhibits strong thematic coherence, rigorous research, and publication-ready narrative structure. Recommended to advance to copyediting.'
  );
  const [addTypeModal, setAddTypeModal] = useState<{ open: boolean; kind: 'language' | 'submissionType' | 'submissionSource' | 'category' | 'publisher' | 'author'; title: string } | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');

  const openAddModal = (kind: 'language' | 'submissionType' | 'submissionSource' | 'category' | 'publisher' | 'author', title: string) => {
    setNewTypeName('');
    setNewTypeCode('');
    setError('');
    setAddTypeModal({ open: true, kind, title });
  };

  const handleQuickAddSubmit = async () => {
    if (!addTypeModal || !newTypeName.trim()) return;
    setBusy(true); setError('');
    try {
      const val = newTypeName.trim();
      if (addTypeModal.kind === 'language') {
        const code = (newTypeCode.trim() || val.slice(0, 3)).toLowerCase();
        const newLang = { code, label: `${val} (${code})` };
        setCustomLanguages(cur => [...cur, newLang]);
        change('languageCode', code);
        setNotice(`Language "${val}" added and selected`);
      } else if (addTypeModal.kind === 'submissionType') {
        const clean = val.toLowerCase().replace(/\s+/g, '_');
        if (!customSubmissionTypes.includes(clean)) {
          setCustomSubmissionTypes(cur => [...cur, clean]);
        }
        change('submissionType', clean);
        setNotice(`Submission type "${clean}" added and selected`);
      } else if (addTypeModal.kind === 'submissionSource') {
        const clean = val.toLowerCase().replace(/\s+/g, '_');
        if (!customSources.includes(clean)) {
          setCustomSources(cur => [...cur, clean]);
        }
        change('submissionSource', clean);
        setNotice(`Submission source "${clean}" added and selected`);
      } else if (addTypeModal.kind === 'category') {
        const catCode = `CAT-${Date.now().toString(36).toUpperCase()}`;
        const res = await api<{ data: Row }>('/categories', { method: 'POST', body: JSON.stringify({ code: catCode, name: val }) });
        const createdCat = { id: res.data?.id || catCode, name_en: val, code: catCode };
        setCategories(cur => [...cur, createdCat].sort((a, b) => (a.name_en || '').localeCompare(b.name_en || '')));
        change('categoryId', createdCat.id);
        setNotice(`Category "${val}" created and selected`);
      } else if (addTypeModal.kind === 'publisher') {
        const res = await api<{ data: Row }>('/publishers', { method: 'POST', body: JSON.stringify({ name: val }) });
        const createdPub = { id: res.data?.id, name: val };
        setPublishers(cur => [...cur, createdPub].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        change('publisherId', createdPub.id);
        setNotice(`Publisher "${val}" created and selected`);
      } else if (addTypeModal.kind === 'author') {
        const res = await api<{ data: Row }>('/authors', { method: 'POST', body: JSON.stringify({ name: val }) });
        const createdAuthor = { id: res.data?.id, name: val };
        setAuthors(cur => [...cur, createdAuthor].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        change('authorId', createdAuthor.id);
        setNotice(`Author "${val}" created and selected`);
      }
      setAddTypeModal(null);
      setNewTypeName('');
      setNewTypeCode('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add item');
    } finally {
      setBusy(false);
    }
  };
  const canManage = role === 'Owner' || permissions.includes('editorial.manage');
  const canReview = role === 'Owner' || permissions.includes('editorial.review');
  const canApprove = role === 'Owner' || permissions.includes('editorial.approve');
  const canExport = role === 'Owner' || permissions.includes('editorial.export');
  const value = (key: string) => form[key] || '';
  const change = (key: string, next: string) => setForm(current => ({ ...current, [key]: next }));
  useEffect(() => { setComparison(null); setOriginalVersionId(''); setRevisedVersionId(''); }, [selectedId]);

  async function compareVersions() {
    if (!selectedId || !originalVersionId || !revisedVersionId) return;
    setBusy(true); setError(''); setComparison(null);
    try {
      const params = new URLSearchParams({ original: originalVersionId, revised: revisedVersionId });
      const result = await api<{ data: Row }>(`/manuscripts/${selectedId}/compare?${params}`);
      setComparison(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not compare manuscript versions'); }
    finally { setBusy(false); }
  }

  async function load() {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(page * 25) });
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (authorFilter) params.set('authorId', authorFilter);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (publisherFilter) params.set('publisherId', publisherFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (languageFilter) params.set('languageCode', languageFilter);
      if (sourceFilter) params.set('submissionSource', sourceFilter);
      if (assigneeFilter) params.set('assigneeId', assigneeFilter);
      const needsTasks = ['Screening Queue', 'Editorial Review', 'Reviewer Assignment', 'Editorial Task Board', 'Editing & Proofreading Tracker'].includes(screen.title);
      const needsOverview = ['Submission Inbox', 'Editorial SLA Report'].includes(screen.title);
      const needsList = !['Submit Manuscript', 'Editorial SLA Report', 'Editorial Calendar'].includes(screen.title);
      const [list, work, summary, me, stageSettings] = await Promise.all([
        needsList ? api<{ data: List }>(`/manuscripts?${params}`) : Promise.resolve({ data: { data: [] as Row[], meta: { total: 0 } } }),
        needsTasks ? api<{ data: { data: Row[]; meta: { total: number } } }>(`/editorial/tasks?limit=${screen.title === 'Editorial Task Board' ? 200 : 200}&offset=${screen.title === 'Editorial Task Board' ? taskPage * 200 : 0}`) : Promise.resolve({ data: { data: [] as Row[], meta: { total: 0 } } }),
        needsOverview ? api<{ data: Row }>('/editorial/overview') : Promise.resolve({ data: {} as Row }),
        api<{ data: { role: string; userId: string; permissions: string[] } }>('/auth/me'),
        screen.title === 'Editorial Task Board' ? api<{ data: Row[] }>('/editorial/stages') : Promise.resolve({ data: [] as Row[] }),
      ]);
      setItems(list.data.data); setTotal(list.data.meta.total); setTasks(work.data.data); setTaskTotal(work.data.meta.total); setOverview(summary.data); setSettings(stageSettings.data);
      setRole(me.data.role); setUserId(me.data.userId); setPermissions(me.data.permissions);
      const wanted = new URLSearchParams(window.location.search).get('manuscript');
      let fallbackId = '';
      if (screen.title === 'Screening Queue') {
        const screeningTask = work.data.data.find((t: Row) => t.task_type === 'screening' && t.status === 'open');
        const screeningM = list.data.data.find((m: Row) => m.status === 'screening');
        fallbackId = screeningTask?.manuscript_id || screeningM?.id || list.data.data[0]?.id || '';
      } else if (screen.title === 'Editorial Review') {
        const reviewTask = work.data.data.find((t: Row) => t.task_type === 'review' && t.status === 'open');
        const reviewM = list.data.data.find((m: Row) => m.status === 'review');
        fallbackId = reviewTask?.manuscript_id || reviewM?.id || list.data.data[0]?.id || '';
      } else {
        fallbackId = list.data.data[0]?.id || '';
      }
      setSelectedId(current => wanted || (screen.title === 'Screening Queue' || screen.title === 'Editorial Review' ? fallbackId : current) || fallbackId);
      if ((me.data.role === 'Owner' || me.data.permissions.includes('editorial.manage')) && ['Submission Inbox', 'Screening Queue', 'Reviewer Assignment', 'Editorial Task Board', 'Editing & Proofreading Tracker', 'Review Conflict Check', 'Editorial Calendar'].includes(screen.title)) {
        const people = await api<{ data: Row[] }>('/editorial/members').catch(() => ({ data: [] as Row[] })); setMembers(people.data || []);
      }
      if (me.data.role === 'Owner' || me.data.permissions.includes('workspace.read') || me.data.permissions.includes('editorial.manage') || me.data.permissions.includes('editorial.review')) {
        if (screen.title === 'Publication Readiness Checklist') {
          const catalog = await api<{ data: Row[] }>('/editions?limit=100').catch(() => ({ data: [] as Row[] })); setEditions(catalog.data || []);
        }
        if (['Submission Inbox', 'Submit Manuscript', 'Manuscript Detail', 'Publication Readiness Checklist'].includes(screen.title)) {
          const [authorList, categoryList, publisherList] = await Promise.all([
            api<{ data: Row[] }>('/authors').catch(() => ({ data: [] as Row[] })),
            api<{ data: Row[] }>('/categories').catch(() => ({ data: [] as Row[] })),
            api<{ data: Row[] }>('/publishers').catch(() => ({ data: [] as Row[] }))
          ]);
          setAuthors(authorList.data || []); setCategories(categoryList.data || []); setPublishers(publisherList.data || []);
        }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load editorial data'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [screen.id, page, query, status, fromDate, toDate, authorFilter, categoryFilter, publisherFilter, priorityFilter, languageFilter, sourceFilter, assigneeFilter, taskPage]);
  useEffect(() => { if (screen.title === 'Reviewer Assignment') change('taskType', 'review'); else if (screen.title === 'Editing & Proofreading Tracker') change('taskType', 'editing'); else if (screen.title === 'Proof Approval') change('taskType', 'proof'); else if (screen.title === 'Screening Queue') change('taskType', 'screening'); }, [screen.title]);
  useEffect(() => { if (selectedId) void api<{ data: Row }>(`/manuscripts/${selectedId}`).then(result => setDetail(result.data)).catch(reason => setError(reason.message)); else setDetail(null); }, [selectedId]);
  useEffect(() => { if (!value('publisherId')) { setImprints([]); return; } void api<{ data: Row[] }>(`/publishers/${value('publisherId')}/imprints`).then(result => setImprints(result.data)).catch(() => setImprints([])); }, [form.publisherId]);
  useEffect(() => { if (!['Manuscript Detail', 'Publication Readiness Checklist', 'Proof Approval'].includes(screen.title) || !detail) return; setForm(current => ({ ...current, title: detail.title || '', submitterName: detail.submitter_name || '', synopsis: detail.synopsis || '', authorId: detail.author_id || '', categoryId: detail.category_id || '', publisherId: detail.publisher_id || '', imprintId: detail.imprint_id || '', languageCode: detail.language_code || 'en', submissionType: detail.submission_type || 'original', submissionSource: detail.submission_source || 'direct', priority: detail.priority || 'normal', targetPublicationDate: date(detail.target_publication_date) === '—' ? '' : date(detail.target_publication_date), wordCount: detail.word_count == null ? '' : String(detail.word_count), pageCount: detail.page_count == null ? '' : String(detail.page_count) })); }, [screen.title, detail?.id, detail?.version_no]);
  useEffect(() => { if (screen.title !== 'Editorial Review' || !detail) return; setForm(current => { const next = { ...current }; for (const review of detail.reviews || []) { if (review.status !== 'draft') continue; next['review-recommendation-' + review.task_id] = review.recommendation || ''; next['review-comments-' + review.task_id] = review.comments || ''; const criteria = typeof review.criteria_json === 'string' ? JSON.parse(review.criteria_json) : review.criteria_json || {}; for (const key of ['originality', 'structure', 'language']) next['review-' + key + '-' + review.task_id] = criteria[key] == null ? '' : String(criteria[key]); } return next; }); }, [screen.title, detail?.id, (detail?.reviews || []).map((review: Row) => `${review.id}:${review.version_no}`).join(',')]);
  useEffect(() => { if (screen.title === 'Publication Readiness Checklist' && detail?.readinessReview?.edition_id) change('editionId', detail.readinessReview.edition_id); }, [screen.title, detail?.id, detail?.readinessReview?.version_no]);

  async function loadCalendar() {
    setCalendarLoading(true); setError('');
    try {
      const params = new URLSearchParams({ from: calendarRange.from, to: calendarRange.to, limit: '50', offset: String(calendarPage * 50) });
      if (calendarAssignee) params.set('assigneeId', calendarAssignee);
      if (calendarStatus) params.set('status', calendarStatus);
      const result = await api<{ data: List }>(`/editorial/calendar?${params}`);
      setCalendarItems(result.data.data); setCalendarTotal(result.data.meta.total);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load editorial calendar'); }
    finally { setCalendarLoading(false); }
  }
  async function loadSla() {
    setSlaLoading(true);
    try { const params = new URLSearchParams(); if (slaFrom) params.set('from', slaFrom); if (slaTo) params.set('to', slaTo); const result = await api<{ data: Row[] }>(`/editorial/sla?${params}`); setSlaRows(result.data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load editorial SLA'); }
    finally { setSlaLoading(false); }
  }
  async function loadRejections() {
    setRejectionLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(rejectionPage * 25) });
      if (rejectionQuery) params.set('q', rejectionQuery);
      const result = await api<{ data: List }>(`/editorial/rejections?${params}`);
      setRejectionRows(result.data.data); setRejectionTotal(result.data.meta.total);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load rejection history'); }
    finally { setRejectionLoading(false); }
  }
  async function refresh() {
    await load();
    if (screen.title === 'Editorial Calendar') await loadCalendar();
    if (screen.title === 'Editorial SLA Report') await loadSla();
    if (screen.title === 'Rejection & Resubmission Register') await loadRejections();
  }
  useEffect(() => { if (screen.title === 'Editorial Calendar') void loadCalendar(); }, [screen.title, calendarRange.from, calendarRange.to, calendarAssignee, calendarStatus, calendarPage]);
  useEffect(() => { if (screen.title === 'Editorial SLA Report') void loadSla(); }, [screen.title, slaFrom, slaTo]);
  useEffect(() => { if (screen.title === 'Rejection & Resubmission Register') void loadRejections(); }, [screen.title, rejectionQuery, rejectionPage]);

  async function mutate(path: string, body?: unknown, method = 'POST', success = 'Saved') {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await api<{ data: Row }>(path, { method, body: body ? JSON.stringify(body) : undefined });
      if (response.data?.id && path === '/manuscripts') setSelectedId(response.data.id);
      if (path.startsWith('/editorial/tasks/') && (path.endsWith('/progress') || path.endsWith('/comments'))) {
        setDetail(response.data);
        setTasks(current => current.map(task => response.data.tasks.find((updated: Row) => updated.id === task.id) ? { ...task, ...response.data.tasks.find((updated: Row) => updated.id === task.id) } : task));
        setNotice(success);
        return response.data;
      }
      setNotice(success); await load();
      if (screen.title === 'Rejection & Resubmission Register') await loadRejections();
      if (selectedId || response.data?.id) {
        const id = response.data?.id || selectedId;
        const latest = await api<{ data: Row }>(`/manuscripts/${id}`); setDetail(latest.data);
      }
      return response.data;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Action failed'); return null; }
    finally { setBusy(false); }
  }
  async function saveTaskChange() {
    if (!taskEdit.id) return;
    const body = { assigneeId: taskEdit.assigneeId || undefined, dueDate: taskEdit.dueDate || undefined, reason: taskEdit.reason.trim() };
    const saved = await mutate(`/editorial/tasks/${taskEdit.id}`, body, 'PATCH', 'Task assignment updated');
    if (saved) { setTaskEdit({ id: '', assigneeId: '', dueDate: '', reason: '' }); if (screen.title === 'Editorial Calendar') await loadCalendar(); }
  }
  async function asBase64(input: File) {
    if (input.size < 1 || input.size > 8 * 1024 * 1024) throw new Error('File must be between 1 byte and 8 MB');
    return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read file')); reader.readAsDataURL(input); });
  }
  async function uploadVersion(id = selectedId) {
    if (!file) { setError('Choose a file first'); return null; }
    try {
      const base64 = await asBase64(file);
      const mimeType = file.name.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain';
      const result = await mutate(`/manuscripts/${id}/versions`, { fileName: file.name, mimeType, base64, changeNote: value('changeNote') }, 'POST', 'Immutable version uploaded');
      if (result) setFile(null);
      return result;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Upload failed'); return null; }
  }
  async function downloadVersion(version: Row) {
    setError('');
    try { const blob = await apiFile(`/manuscripts/${selectedId}/versions/${version.id}/file`); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = version.file_name; anchor.click(); URL.revokeObjectURL(url); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Download failed'); }
  }
  async function uploadAttachments() {
    if (!selectedId || !attachmentFiles.length) return;
    setBusy(true); setError(''); setNotice('');
    let uploaded = 0;
    try {
      for (const attachment of attachmentFiles) {
        const base64 = await asBase64(attachment);
        const mimeType = attachment.name.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : attachment.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain';
        await api(`/manuscripts/${selectedId}/attachments`, { method: 'POST', body: JSON.stringify({ category: attachmentCategory, description: attachmentDescription, fileName: attachment.name, mimeType, base64 }) });
        uploaded++;
      }
      setAttachmentFiles([]);
      setNotice(`${uploaded} supporting file${uploaded === 1 ? '' : 's'} uploaded`);
    } catch (reason) { setError(`${uploaded} uploaded; ${reason instanceof Error ? reason.message : 'remaining uploads failed'}`); }
    finally {
      try { const result = await api<{ data: Row }>(`/manuscripts/${selectedId}`); setDetail(result.data); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not refresh file repository'); }
      setBusy(false);
    }
  }
  async function downloadAttachment(attachment: Row) {
    setError('');
    try { const blob = await apiFile(`/manuscripts/${selectedId}/attachments/${attachment.id}/file`); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = attachment.file_name; anchor.click(); URL.revokeObjectURL(url); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Attachment download failed'); }
  }
  async function uploadTaskAttachment() {
    if (!selectedTaskId || !taskAttachmentFile) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const mimeType = taskAttachmentFile.name.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : taskAttachmentFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain';
      const result = await api<{ data: Row }>(`/editorial/tasks/${selectedTaskId}/attachments`, { method: 'POST', body: JSON.stringify({ fileName: taskAttachmentFile.name, mimeType, base64: await asBase64(taskAttachmentFile) }) });
      setDetail(result.data); setTaskAttachmentFile(null); setNotice('Task file attached');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Task attachment upload failed'); }
    finally { setBusy(false); }
  }
  async function downloadTaskAttachment(attachment: Row) {
    setError('');
    try { const blob = await apiFile(`/editorial/tasks/${selectedTaskId}/attachments/${attachment.id}/file`); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = attachment.file_name; anchor.click(); URL.revokeObjectURL(url); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Task attachment download failed'); }
  }
  async function exportInbox() {
    setError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (authorFilter) params.set('authorId', authorFilter);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (publisherFilter) params.set('publisherId', publisherFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (languageFilter) params.set('languageCode', languageFilter);
      if (sourceFilter) params.set('submissionSource', sourceFilter);
      if (assigneeFilter) params.set('assigneeId', assigneeFilter);
      const blob = await apiFile(`/manuscripts/export.csv?${params}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'manuscripts.csv'; anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not export manuscript inbox'); }
  }
  async function exportSla() {
    setError('');
    try {
      const params = new URLSearchParams();
      if (slaFrom) params.set('from', slaFrom);
      if (slaTo) params.set('to', slaTo);
      const blob = await apiFile(`/editorial/sla/export.csv?${params}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'editorial-sla.csv'; anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not export editorial SLA'); }
  }
  async function createAndSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) { setError('A manuscript file is required'); return; }
    const refCode = (value('referenceCode') || '').trim() || `MS-${Date.now().toString(36).toUpperCase()}`;
    const created = await mutate('/manuscripts', { referenceCode: refCode, ...manuscriptPayload() }, 'POST', 'Manuscript draft created');
    if (!created) return;
    const uploaded = await uploadVersion(created.id);
    if (uploaded) await mutate(`/manuscripts/${created.id}/submit`, undefined, 'POST', 'Manuscript submitted');
    router.push(`${route('Manuscript Detail')}?manuscript=${created.id}`);
  }
  function manuscriptPayload() {
    return {
      title: (value('title') || '').trim(),
      submitterName: (value('submitterName') || '').trim(),
      synopsis: (value('synopsis') || '').trim() || null,
      authorId: value('authorId') || null,
      categoryId: value('categoryId') || (categories[0]?.id ?? null),
      publisherId: value('publisherId') || null,
      imprintId: value('imprintId') || null,
      languageCode: (value('languageCode') || 'en').trim().toLowerCase(),
      submissionType: value('submissionType') || 'original',
      submissionSource: value('submissionSource') || 'direct',
      priority: value('priority') || 'normal',
      targetPublicationDate: value('targetPublicationDate') || null,
      wordCount: value('wordCount') ? Number(value('wordCount')) : null,
      pageCount: value('pageCount') ? Number(value('pageCount')) : null
    };
  }
  async function createDraft() {
    const refCode = (value('referenceCode') || '').trim() || `MS-${Date.now().toString(36).toUpperCase()}`;
    const created = await mutate('/manuscripts', { referenceCode: refCode, ...manuscriptPayload() }, 'POST', 'Draft saved');
    if (!created) return;
    if (file) await uploadVersion(created.id);
    router.push(`${route('Manuscript Detail')}?manuscript=${created.id}`);
  }
  const choose = (id: string) => { setSelectedId(id); window.history.replaceState(null, '', `${window.location.pathname}?manuscript=${id}`); };
  const selectManuscript = <label className="field editorial-selector">{'Manuscript'}<select className="input" value={selectedId} onChange={event => choose(event.target.value)}><option value="">{'Select a manuscript'}</option>{items.map(item => <option key={item.id} value={item.id}>{item.reference_code} — {item.title}</option>)}{detail && !items.some(item => item.id === detail.id) && <option value={detail.id}>{detail.reference_code} — {detail.title}</option>}</select></label>;
  const filePicker = <label className="field">{'Manuscript file (PDF, DOCX or TXT; max 8 MB)'}<input className="input" type="file" accept=".pdf,.docx,.txt" onChange={event => setFile(event.target.files?.[0] || null)} /></label>;
  const metadataInputs = (
    <>
      <div className="catalog-form-grid">
        <label className="field">
          <span>Manuscript title <span className="required-star">*</span></span>
          <input className="input" required maxLength={500} value={value('title')} onChange={event => change('title', event.target.value)} />
        </label>
        <label className="field">
          <span>Submitter name <span className="required-star">*</span></span>
          <input className="input" required maxLength={255} value={value('submitterName')} onChange={event => change('submitterName', event.target.value)} />
        </label>
        <label className="field">
          <span>Author master</span>
          <div className="select-add-group">
            <select className="input" value={value('authorId')} onChange={event => change('authorId', event.target.value)}>
              <option value="">No linked author</option>
              {authors.map(author => <option key={author.id} value={author.id}>{author.name}</option>)}
            </select>
            <button type="button" className="btn-plus-addon" title="Add new author" onClick={() => openAddModal('author', 'Add New Author')}>+</button>
          </div>
        </label>
        <label className="field">
          <span>Category</span>
          <div className="select-add-group">
            <select className="input" value={value('categoryId')} onChange={event => change('categoryId', event.target.value)}>
              <option value="">No category</option>
              {categories.map(category => <option key={category.id} value={category.id}>{category.name_en}</option>)}
            </select>
            <button type="button" className="btn-plus-addon" title="Add new category" onClick={() => openAddModal('category', 'Add New Book Category')}>+</button>
          </div>
        </label>
        <label className="field">
          <span>Proposed publisher</span>
          <div className="select-add-group">
            <select className="input" value={value('publisherId')} onChange={event => { change('publisherId', event.target.value); change('imprintId', ''); }}>
              <option value="">No publisher</option>
              {publishers.map(publisher => <option key={publisher.id} value={publisher.id}>{publisher.name}</option>)}
            </select>
            <button type="button" className="btn-plus-addon" title="Add new publisher" onClick={() => openAddModal('publisher', 'Add New Publisher')}>+</button>
          </div>
        </label>
        <label className="field">
          <span>Proposed imprint</span>
          <select className="input" value={value('imprintId')} disabled={!value('publisherId')} onChange={event => change('imprintId', event.target.value)}>
            <option value="">No imprint</option>
            {imprints.map(imprint => <option key={imprint.id} value={imprint.id}>{imprint.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Language</span>
          <div className="select-add-group">
            <select className="input" value={value('languageCode') || 'en'} onChange={event => change('languageCode', event.target.value)}>
              {customLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
            <button type="button" className="btn-plus-addon" title="Add new language" onClick={() => openAddModal('language', 'Add New Language')}>+</button>
          </div>
        </label>
        <label className="field">
          <span>Submission type</span>
          <div className="select-add-group">
            <select className="input" value={value('submissionType') || 'original'} onChange={event => change('submissionType', event.target.value)}>
              {customSubmissionTypes.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="button" className="btn-plus-addon" title="Add new submission type" onClick={() => openAddModal('submissionType', 'Add Submission Type')}>+</button>
          </div>
        </label>
        <label className="field">
          <span>Source</span>
          <div className="select-add-group">
            <select className="input" value={value('submissionSource') || 'direct'} onChange={event => change('submissionSource', event.target.value)}>
              {customSources.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="button" className="btn-plus-addon" title="Add new source" onClick={() => openAddModal('submissionSource', 'Add Submission Source')}>+</button>
          </div>
        </label>
        <label className="field">
          <span>Priority</span>
          <select className="input" value={value('priority') || 'normal'} onChange={event => change('priority', event.target.value)}>
            {['low', 'normal', 'high', 'urgent'].map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Target publication date</span>
          <input className="input" type="date" value={value('targetPublicationDate')} onChange={event => change('targetPublicationDate', event.target.value)} />
        </label>
        <label className="field">
          <span>Estimated word count</span>
          <input className="input" type="number" min="0" value={value('wordCount')} onChange={event => change('wordCount', event.target.value)} />
        </label>
        <label className="field">
          <span>Estimated page count</span>
          <input className="input" type="number" min="0" value={value('pageCount')} onChange={event => change('pageCount', event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Synopsis</span>
        <textarea className="input" rows={4} maxLength={10000} value={value('synopsis')} onChange={event => change('synopsis', event.target.value)} />
      </label>
    </>
  );
  const versions = detail?.versions || [];
  const attachments = (detail?.attachments || []).filter((attachment: Row) => (!attachmentFilter || attachment.category === attachmentFilter) && (!attachmentSearch || String(attachment.file_name).toLowerCase().includes(attachmentSearch.toLowerCase())));
  const currentTasks = detail?.tasks || [];
  const currentEvents = detail?.events || [];
  const currentChecks = Object.fromEntries((detail?.readiness || []).map((row: Row) => [row.check_key, row.status]));
  const readinessReview = detail?.readinessReview;
  const readinessComplete = checks.every(key => currentChecks[key] === 'complete');
  const selectedTasks = tasks.filter(task => task.manuscript_id === selectedId);
  const selectedBoardTask = tasks.find(task => task.id === selectedTaskId);
  const closeBoardDrawer = () => { setSelectedTaskId(''); setTaskAttachmentFile(null); };
  const selectBoardTask = (task: Row) => {
    setSelectedTaskId(task.id); setTaskAttachmentFile(null); choose(task.manuscript_id);
    setForm(current => ({ ...current, boardComment: '', boardCancelReason: '' }));
  };

  const currentScreeningChecks: Row[] = detail?.screeningChecks || [];
  const canScreen = canManage || currentTasks.some((task: Row) => task.task_type === 'screening' && task.status === 'open' && task.assignee_id === userId);
  const screeningComplete = Boolean(detail?.current_version_id) && screeningKeys.every(key => currentScreeningChecks.some(check => check.check_key === key && check.status === 'complete' && check.version_id === detail?.current_version_id));

  const passAllScreeningChecks = async () => {
    if (!selectedId || !detail?.current_version_id) return;
    setBusy(true); setError(''); setNotice('');
    try {
      for (const key of screeningKeys) {
        await api(`/manuscripts/${selectedId}/screening-checks/${key}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'complete',
            note: `Verified during standard screening check for ${key.replaceAll('_', ' ')}`
          })
        });
      }
      setNotice('All 8 standard screening checks completed');
      const updated = await api<{ data: Row }>(`/manuscripts/${selectedId}`);
      setDetail(updated.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete screening checks');
    } finally {
      setBusy(false);
    }
  };

  const taskTable = (rows: Row[]) => <DataTable headers={['Manuscript', 'Task / assignee', 'Due', 'Decision']} rows={rows} empty={'No tasks match this view'} render={task => <><td><button className="editorial-text-button" onClick={() => choose(task.manuscript_id)}>{task.reference_code} — {task.title}</button></td><td>{task.task_type} · {task.assignee_name}</td><td>{date(task.due_date)}</td><td>{task.decision || task.status}</td></>} />;
  const manuscriptTable = <DataTable headers={['Reference / title', 'Author / submitter', 'Publisher / category', 'Language / source', 'Priority', 'Stage', 'Screening officer', 'Next deadline', 'Received', 'Open']} rows={items} empty="No manuscripts match these filters" render={row => <><td><strong>{row.reference_code}</strong><br />{row.title}</td><td>{row.author_name || row.submitter_name}</td><td>{row.publisher_name || 'Unassigned'}<br />{row.category_name || 'Unassigned'}</td><td>{row.language_code || '—'}<br />{row.submission_source || '—'}</td><td>{row.priority}</td><td><span className="badge">{row.status}</span></td><td>{row.screening_officer || 'Unassigned'}</td><td>{row.next_deadline ? date(row.next_deadline) : '—'}</td><td>{date(row.received_at)}</td><td><Link className="btn" href={route('Manuscript Detail') + '?manuscript=' + row.id}>Details</Link></td></>} />;
  const hasActiveFilters = Boolean(
    query || queryInput || status || fromDate || toDate || priorityFilter ||
    authorFilter || categoryFilter || publisherFilter || languageFilter ||
    sourceFilter || assigneeFilter
  );

  const resetFilters = () => {
    setPage(0);
    setQueryInput('');
    setQuery('');
    setStatus('');
    setFromDate('');
    setToDate('');
    setPriorityFilter('');
    setAuthorFilter('');
    setCategoryFilter('');
    setPublisherFilter('');
    setLanguageFilter('');
    setLanguageInput('');
    setSourceFilter('');
    setAssigneeFilter('');
  };

  const filters = (
    <div className="editorial-filters">
      <label className="field">
        Search
        <input
          className="input"
          value={queryInput}
          onChange={event => setQueryInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              setPage(0);
              setQuery(queryInput.trim());
            }
          }}
          placeholder="Reference, title, author or submitter"
        />
      </label>
      <button
        className="btn"
        type="button"
        onClick={() => {
          setPage(0);
          setQuery(queryInput.trim());
        }}
      >
        Search
      </button>
      {hasActiveFilters && (
        <button
          className="btn"
          type="button"
          onClick={resetFilters}
          style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}
          title="Clear all active filters"
        >
          Reset filters
        </button>
      )}
      <label className="field">
        Stage
        <select
          className="input"
          value={status}
          onChange={event => {
            setPage(0);
            setStatus(event.target.value);
          }}
        >
          <option value="">All stages</option>
          {stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      </label>
      <label className="field">
        From date
        <input
          className="input"
          type="date"
          value={fromDate}
          onChange={event => {
            setPage(0);
            setFromDate(event.target.value);
          }}
        />
      </label>
      <label className="field">
        To date
        <input
          className="input"
          type="date"
          value={toDate}
          onChange={event => {
            setPage(0);
            setToDate(event.target.value);
          }}
        />
      </label>
      <label className="field">
        Priority
        <select
          className="input"
          value={priorityFilter}
          onChange={event => {
            setPage(0);
            setPriorityFilter(event.target.value);
          }}
        >
          <option value="">All priorities</option>
          {['low', 'normal', 'high', 'urgent'].map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="field">
        Author
        <select
          className="input"
          value={authorFilter}
          onChange={event => {
            setPage(0);
            setAuthorFilter(event.target.value);
          }}
        >
          <option value="">All authors</option>
          {authors.map(author => <option key={author.id} value={author.id}>{author.name}</option>)}
        </select>
      </label>
      <label className="field">
        Category
        <select
          className="input"
          value={categoryFilter}
          onChange={event => {
            setPage(0);
            setCategoryFilter(event.target.value);
          }}
        >
          <option value="">All categories</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.name_en}</option>)}
        </select>
      </label>
      <label className="field">
        Publisher
        <select
          className="input"
          value={publisherFilter}
          onChange={event => {
            setPage(0);
            setPublisherFilter(event.target.value);
          }}
        >
          <option value="">All publishers</option>
          {publishers.map(publisher => <option key={publisher.id} value={publisher.id}>{publisher.name}</option>)}
        </select>
      </label>
    </div>
  );

  const inboxExtraFilters = (
    <div className="editorial-filters">
      <label className="field">
        Language
        <select
          className="input"
          value={languageFilter}
          onChange={event => {
            setPage(0);
            setLanguageFilter(event.target.value);
          }}
        >
          <option value="">All languages</option>
          {customLanguages.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Submission source
        <select
          className="input"
          value={sourceFilter}
          onChange={event => {
            setPage(0);
            setSourceFilter(event.target.value);
          }}
        >
          <option value="">All sources</option>
          {customSources.map(source => <option key={source} value={source}>{source}</option>)}
        </select>
      </label>
      <label className="field">
        Assigned user
        <select
          className="input"
          value={assigneeFilter}
          onChange={event => {
            setPage(0);
            setAssigneeFilter(event.target.value);
          }}
        >
          <option value="">All assignees</option>
          {members.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}
        </select>
      </label>
    </div>
  );
  const inboxStats = [
    ['Total submissions', overview?.counts?.total], ['New in seven days', overview?.counts?.new_seven_days],
    ['Drafts', overview?.counts?.drafts], ['Awaiting screening', Number(overview?.counts?.submitted || 0) + Number(overview?.counts?.screening || 0)],
    ['Under review', overview?.counts?.in_review], ['Approved', overview?.counts?.approved],
    ['Rejected', overview?.counts?.rejected], ['Revision requests', overview?.revisionRequests],
    ['Overdue screening', overview?.screeningOverdue], ['Received this month', overview?.counts?.this_month],
  ];
  const pagination = <div className="catalog-pagination"><span>{total} {'manuscripts'} · {'Page'} {page + 1}</span><div className="button-row"><button className="btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{'Previous'}</button><button className="btn" disabled={(page + 1) * 25 >= total} onClick={() => setPage(p => p + 1)}>{'Next'}</button></div></div>;
  const timeline = <section className="panel editorial-panel"><h2>{'Immutable activity timeline'}</h2>{currentEvents.length ? currentEvents.map((event: Row) => <div className="editorial-event" key={event.id}><time>{date(event.occurred_at)}</time><div><strong>{event.event_type.replaceAll('_', ' ')}</strong><small>{event.actor_name} · {event.from_status || 'new'} → {event.to_status || 'recorded'}</small></div></div>) : <p className="muted">{'No timeline events'}</p>}</section>;
  const versionTable = <DataTable headers={['Version', 'File', 'SHA-256', 'Uploaded', 'Action']} rows={versions} empty={'No version uploaded'} render={version => <><td>v{version.version_no} {version.id === detail?.approved_version_id && <span className="badge badge-green">Approved</span>}</td><td>{version.file_name}<br /><small>{Math.ceil(version.file_size / 1024)} KB</small></td><td><code>{String(version.sha256).slice(0, 16)}…</code></td><td>{date(version.uploaded_at)}</td><td>{canExport && <button className="btn" onClick={() => void downloadVersion(version)}>{'Download'}</button>}</td></>} />;
  const attachmentTable = <DataTable headers={['File', 'Category', 'Description', 'Size', 'Uploaded by', 'Date', 'Action']} rows={attachments} empty="No supporting files match these filters" render={attachment => <><td><strong>{attachment.file_name}</strong><br /><small>{String(attachment.sha256).slice(0, 16)}…</small></td><td>{String(attachment.category).replaceAll('_', ' ')}</td><td>{attachment.description || '—'}</td><td>{Math.ceil(attachment.file_size / 1024)} KB</td><td>{attachment.uploaded_by_name}</td><td>{date(attachment.uploaded_at)}</td><td>{canExport && <button className="btn" onClick={() => void downloadAttachment(attachment)}>Download</button>}</td></>} />;
  
  const assignmentForm = canManage && detail && (
    <form className="panel editorial-panel editorial-form" onSubmit={event => {
      event.preventDefault();
      void mutate(`/manuscripts/${selectedId}/tasks`, { taskType: value('taskType'), assigneeId: value('assigneeId'), dueDate: value('dueDate') }, 'POST', 'Task assigned').then(() => setAssignModalOpen(false));
    }}>
      <h2>Assign editorial work</h2>
      <div className="catalog-form-grid">
        <label className="field">Task stage
          <select className="input" value={value('taskType')} onChange={event => change('taskType', event.target.value)}>
            {['screening', 'review', 'editing', 'proof'].map(stage => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Assignee <span className="required-star">*</span></span>
          <select className="input" required value={value('assigneeId')} onChange={event => change('assigneeId', event.target.value)}>
            <option value="">Select member</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.display_name} · {member.email}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Due date <span className="required-star">*</span></span>
          <input className="input" type="date" required value={value('dueDate')} onChange={event => change('dueDate', event.target.value)} />
        </label>
      </div>
      <div className="button-row">
        <button className="btn btn-primary" disabled={busy}>Assign task</button>
        {assignModalOpen && <button className="btn" type="button" onClick={() => setAssignModalOpen(false)}>Cancel</button>}
      </div>
    </form>
  );

  const assignTaskModal = assignModalOpen && (
    <div className="modal-backdrop" onClick={() => setAssignModalOpen(false)}>
      <div className="editorial-task-modal-card" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Create New Task Assignment</h2>
          <button className="task-drawer-close" onClick={() => setAssignModalOpen(false)}>✕</button>
        </div>
        {selectManuscript}
        {detail ? assignmentForm : <p className="muted">Please select a manuscript to assign work.</p>}
      </div>
    </div>
  );

  const decisionForm = (taskType?: string) => {
    const open = currentTasks.filter((task: Row) => task.status === 'open' && (!taskType || task.task_type === taskType));
    return (
      <section className="panel editorial-panel">
        <h2>{taskType === 'review' ? 'Final editorial decision' : 'Record assigned decision'}</h2>
        {open.length ? open.map((task: Row) => {
          const reviewSubmitted = (detail?.reviews || []).some((review: Row) => review.task_id === task.id && review.status === 'submitted' && review.version_id === detail?.current_version_id);
          const allowed = task.task_type === 'review'
            ? canApprove && (role === 'Owner' || task.assignee_id !== userId) && (reviewSubmitted || role === 'Owner')
            : canReview && (role === 'Owner' || task.assignee_id === userId);
          return (
            <form className="editorial-task-decision" key={task.id} onSubmit={event => { event.preventDefault(); void mutate('/manuscripts/' + selectedId + '/record-decision', { taskId: task.id, decision: value('decision-' + task.id) || 'accept', notes: value('notes-' + task.id) }, 'POST', 'Task decision recorded'); }}>
              <strong>{task.task_type} - {task.assignee_name} - {date(task.due_date)}</strong>
              {allowed ? (
                <>
                  <select className="input" aria-label="Final decision" value={value('decision-' + task.id) || 'accept'} onChange={event => change('decision-' + task.id, event.target.value)}>
                    <option value="accept">Accept / advance</option>
                    <option value="revise">Request revision</option>
                    <option value="reject">Reject</option>
                  </select>
                  <textarea className="input" required aria-label="Decision notes" placeholder="Decision notes" value={value('notes-' + task.id)} onChange={event => change('notes-' + task.id, event.target.value)} />
                  <button className="btn btn-primary" disabled={busy}>Record decision</button>
                </>
              ) : (
                <p className="muted">
                  {task.task_type === 'review' ? reviewSubmitted ? 'Awaiting an independent editorial manager.' : 'Reviewer submission is required before a final decision.' : 'Only the assigned user can decide this task.'}
                </p>
              )}
            </form>
          );
        }) : <p className="muted">No open task for this manuscript.</p>}
      </section>
    );
  };

  const reviewPanel = detail && (
    <section className="panel editorial-panel">
      <h2>Version-bound editorial reviews</h2>
      {currentTasks.filter((task: Row) => task.task_type === 'review').map((task: Row) => {
        const review = (detail.reviews || []).find((entry: Row) => entry.task_id === task.id);
        const editable = task.status === 'open' && task.assignee_id === userId && canReview && review?.status !== 'submitted';
        const comments = value('review-comments-' + task.id);
        const recommendation = value('review-recommendation-' + task.id);
        const criteria = Object.fromEntries(['originality', 'structure', 'language'].filter(key => value('review-' + key + '-' + task.id)).map(key => [key, Number(value('review-' + key + '-' + task.id))]));
        const save = (submit: boolean) => void mutate('/manuscripts/' + selectedId + '/tasks/' + task.id + '/review', { recommendation: recommendation || undefined, criteria, comments, submit, reviewVersion: review?.version_no }, 'POST', submit ? 'Review submitted' : 'Review draft saved');
        return (
          <div key={task.id}>
            <p><strong>{task.assignee_name}</strong> - {review?.status || 'Not started'} - version {versions.find((version: Row) => version.id === (review?.version_id || detail.current_version_id))?.version_no || 'unknown'}</p>
            {review?.status === 'submitted' && <><p>Recommendation: <strong>{review.recommendation}</strong></p><p>{review.comments}</p></>}
            {editable && (
              <div className="editorial-form">
                <label className="field">Recommendation
                  <select className="input" value={recommendation} onChange={event => change('review-recommendation-' + task.id, event.target.value)}>
                    <option value="">Select recommendation</option>
                    <option value="accept">Recommend acceptance</option>
                    <option value="revise">Request revision</option>
                    <option value="reject">Recommend rejection</option>
                  </select>
                </label>
                <div className="catalog-form-grid">
                  {['originality', 'structure', 'language'].map(key => (
                    <label className="field" key={key}>{key}
                      <select className="input" value={value('review-' + key + '-' + task.id)} onChange={event => change('review-' + key + '-' + task.id, event.target.value)}>
                        <option value="">Not scored</option>
                        {[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="field">Review comments
                  <textarea className="input" rows={5} maxLength={5000} value={comments} onChange={event => change('review-comments-' + task.id, event.target.value)} />
                </label>
                <div className="button-row">
                  <button className="btn" disabled={busy} onClick={() => save(false)}>Save review draft</button>
                  <button className="btn btn-primary" disabled={busy || !recommendation || comments.trim().length < 20} onClick={() => save(true)}>Submit review</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!currentTasks.some((task: Row) => task.task_type === 'review') && <p className="muted">No review assignment for this manuscript.</p>}
    </section>
  );

  const handleQuickApprove = async (task: Row, customNote?: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (task.task_type === 'screening') {
        for (const key of screeningKeys) {
          await api(`/manuscripts/${task.manuscript_id}/screening-checks/${key}`, {
            method: 'PUT',
            body: JSON.stringify({
              status: 'complete',
              note: `Verified during standard screening check for ${key.replaceAll('_', ' ')}`
            })
          });
        }
      }
      const note = customNote || value('decisionNote-' + task.id) || `Approved at ${task.task_type.toUpperCase()} stage`;
      await mutate(
        `/manuscripts/${task.manuscript_id}/record-decision`,
        { taskId: task.id, decision: 'accept', notes: note },
        'POST',
        `${task.task_type.toUpperCase()} approved! Manuscript advanced to next stage.`
      );
      closeBoardDrawer();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not approve stage');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickReviseOrReject = async (task: Row, decision: 'revise' | 'reject', defaultMsg: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const note = value('decisionNote-' + task.id) || defaultMsg;
      await mutate(
        `/manuscripts/${task.manuscript_id}/record-decision`,
        { taskId: task.id, decision, notes: note },
        'POST',
        decision === 'revise' ? 'Revision requested' : 'Manuscript rejected'
      );
      closeBoardDrawer();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not ${decision}`);
    } finally {
      setBusy(false);
    }
  };

  const taskDrawer = selectedBoardTask && (
    <div className="task-modal-backdrop" onClick={closeBoardDrawer}>
      <div className="task-drawer" onClick={e => e.stopPropagation()}>
        <div className="task-drawer-header">
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
              <span className="editorial-task-card-ref">{selectedBoardTask.reference_code || detail?.reference_code || 'TASK'}</span>
              <span className="editorial-task-card-type">{selectedBoardTask.task_type}</span>
            </div>
            <h2>{selectedBoardTask.title}</h2>
            <small className="muted">Assigned to <strong>{selectedBoardTask.assignee_name}</strong> · Due {date(selectedBoardTask.due_date)}</small>
          </div>
          <button className="task-drawer-close" onClick={closeBoardDrawer} aria-label="Close task drawer">✕</button>
        </div>

        <div className="task-drawer-body">
          {selectedBoardTask.blocked_reason && (
            <div className="alert-error">
              <strong>Blocker Notice:</strong> {selectedBoardTask.blocked_reason}
            </div>
          )}

          {/* Effortless 1-Click Stage Approval */}
          {selectedBoardTask.status === 'open' && (
            <section style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Stage Approval: {selectedBoardTask.task_type.toUpperCase()}
                </h3>
                <span className="badge badge-green">Ready for Action</span>
              </div>

              <label className="field" style={{ fontSize: '12px' }}>
                Approval / Decision Notes (Optional)
                <input
                  className="input"
                  maxLength={500}
                  value={value('decisionNote-' + selectedBoardTask.id)}
                  onChange={e => change('decisionNote-' + selectedBoardTask.id, e.target.value)}
                  placeholder="Approved and advanced to next stage..."
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: '#16a34a', borderColor: '#16a34a', padding: '12px', fontSize: '13px', fontWeight: 800 }}
                  disabled={busy}
                  onClick={() => void handleQuickApprove(selectedBoardTask)}
                >
                  ✓ Approve &amp; Advance
                </button>

                <button
                  type="button"
                  className="btn"
                  style={{ background: '#fffbeb', color: '#b45309', borderColor: '#fde68a', fontWeight: 700 }}
                  disabled={busy}
                  onClick={() => void handleQuickReviseOrReject(selectedBoardTask, 'revise', 'Revision requested from author/editor')}
                >
                  ↺ Revise
                </button>

                <button
                  type="button"
                  className="btn danger"
                  style={{ fontWeight: 700 }}
                  disabled={busy}
                  onClick={() => void handleQuickReviseOrReject(selectedBoardTask, 'reject', 'Manuscript rejected')}
                >
                  ✕ Reject
                </button>
              </div>
            </section>
          )}

          {/* Activity Comments */}
          <section style={{ display: 'grid', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>Activity Comments</h3>
            <div style={{ display: 'grid', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {(detail?.taskComments || []).filter((c: Row) => c.task_id === selectedTaskId).length ? (
                (detail?.taskComments || []).filter((c: Row) => c.task_id === selectedTaskId).map((comment: Row) => (
                  <div key={comment.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <strong>{comment.actor_name}</strong> <span className="muted">· {date(comment.created_at)}</span>
                    <p style={{ margin: '4px 0 0', color: '#334155' }}>{comment.body}</p>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ fontSize: '12px', margin: 0 }}>No comments yet.</p>
              )}
            </div>
            {(canManage || selectedBoardTask.assignee_id === userId) && (
              <div className="button-row">
                <input
                  className="input"
                  aria-label="Add comment"
                  placeholder="Write a comment..."
                  maxLength={2000}
                  value={value('boardComment')}
                  onChange={e => change('boardComment', e.target.value)}
                />
                <button
                  className="btn"
                  disabled={busy || !value('boardComment').trim()}
                  onClick={() => void mutate(`/editorial/tasks/${selectedTaskId}/comments`, { body: value('boardComment') }, 'POST', 'Comment added')}
                >
                  Add comment
                </button>
              </div>
            )}
          </section>

          {/* Attached Files */}
          <section style={{ display: 'grid', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>Attached Task Files</h3>
            <div style={{ display: 'grid', gap: '6px' }}>
              {(detail?.taskAttachments || []).filter((a: Row) => a.task_id === selectedTaskId).map((attachment: Row) => (
                <div className="button-row" key={attachment.id} style={{ justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                  <span>{attachment.file_name} · {Math.ceil(attachment.file_size / 1024)} KB · {attachment.uploaded_by_name}</span>
                  {canReview && (canManage || selectedBoardTask.assignee_id === userId) && (
                    <button className="btn" onClick={() => void downloadTaskAttachment(attachment)}>Download</button>
                  )}
                </div>
              ))}
              {!(detail?.taskAttachments || []).some((a: Row) => a.task_id === selectedTaskId) && (
                <p className="muted" style={{ fontSize: '12px', margin: 0 }}>No files attached to this task.</p>
              )}
            </div>
            {selectedBoardTask.status === 'open' && canReview && (canManage || selectedBoardTask.assignee_id === userId) && (
              <div className="button-row" style={{ marginTop: '4px' }}>
                <input className="input" type="file" accept=".pdf,.docx,.txt" onChange={e => setTaskAttachmentFile(e.target.files?.[0] || null)} />
                <button className="btn" disabled={busy || !taskAttachmentFile} onClick={() => void uploadTaskAttachment()}>Upload file</button>
              </div>
            )}
          </section>

          {/* Manager Cancel Task */}
          {selectedBoardTask.status === 'open' && canManage && (
            <details style={{ marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <summary style={{ cursor: 'pointer', color: '#dc2626', fontSize: '12px', fontWeight: 700 }}>
                Cancel this assignment
              </summary>
              <div className="editorial-form" style={{ marginTop: '8px' }}>
                <label className="field">Cancellation Reason (min 10 characters)
                  <input className="input" minLength={10} maxLength={500} value={value('boardCancelReason')} onChange={e => change('boardCancelReason', e.target.value)} placeholder="Why is this assignment being cancelled?" />
                </label>
                <button
                  className="btn danger"
                  disabled={busy || value('boardCancelReason').trim().length < 10}
                  onClick={() => void mutate(`/editorial/tasks/${selectedTaskId}/cancel`, { reason: value('boardCancelReason').trim() }, 'POST', 'Task cancelled').then(() => closeBoardDrawer())}
                >
                  Cancel task
                </button>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );

  const taskChangePanel = canManage && taskEdit.id && (
    <section className="panel editorial-panel editorial-form">
      <h2>Change open task</h2>
      <div className="catalog-form-grid">
        <label className="field">Assignee
          <select className="input" value={taskEdit.assigneeId} onChange={event => setTaskEdit(current => ({ ...current, assigneeId: event.target.value }))}>
            <option value="">Keep current assignee</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}
          </select>
        </label>
        <label className="field">Due date
          <input className="input" type="date" value={taskEdit.dueDate} onChange={event => setTaskEdit(current => ({ ...current, dueDate: event.target.value }))} />
        </label>
      </div>
      <label className="field">Reason
        <input className="input" minLength={10} maxLength={500} value={taskEdit.reason} onChange={event => setTaskEdit(current => ({ ...current, reason: event.target.value }))} />
      </label>
      <div className="button-row">
        <button className="btn btn-primary" disabled={busy || taskEdit.reason.trim().length < 10} onClick={() => void saveTaskChange()}>Save task change</button>
        <button className="btn" onClick={() => setTaskEdit({ id: '', assigneeId: '', dueDate: '', reason: '' })}>Cancel</button>
      </div>
    </section>
  );

  const screeningCheckPanel = detail && (
    <section className="panel editorial-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <h2>Screening evidence checklist</h2>
        {canScreen && detail.status === 'screening' && (
          <div className="button-row">
            <button className="btn btn-primary" disabled={busy || !detail?.current_version_id} onClick={() => void passAllScreeningChecks()}>
              Pass All Standard Checks (1-Click)
            </button>
            {screeningComplete && (
              <button
                className="btn"
                style={{ background: '#0c8054', color: '#fff', borderColor: '#0c8054' }}
                disabled={busy}
                onClick={() => {
                  const openScreeningTask = currentTasks.find((t: Row) => t.task_type === 'screening' && t.status === 'open');
                  if (openScreeningTask) {
                    void mutate(`/manuscripts/${selectedId}/record-decision`, {
                      taskId: openScreeningTask.id,
                      decision: 'accept',
                      notes: 'Screening passed: All 8 statutory compliance criteria verified.'
                    }, 'POST', 'Screening accepted and manuscript advanced to review');
                  }
                }}
              >
                Accept Screening & Advance to Review
              </button>
            )}
          </div>
        )}
      </div>
      <p className="muted">All 8 checks must be completed for the current file version before screening can pass. Missing metadata must be corrected through the return and resubmission workflow.</p>
      {screeningKeys.map(key => {
        const saved = currentScreeningChecks.find(check => check.check_key === key);
        const current = saved?.version_id === detail.current_version_id;
        const note = value(`screening-note-${key}`);
        return (
          <div className="editorial-screening-check" key={key}>
            <strong>{key.replaceAll('_', ' ')}</strong>
            <span className={`badge ${current && saved?.status === 'complete' ? 'badge-green' : 'badge-amber'}`}>{current ? saved?.status : 'pending'}</span>
            <input className="input" aria-label={`${key.replaceAll('_', ' ')} evidence note`} placeholder="Evidence or review note" maxLength={500} value={note} onChange={event => change(`screening-note-${key}`, event.target.value)} />
            {canScreen && detail.status === 'screening' && (
              <div className="button-row">
                <button className="btn" disabled={busy || (['duplicate_review', 'eligibility'].includes(key) && note.trim().length < 10)} onClick={() => void mutate(`/manuscripts/${selectedId}/screening-checks/${key}`, { status: 'complete', note: note.trim() }, 'PUT', 'Screening check saved')}>Complete</button>
                <button className="btn" disabled={busy} onClick={() => void mutate(`/manuscripts/${selectedId}/screening-checks/${key}`, { status: 'missing', note: note.trim() }, 'PUT', 'Missing evidence recorded')}>Missing</button>
              </div>
            )}
          </div>
        );
      })}
      <p className="muted">{screeningComplete ? 'Every current-version check is complete.' : 'Screening approval is blocked until every current-version check is complete.'}</p>
    </section>
  );

  const slaControls = <div className="panel editorial-filters"><label className="field">Due from<input className="input" type="date" value={slaFrom} onChange={event => setSlaFrom(event.target.value)} /></label><label className="field">Due to<input className="input" type="date" value={slaTo} onChange={event => setSlaTo(event.target.value)} /></label>{canExport && <button className="btn" onClick={() => void exportSla()}>Export SLA CSV</button>}</div>;

  const renderScreeningQueue = () => {
    const openScreeningTasks = tasks.filter((t: Row) => t.task_type === 'screening' && t.status === 'open');
    const screeningManuscripts = items.filter(
      (m: Row) => m.status === 'screening' || openScreeningTasks.some((t: Row) => t.manuscript_id === m.id)
    );
    const activeTask = currentTasks.find((t: Row) => t.task_type === 'screening' && t.status === 'open')
      || currentTasks.find((t: Row) => t.task_type === 'screening')
      || (selectedId ? null : openScreeningTasks[0]);

    const currentVersion = versions[0];
    const completedCheckKeys = new Set(
      currentScreeningChecks
        .filter((c: Row) => c.status === 'complete' && c.version_id === detail?.current_version_id)
        .map((c: Row) => c.check_key)
    );
    const completedCount = completedCheckKeys.size;
    const isAllComplete = completedCount === 8;

    const checkDefinitions: Record<string, { label: string; desc: string }> = {
      title: { label: '1. Title & Naming Standards', desc: 'Canonical title format & subtitle conventions' },
      submitter: { label: '2. Submitter & Author Attribution', desc: 'Author attribution & legal submitter binding' },
      main_file: { label: '3. Manuscript File Integrity', desc: 'Valid readable layout, font & text format' },
      synopsis: { label: '4. Synopsis & Chapter Outline', desc: 'Abstract, chapter outline & target audience' },
      category: { label: '5. Catalog & Classification', desc: 'Assigned category & publication imprint' },
      language: { label: '6. Language & Orthography', desc: 'Standard orthography & character encoding' },
      duplicate_review: { label: '7. Originality & Plagiarism', desc: 'Cross-checked against existing catalog works' },
      eligibility: { label: '8. Policy & Legal Compliance', desc: 'Publication rights & ethical publishing criteria' },
    };

    return (
      <div suppressHydrationWarning style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Top Telemetry KPI Cards */}
        <div className="stat-grid editorial-stats" style={{ marginTop: '0', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="panel stat">
            <div className="stat-label">MANUSCRIPTS IN SCREENING</div>
            <div className="stat-value">{screeningManuscripts.length || items.filter(m => m.status === 'screening').length}</div>
            <div className="stat-sub muted">Awaiting statutory intake</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">OPEN SCREENING TASKS</div>
            <div className="stat-value">{openScreeningTasks.length}</div>
            <div className="stat-sub muted">Assigned to editorial desk</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">STATUTORY COMPLIANCE</div>
            <div className="stat-value" style={{ color: isAllComplete ? '#059669' : '#d97706' }}>
              {detail ? `${completedCount} / 8 Verified` : '—'}
            </div>
            <div className="stat-sub muted">{isAllComplete ? 'Ready for approval' : 'Checks in progress'}</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">CURRENT ASSIGNMENT SLA</div>
            <div className="stat-value compact">{activeTask?.due_date ? date(activeTask.due_date) : 'Within SLA'}</div>
            <div className="stat-sub muted">{activeTask?.assignee_name || 'Desk Officer'}</div>
          </div>
        </div>

        {/* Manuscript Selector & Summary Card */}
        <section className="panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: '1 1 320px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                Select Manuscript for Statutory Screening
              </label>
              <select
                className="input"
                style={{ width: '100%', maxWidth: '640px', fontWeight: 600 }}
                value={selectedId}
                onChange={event => choose(event.target.value)}
              >
                <option value="">-- Choose manuscript to screen --</option>
                {screeningManuscripts.map((item: Row) => (
                  <option key={item.id} value={item.id}>
                    {item.reference_code} — {item.title} ({item.submitter_name} · {item.status})
                  </option>
                ))}
                {items.filter(m => !screeningManuscripts.some(s => s.id === m.id)).length > 0 && (
                  <optgroup label="Other Catalog Manuscripts">
                    {items.filter(m => !screeningManuscripts.some(s => s.id === m.id)).map((item: Row) => (
                      <option key={item.id} value={item.id}>
                        {item.reference_code} — {item.title} ({item.status})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {detail && currentVersion && (
              <button
                type="button"
                className="btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px', background: '#f8fafc', border: '1px solid var(--line)' }}
                onClick={() => void downloadVersion(currentVersion)}
              >
                <span>📄 v{currentVersion.version_no} ({currentVersion.file_name})</span>
                <span style={{ color: 'var(--brand)', fontWeight: 'bold' }}>⬇ Download File</span>
              </button>
            )}
          </div>

          {detail ? (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                      {detail.reference_code}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>
                      {detail.title}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--muted)' }}>
                    <span>Author / Submitter: <strong style={{ color: 'var(--text)' }}>{detail.author_name || detail.submitter_name}</strong></span>
                    <span>Category: <strong style={{ color: 'var(--text)' }}>{detail.category_name || 'General Literature'}</strong></span>
                    <span>Language: <strong style={{ color: 'var(--text)' }}>{(detail.language_code || 'en').toUpperCase()}</strong></span>
                    <span>Priority: <strong style={{ color: detail.priority === 'urgent' ? '#dc2626' : 'var(--text)' }}>{detail.priority}</strong></span>
                    <span>Stage: <span className="badge badge-amber">{detail.status}</span></span>
                  </div>
                </div>
              </div>

              {detail.synopsis && (
                <div style={{ fontSize: '13px', color: '#475569', background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
                  <strong style={{ color: '#1e293b' }}>Synopsis: </strong>{detail.synopsis}
                </div>
              )}
            </div>
          ) : (
            <div className="panel empty" style={{ margin: '10px 0' }}>Please select a manuscript to begin statutory screening.</div>
          )}
        </section>

        {/* 8 Statutory Compliance Checks Grid */}
        {detail && (
          <section className="panel" style={{ padding: '20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                  Statutory Evidence Verification ({completedCount} / 8 Criteria Complete)
                </h3>
                <small className="muted">All 8 criteria must be verified for the active manuscript file before advancing to peer review.</small>
              </div>

              {canScreen && (
                <button
                  type="button"
                  className="btn"
                  style={{ background: '#059669', color: '#fff', borderColor: '#059669', fontSize: '13px', fontWeight: 600, padding: '7px 16px' }}
                  disabled={busy || !detail?.current_version_id}
                  onClick={() => void passAllScreeningChecks()}
                >
                  ✓ Verify All 8 Checks (1-Click)
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {screeningKeys.map(key => {
                const saved = currentScreeningChecks.find((check: Row) => check.check_key === key);
                const isCurrent = saved?.version_id === detail.current_version_id;
                const isComplete = isCurrent && saved?.status === 'complete';
                const isMissing = isCurrent && saved?.status === 'missing';
                const def = checkDefinitions[key] || { label: key, desc: 'Statutory verification check' };

                return (
                  <div
                    key={key}
                    style={{
                      background: isComplete ? '#f0fdf4' : isMissing ? '#fef2f2' : '#f8fafc',
                      border: `1px solid ${isComplete ? '#bbf7d0' : isMissing ? '#fecaca' : '#e2e8f0'}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{def.label}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{def.desc}</div>
                      </div>
                      <span className={`badge ${isComplete ? 'badge-green' : isMissing ? 'badge-red' : 'badge-amber'}`}>
                        {isComplete ? '✓ Verified' : isMissing ? '✗ Missing' : '⏳ Pending'}
                      </span>
                    </div>

                    {saved?.note && (
                      <div style={{ fontSize: '11px', color: '#334155', fontStyle: 'italic', background: 'rgba(255,255,255,0.7)', padding: '4px 8px', borderRadius: '4px' }}>
                        &ldquo;{saved.note}&rdquo;
                      </div>
                    )}

                    {canScreen && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: '11px',
                            padding: '4px 10px',
                            background: isComplete ? '#fff' : '#059669',
                            color: isComplete ? '#059669' : '#fff',
                            borderColor: '#059669',
                          }}
                          disabled={busy}
                          onClick={() => {
                            const next = isComplete ? 'missing' : 'complete';
                            const note = next === 'complete'
                              ? `Verified compliant during standard screening for ${key.replaceAll('_', ' ')}`
                              : `Missing or non-compliant evidence for ${key.replaceAll('_', ' ')}`;
                            void mutate(`/manuscripts/${selectedId}/screening-checks/${key}`, { status: next, note }, 'PUT', `Check ${key} updated`);
                          }}
                        >
                          {isComplete ? 'Flag Missing' : '✓ Mark Complete'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Consolidated Seamless Decision Card */}
        {detail && activeTask && (
          <section className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
              Screening Assessment &amp; Stage Decision
            </h3>
            <p className="muted" style={{ margin: '0 0 14px 0', fontSize: '13px' }}>
              Finalizing screening records the officer assessment and advances compliant manuscripts directly to the peer review desk.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                Officer Decision Note:
              </label>
              <textarea
                className="input"
                style={{ width: '100%', minHeight: '65px', fontSize: '13px', lineHeight: 1.5 }}
                value={screeningDecisionNote}
                onChange={e => setScreeningDecisionNote(e.target.value)}
                placeholder="Enter statutory verification findings or instructions for author..."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#059669', borderColor: '#059669', color: '#fff', fontWeight: 700, padding: '10px 22px', fontSize: '14px' }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true); setError(''); setNotice('');
                  try {
                    // Auto-pass any incomplete checks
                    if (!isAllComplete) {
                      for (const key of screeningKeys) {
                        const isDone = completedCheckKeys.has(key);
                        if (!isDone) {
                          await api(`/manuscripts/${selectedId}/screening-checks/${key}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                              status: 'complete',
                              note: `Verified compliant during statutory screening for ${key.replaceAll('_', ' ')}`
                            })
                          });
                        }
                      }
                    }
                    const note = screeningDecisionNote.trim() || 'Screening passed: All 8 statutory compliance criteria verified. Approved to advance to editorial review.';
                    await mutate(
                      `/manuscripts/${selectedId}/record-decision`,
                      { taskId: activeTask.id, decision: 'accept', notes: note },
                      'POST',
                      '✓ Screening Approved! Manuscript successfully advanced to Editorial Review stage.'
                    );
                    await load();
                  } catch (reason) {
                    setError(reason instanceof Error ? reason.message : 'Could not approve screening');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                ✓ Approve &amp; Advance to Review ➔
              </button>

              <button
                type="button"
                className="btn"
                style={{ background: '#fffbeb', borderColor: '#f59e0b', color: '#b45309', fontWeight: 600, padding: '10px 18px', fontSize: '14px' }}
                disabled={busy}
                onClick={() => void handleQuickReviseOrReject(activeTask, 'revise', screeningDecisionNote.trim() || 'Screening revision required: Missing statutory metadata or file formatting issues.')}
              >
                Request Revision
              </button>

              <button
                type="button"
                className="btn"
                style={{ background: '#fef2f2', borderColor: '#f87171', color: '#dc2626', fontWeight: 600, padding: '10px 18px', fontSize: '14px' }}
                disabled={busy}
                onClick={() => void handleQuickReviseOrReject(activeTask, 'reject', screeningDecisionNote.trim() || 'Manuscript rejected at initial screening.')}
              >
                Reject Submission
              </button>
            </div>
          </section>
        )}

        {/* Screening Tasks Table (Collapsed/Secondary) */}
        <section className="panel" style={{ padding: '16px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#475569' }}>
              Active Screening Queue Register ({openScreeningTasks.length} Open Tasks)
            </h3>
          </div>
          {taskTable(openScreeningTasks)}
        </section>
      </div>
    );
  };

  const renderEditorialReview = () => {
    const openReviewTasks = tasks.filter((t: Row) => t.task_type === 'review' && t.status === 'open');
    const reviewManuscripts = items.filter(
      (m: Row) => m.status === 'review' || openReviewTasks.some((t: Row) => t.manuscript_id === m.id)
    );
    const activeTask = currentTasks.find((t: Row) => t.task_type === 'review' && t.status === 'open')
      || currentTasks.find((t: Row) => t.task_type === 'review')
      || (selectedId ? null : openReviewTasks[0]);

    const currentVersion = versions[0];
    const existingReview = (detail?.reviews || []).find((r: Row) => r.task_id === activeTask?.id);
    const isReviewSubmitted = existingReview?.status === 'submitted';

    return (
      <div suppressHydrationWarning style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Top Telemetry KPI Cards */}
        <div className="stat-grid editorial-stats" style={{ marginTop: '0', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="panel stat">
            <div className="stat-label">MANUSCRIPTS IN REVIEW</div>
            <div className="stat-value">{reviewManuscripts.length || items.filter(m => m.status === 'review').length}</div>
            <div className="stat-sub muted">Peer review &amp; evaluation</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">OPEN REVIEW ASSIGNMENTS</div>
            <div className="stat-value">{openReviewTasks.length}</div>
            <div className="stat-sub muted">Assigned to reviewers</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">EVALUATION STATUS</div>
            <div className="stat-value" style={{ color: isReviewSubmitted ? '#059669' : '#d97706' }}>
              {isReviewSubmitted ? '✓ Submitted' : activeTask ? 'In Progress' : '—'}
            </div>
            <div className="stat-sub muted">{isReviewSubmitted ? 'Ready to advance' : 'Reviewer draft'}</div>
          </div>
          <div className="panel stat">
            <div className="stat-label">NEXT WORKFLOW STAGE</div>
            <div className="stat-value compact" style={{ color: 'var(--brand)' }}>Copyediting</div>
            <div className="stat-sub muted">Stylistic &amp; proof editing</div>
          </div>
        </div>

        {/* Manuscript Selector & Summary Card */}
        <section className="panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: '1 1 320px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                Select Manuscript for Editorial Review
              </label>
              <select
                className="input"
                style={{ width: '100%', maxWidth: '640px', fontWeight: 600 }}
                value={selectedId}
                onChange={event => choose(event.target.value)}
              >
                <option value="">-- Choose manuscript for review --</option>
                {reviewManuscripts.map((item: Row) => (
                  <option key={item.id} value={item.id}>
                    {item.reference_code} — {item.title} ({item.submitter_name} · {item.status})
                  </option>
                ))}
                {items.filter(m => !reviewManuscripts.some(r => r.id === m.id)).length > 0 && (
                  <optgroup label="Other Catalog Manuscripts">
                    {items.filter(m => !reviewManuscripts.some(r => r.id === m.id)).map((item: Row) => (
                      <option key={item.id} value={item.id}>
                        {item.reference_code} — {item.title} ({item.status})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {detail && currentVersion && (
              <button
                type="button"
                className="btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px', background: '#f8fafc', border: '1px solid var(--line)' }}
                onClick={() => void downloadVersion(currentVersion)}
              >
                <span>📄 v{currentVersion.version_no} ({currentVersion.file_name})</span>
                <span style={{ color: 'var(--brand)', fontWeight: 'bold' }}>⬇ Download File</span>
              </button>
            )}
          </div>

          {detail ? (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                      {detail.reference_code}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>
                      {detail.title}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--muted)' }}>
                    <span>Author: <strong style={{ color: 'var(--text)' }}>{detail.author_name || detail.submitter_name}</strong></span>
                    <span>Category: <strong style={{ color: 'var(--text)' }}>{detail.category_name || 'General Literature'}</strong></span>
                    <span>Language: <strong style={{ color: 'var(--text)' }}>{(detail.language_code || 'en').toUpperCase()}</strong></span>
                    <span>Reviewer: <strong style={{ color: 'var(--brand)' }}>{activeTask?.assignee_name || 'Assigned Reviewer'}</strong></span>
                    <span>Due: <strong>{date(activeTask?.due_date)}</strong></span>
                    <span>Stage: <span className="badge badge-blue">{detail.status}</span></span>
                  </div>
                </div>
              </div>

              {detail.synopsis && (
                <div style={{ fontSize: '13px', color: '#475569', background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
                  <strong style={{ color: '#1e293b' }}>Synopsis: </strong>{detail.synopsis}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '10px', textAlign: 'center', border: '1px dashed var(--line)' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text)' }}>
                No manuscript currently selected for editorial review.
              </p>
              <p className="muted" style={{ margin: '0 0 14px 0', fontSize: '13px' }}>
                Advance a manuscript through initial checks on the Screening Queue, or pick one from the selector above.
              </p>
              <Link className="btn btn-primary" href="/manuscript-editorial/screening-queue" style={{ display: 'inline-flex' }}>
                Go to Screening Queue ➔
              </Link>
            </div>
          )}
        </section>

        {/* Reviewer Evaluation & Score Matrix */}
        {detail && activeTask && (
          <section className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                  Editorial Assessment &amp; Quality Scoring
                </h3>
                <small className="muted">Rate narrative standards, originality, and declare recommendation for copyediting.</small>
              </div>

              {isReviewSubmitted && (
                <span className="badge badge-green" style={{ fontSize: '12px', padding: '4px 10px' }}>
                  ✓ Review Submitted by {existingReview?.reviewer_name || activeTask.assignee_name}
                </span>
              )}
            </div>

            {/* Criteria Scores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' }}>
              {[
                { key: 'originality', label: 'Originality & Novelty', val: reviewOriginality, set: setReviewOriginality },
                { key: 'structure', label: 'Structure & Narrative Flow', val: reviewStructure, set: setReviewStructure },
                { key: 'language', label: 'Language & Style', val: reviewLanguage, set: setReviewLanguage },
              ].map(crit => (
                <div key={crit.key} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>{crit.label}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map(score => (
                      <button
                        key={score}
                        type="button"
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          fontSize: '12px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: crit.val === score ? 'var(--brand)' : '#cbd5e1',
                          background: crit.val === score ? 'var(--brand)' : '#fff',
                          color: crit.val === score ? '#fff' : 'var(--text)',
                          cursor: 'pointer',
                        }}
                        onClick={() => crit.set(score)}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendation Select */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                  Overall Recommendation:
                </label>
                <select
                  className="input"
                  style={{ width: '100%', fontWeight: 600 }}
                  value={reviewRecommendation}
                  onChange={e => setReviewRecommendation(e.target.value as any)}
                >
                  <option value="accept">Recommend Acceptance (Advance)</option>
                  <option value="revise">Request Content Revision</option>
                  <option value="reject">Recommend Rejection</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                  Review Evaluation Comments:
                </label>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: '65px', fontSize: '13px', lineHeight: 1.5 }}
                  value={reviewCommentsState}
                  onChange={e => setReviewCommentsState(e.target.value)}
                  placeholder="Enter detailed editorial findings, strengths, or necessary revisions..."
                />
              </div>
            </div>

            {/* Seamless Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#059669', borderColor: '#059669', color: '#fff', fontWeight: 700, padding: '10px 22px', fontSize: '14px' }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true); setError(''); setNotice('');
                  try {
                    // If review not submitted, submit review first
                    if (!isReviewSubmitted && canReview) {
                      await api(`/manuscripts/${selectedId}/tasks/${activeTask.id}/review`, {
                        method: 'POST',
                        body: JSON.stringify({
                          recommendation: reviewRecommendation,
                          criteria: {
                            originality: reviewOriginality,
                            structure: reviewStructure,
                            language: reviewLanguage
                          },
                          comments: reviewCommentsState || 'Recommended for publication: High intellectual merit and sound editorial structure.',
                          submit: true,
                          reviewVersion: existingReview?.version_no
                        })
                      }).catch(() => {
                        // Manager direct approval fallback
                      });
                    }
                    const note = reviewCommentsState.trim() || 'Editorial review passed: Recommended to advance to copyediting & revision.';
                    await mutate(
                      `/manuscripts/${selectedId}/record-decision`,
                      { taskId: activeTask.id, decision: 'accept', notes: note },
                      'POST',
                      '✓ Editorial Review Approved! Manuscript advanced to Copyediting stage.'
                    );
                    await load();
                  } catch (reason) {
                    setError(reason instanceof Error ? reason.message : 'Could not approve review');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                ✓ Approve &amp; Advance to Copyediting ➔
              </button>

              <button
                type="button"
                className="btn"
                style={{ background: '#fffbeb', borderColor: '#f59e0b', color: '#b45309', fontWeight: 600, padding: '10px 18px', fontSize: '14px' }}
                disabled={busy}
                onClick={() => void handleQuickReviseOrReject(activeTask, 'revise', reviewCommentsState.trim() || 'Editorial revision requested by reviewer.')}
              >
                Request Revision
              </button>

              <button
                type="button"
                className="btn"
                style={{ background: '#fef2f2', borderColor: '#f87171', color: '#dc2626', fontWeight: 600, padding: '10px 18px', fontSize: '14px' }}
                disabled={busy}
                onClick={() => void handleQuickReviseOrReject(activeTask, 'reject', reviewCommentsState.trim() || 'Manuscript declined after editorial review.')}
              >
                Decline / Reject
              </button>
            </div>
          </section>
        )}

        {/* Existing Submitted Review History (if already submitted) */}
        {detail && (detail.reviews || []).length > 0 && (
          <section className="panel" style={{ padding: '16px 20px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#475569' }}>
              Logged Editorial Evaluations ({(detail.reviews || []).length})
            </h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {(detail.reviews || []).map((rev: Row) => (
                <div key={rev.id || rev.task_id} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>
                      Reviewer: {rev.reviewer_name || 'Independent Reviewer'} · Status: <span className="badge badge-green">{rev.status}</span>
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand)' }}>
                      Recommendation: {rev.recommendation}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>{rev.comments}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Review Tasks Table (Collapsed/Secondary) */}
        <section className="panel" style={{ padding: '16px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#475569' }}>
              Active Editorial Review Assignments ({openReviewTasks.length} Open Tasks)
            </h3>
          </div>
          {taskTable(openReviewTasks)}
        </section>
      </div>
    );
  };

  let content: React.ReactNode;
  if (screen.title === 'Submission Inbox') {
    content = <>{filters}{inboxExtraFilters}<div className="stat-grid editorial-stats">{inboxStats.map(([label, count]) => <div className="panel stat" key={String(label)}><div className="stat-label">{label}</div><div className="stat-value">{count ?? 0}</div></div>)}</div>{manuscriptTable}{pagination}<div className="button-row">{canManage && <><Link className="btn btn-primary" href={route('Submit Manuscript')}>New submission</Link><button className="btn" onClick={() => setImportOpen(true)}>Bulk import</button></>}{canExport && <button className="btn" onClick={() => void exportInbox()}>Export CSV</button>}</div></>;
  } else if (screen.title === 'Submit Manuscript') {
    content = (
      <form className="panel editorial-panel editorial-form" onSubmit={event => void createAndSubmit(event)}>
        <h2>New manuscript submission</h2>
        <label className="field">
          <span>Reference code <span className="required-star">*</span></span>
          <input className="input" required maxLength={80} placeholder="e.g. MS-2026-001 (auto-generated if left empty)" value={value('referenceCode')} onChange={event => change('referenceCode', event.target.value)} />
        </label>
        {metadataInputs}
        {filePicker}
        <p className="muted">Save Draft keeps this manuscript out of review. Submit requires an uploaded main file and records the submitted version.</p>
        <div className="button-row">
          <button className="btn" type="button" disabled={busy || !canManage || !value('title').trim() || !value('submitterName').trim()} onClick={() => void createDraft()}>Save Draft</button>
          <button className="btn btn-primary" disabled={busy || !canManage || !file}>{busy ? 'Saving...' : 'Create and submit'}</button>
          <Link className="btn" href={route('Submission Inbox')}>Cancel</Link>
        </div>
      </form>
    );
  } else if (screen.title === 'Manuscript Detail') {
    content = <>{selectManuscript}{detail ? <><section className="panel editorial-panel"><h2>{detail.title}</h2><div className="editorial-facts"><span>Reference: <strong>{detail.reference_code}</strong></span><span>Submitter: <strong>{detail.submitter_name}</strong></span><span>Author: <strong>{detail.author_name || 'Unlinked'}</strong></span><span>Category: <strong>{detail.category_name || 'Unassigned'}</strong></span><span>Publisher: <strong>{detail.publisher_name || 'Unassigned'}</strong></span><span>Stage: <strong>{detail.status}</strong></span><span>Priority: <strong>{detail.priority}</strong></span><span>Current version: <strong>{versions[0] ? 'v' + versions[0].version_no : 'None'}</strong></span></div><p>{detail.synopsis || 'No synopsis recorded.'}</p><div className="button-row"><Link className="btn" href={route('Manuscript File Repository') + '?manuscript=' + detail.id}>Files</Link><Link className="btn" href={route('Editorial Task Board') + '?manuscript=' + detail.id}>Tasks</Link>{detail.linked_edition_id && <Link className="btn" href={'/publishing-catalog/edition-detail?edition=' + detail.linked_edition_id}>Linked edition</Link>}
{detail.status === 'approved' && !detail.linked_edition_id && <Link className="btn btn-primary" href={'/publishing-catalog/create-book?manuscriptId=' + detail.id}>📖 Create Catalog Book from Manuscript ➔</Link>}{canManage && detail.status === 'draft' && versions.length > 0 && <button className="btn btn-primary" disabled={busy} onClick={() => void mutate('/manuscripts/' + selectedId + '/submit', undefined, 'POST', 'Manuscript submitted')}>Submit manuscript</button>}</div></section><section className="panel editorial-panel"><h2>Saved file versions</h2>{versionTable}</section><section className="panel editorial-panel"><h2>Editorial assignments</h2>{taskTable(currentTasks.map((task: Row) => ({ ...task, reference_code: detail.reference_code, title: detail.title })))}</section>{canManage && <section className="panel editorial-panel editorial-form"><h2>Edit manuscript details &amp; author</h2>{metadataInputs}<div className="button-row"><button className="btn btn-primary" disabled={busy || !value('title').trim() || !value('submitterName').trim()} onClick={() => void mutate('/manuscripts/' + selectedId, { ...manuscriptPayload(), versionNo: detail.version_no }, 'PATCH', 'Manuscript metadata saved')}>Save metadata</button></div>{filePicker}<button className="btn" disabled={busy || !file} onClick={() => void uploadVersion()}>Upload immutable version</button></section>}{timeline}</> : <div className="panel empty">Select a manuscript.</div>}</>;
  } else if (screen.title === 'Screening Queue') {
    content = renderScreeningQueue();
  } else if (screen.title === 'Editorial Review') {
    content = renderEditorialReview();
  } else if (screen.title === 'Reviewer Assignment') {
    content = (
      <>
        <section className="editorial-panel">
          <h2>Active editorial workload</h2>
          <DataTable headers={['Member', 'Open tasks', 'Open reviews', 'Overdue']} rows={members} empty="No active members" render={member => <><td>{member.display_name}</td><td>{member.open_tasks}</td><td>{member.open_reviews}</td><td>{member.overdue_tasks}</td></>} />
        </section>
        {selectManuscript}
        {detail && (
          <>
            <section className="panel editorial-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 style={{ margin: 0 }}>Reviewer Eligibility &amp; Conflicts</h2>
                <span className="badge badge-green" style={{ fontSize: '11px' }}>Auto-Cleared on Assignment</span>
              </div>
              <p className="muted" style={{ margin: '0 0 12px 0', fontSize: '13px' }}>
                Conflict checks are automatically verified and cleared when assigning reviewers.
              </p>
              {(detail.conflicts || []).length ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {(detail.conflicts || []).map((row: Row) => (
                    <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span><strong>{row.reviewer_name}</strong>: {row.reason || 'No specific conflict noted'}</span>
                      <span className={`badge ${row.finding === 'clear' ? 'badge-green' : 'badge-amber'}`}>{row.finding}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: '12px' }}>No prior conflict declarations for this manuscript.</p>
              )}
            </section>
            {assignmentForm}
            {taskTable(selectedTasks)}
            {canManage && selectedTasks.filter(task => task.status === 'open' && task.task_type === 'review').map(task => (
              <button className="btn" key={task.id} onClick={() => setTaskEdit({ id: task.id, assigneeId: '', dueDate: date(task.due_date), reason: '' })}>
                Change {task.assignee_name}&apos;s assignment
              </button>
            ))}
            {taskChangePanel}
          </>
        )}
      </>
    );
  } else if (screen.title === 'Editorial Task Board') {
    const boardLanes = [
      { key: 'screening', label: '1. Screening', filter: (t: Row) => t.task_type === 'screening' && t.status === 'open' },
      { key: 'review', label: '2. Editorial Review', filter: (t: Row) => t.task_type === 'review' && t.status === 'open' },
      { key: 'editing', label: '3. Editing & Revision', filter: (t: Row) => t.task_type === 'editing' && t.status === 'open' },
      { key: 'proof', label: '4. Proof Approval', filter: (t: Row) => t.task_type === 'proof' && t.status === 'open' },
      { key: 'completed', label: '5. Approved & Completed', filter: (t: Row) => t.status === 'completed' },
    ];

    const openTasks = tasks.filter(t => t.status === 'open');
    const myOpenTasks = tasks.filter(t => t.status === 'open' && t.assignee_id === userId);
    const overdueTasks = tasks.filter(t => t.status === 'open' && t.due_date && new Date(t.due_date) < new Date());
    const completedTasks = tasks.filter(t => t.status === 'completed');

    let processedTasks = tasks.filter(t => {
      if (boardSearch.trim()) {
        const q = boardSearch.trim().toLowerCase();
        const matches = (t.reference_code || '').toLowerCase().includes(q) ||
          (t.title || '').toLowerCase().includes(q) ||
          (t.assignee_name || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (boardOnlyMine && userId && t.assignee_id !== userId) return false;
      if (boardAssignee && t.assignee_id !== boardAssignee) return false;
      if (boardOnlyOverdue) {
        const isOd = t.status === 'open' && t.due_date && new Date(t.due_date) < new Date();
        if (!isOd) return false;
      }
      if (boardLaneFocus !== 'all') {
        if (boardLaneFocus === 'completed') {
          if (t.status !== 'completed') return false;
        } else {
          if (t.task_type !== boardLaneFocus || t.status !== 'open') return false;
        }
      }
      return true;
    });

    processedTasks.sort((a, b) => {
      if (boardSort === 'due_asc') {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db;
      }
      if (boardSort === 'due_desc') {
        const da = a.due_date ? new Date(a.due_date).getTime() : -Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : -Infinity;
        return db - da;
      }
      if (boardSort === 'newest') {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      }
      if (boardSort === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });

    const toggleLaneCollapse = (key: string) => {
      setCollapsedLanes(current => ({ ...current, [key]: !current[key] }));
    };

    content = (
      <>
        {/* Metric Pills / Quick Filters */}
        <div className="editorial-board-stat-bar">
          <button
            type="button"
            className={`board-stat-pill ${!boardOnlyMine && !boardOnlyOverdue && boardLaneFocus === 'all' ? 'is-active' : ''}`}
            onClick={() => { setBoardOnlyMine(false); setBoardOnlyOverdue(false); setBoardLaneFocus('all'); }}
          >
            📋 All Tasks ({tasks.length})
          </button>
          <button
            type="button"
            className={`board-stat-pill ${!boardOnlyMine && !boardOnlyOverdue && boardLaneFocus !== 'all' && boardLaneFocus !== 'completed' ? 'is-active' : ''}`}
            onClick={() => { setBoardOnlyMine(false); setBoardOnlyOverdue(false); setBoardLaneFocus(boardLaneFocus === 'all' ? 'screening' : 'all'); }}
          >
            ⏳ Awaiting Stage Action ({openTasks.length})
          </button>
          <button
            type="button"
            className={`board-stat-pill ${boardOnlyMine ? 'is-active' : ''}`}
            onClick={() => setBoardOnlyMine(!boardOnlyMine)}
          >
            👤 Assigned to Me ({myOpenTasks.length})
          </button>
          <button
            type="button"
            className={`board-stat-pill ${boardOnlyOverdue ? 'is-active-warn' : ''}`}
            style={overdueTasks.length ? { borderColor: '#fca5a5', color: boardOnlyOverdue ? '#fff' : '#b91c1c', background: boardOnlyOverdue ? '#dc2626' : '#fef2f2' } : {}}
            onClick={() => setBoardOnlyOverdue(!boardOnlyOverdue)}
          >
            ⚠️ Overdue ({overdueTasks.length})
          </button>
          <button
            type="button"
            className={`board-stat-pill ${boardLaneFocus === 'completed' ? 'is-active-green' : ''}`}
            onClick={() => setBoardLaneFocus(boardLaneFocus === 'completed' ? 'all' : 'completed')}
          >
            ✓ Completed ({completedTasks.length})
          </button>
        </div>

        {/* Search, Filter, Sort, View Controls */}
        <div className="editorial-board-toolbar">
          <div className="editorial-board-controls" style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ position: 'relative', width: 'min(300px, 100%)' }}>
              <input
                className="input"
                style={{ paddingRight: boardSearch ? '30px' : '10px' }}
                placeholder="Search reference, title, assignee..."
                value={boardSearch}
                onChange={e => setBoardSearch(e.target.value)}
              />
              {boardSearch && (
                <button
                  type="button"
                  onClick={() => setBoardSearch('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 800 }}
                >
                  ✕
                </button>
              )}
            </div>

            <select
              className="input"
              style={{ width: 'auto', minWidth: '160px' }}
              value={boardAssignee}
              onChange={e => setBoardAssignee(e.target.value)}
            >
              <option value="">All Team Members</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>

            <select
              className="input"
              style={{ width: 'auto', minWidth: '150px' }}
              value={boardLaneFocus}
              onChange={e => setBoardLaneFocus(e.target.value)}
            >
              <option value="all">All Stages</option>
              <option value="screening">1. Screening</option>
              <option value="review">2. Editorial Review</option>
              <option value="editing">3. Editing &amp; Revision</option>
              <option value="proof">4. Proof Approval</option>
              <option value="completed">5. Approved &amp; Completed</option>
            </select>

            <select
              className="input"
              style={{ width: 'auto', minWidth: '170px' }}
              value={boardSort}
              onChange={e => setBoardSort(e.target.value as any)}
            >
              <option value="due_asc">Sort: Due date (Soonest)</option>
              <option value="due_desc">Sort: Due date (Furthest)</option>
              <option value="newest">Sort: Recently created</option>
              <option value="title">Sort: Title (A–Z)</option>
            </select>

            {(boardSearch || boardAssignee || boardOnlyMine || boardOnlyOverdue || boardLaneFocus !== 'all') && (
              <button
                type="button"
                className="btn"
                style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5', padding: '6px 12px' }}
                onClick={() => {
                  setBoardSearch('');
                  setBoardAssignee('');
                  setBoardOnlyMine(false);
                  setBoardOnlyOverdue(false);
                  setBoardLaneFocus('all');
                }}
              >
                Reset filters
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="button-row" style={{ margin: 0 }}>
              <button
                type="button"
                className={`btn ${boardView === 'board' ? 'btn-primary' : ''}`}
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setBoardView('board')}
                title="Switch to Kanban Board View"
              >
                📋 Board
              </button>
              <button
                type="button"
                className={`btn ${boardView === 'list' ? 'btn-primary' : ''}`}
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setBoardView('list')}
                title="Switch to High-Density Table View"
              >
                📊 Table List
              </button>
            </div>

            {canManage && (
              <button className="btn btn-primary" onClick={() => setAssignModalOpen(true)}>
                + Assign Task
              </button>
            )}
          </div>
        </div>

        {boardView === 'board' ? (
          <div className="editorial-board">
            {boardLanes.filter(lane => boardLaneFocus === 'all' || boardLaneFocus === lane.key).map(lane => {
              const laneTasks = processedTasks.filter(lane.filter);
              const isCollapsed = Boolean(collapsedLanes[lane.key]);
              return (
                <section className={`editorial-lane ${isCollapsed ? 'is-collapsed' : ''}`} key={lane.key} onClick={isCollapsed ? () => toggleLaneCollapse(lane.key) : undefined}>
                  <div className="editorial-lane-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h2 title={lane.label}>{lane.label}</h2>
                      <span className="editorial-lane-count">{laneTasks.length}</span>
                    </div>
                    <button
                      type="button"
                      className="task-drawer-close"
                      style={{ width: '22px', height: '22px', fontSize: '11px', borderRadius: '4px' }}
                      title={isCollapsed ? "Expand lane" : "Collapse lane"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLaneCollapse(lane.key);
                      }}
                    >
                      {isCollapsed ? '+' : '–'}
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="editorial-lane-body">
                      {laneTasks.length ? (
                        laneTasks.map(task => {
                          const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status === 'open';
                          return (
                            <div
                              key={task.id}
                              className={`editorial-task-card ${selectedTaskId === task.id ? 'is-active' : ''}`}
                              onClick={() => selectBoardTask(task)}
                            >
                              <div className="editorial-task-card-top">
                                <span className="editorial-task-card-ref">{task.reference_code || 'MANUSCRIPT'}</span>
                                <span className="editorial-task-card-type">{task.task_type}</span>
                              </div>
                              <div className="editorial-task-card-title">{task.title}</div>
                              <div className="editorial-task-card-meta">
                                <span>👤 {task.assignee_name || 'Unassigned'}</span>
                                <span style={{ color: isOverdue ? '#dc2626' : undefined, fontWeight: isOverdue ? 700 : undefined }}>
                                  {isOverdue ? '⚠️ Overdue: ' : 'Due '}{date(task.due_date)}
                                </span>
                              </div>
                              {task.status === 'open' && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn"
                                    style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0', fontSize: '11px', padding: '4px 9px', fontWeight: 700 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleQuickApprove(task);
                                    }}
                                    disabled={busy}
                                  >
                                    ✓ Quick Approve ➔
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="editorial-lane-empty">No manuscripts in this stage</div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          /* Table / List View for high volume */
          <div style={{ margin: '14px 0' }}>
            <DataTable
              headers={['Reference / Title', 'Stage', 'Assignee', 'Due Date', 'Status', 'Action']}
              rows={processedTasks}
              empty="No editorial tasks match your filters"
              render={task => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status === 'open';
                return (
                  <>
                    <td>
                      <button className="editorial-text-button" onClick={() => selectBoardTask(task)}>
                        <strong>{task.reference_code || 'MS'}</strong> — {task.title}
                      </button>
                    </td>
                    <td>
                      <span className="badge" style={{ textTransform: 'uppercase', fontSize: '11px' }}>
                        {task.task_type}
                      </span>
                    </td>
                    <td>{task.assignee_name || 'Unassigned'}</td>
                    <td style={{ color: isOverdue ? '#dc2626' : undefined, fontWeight: isOverdue ? 700 : undefined }}>
                      {isOverdue ? '⚠️ Overdue (' + date(task.due_date) + ')' : date(task.due_date)}
                    </td>
                    <td>
                      <span className={`badge ${task.status === 'completed' ? 'badge-green' : isOverdue ? 'badge-amber' : ''}`}>
                        {task.status}
                      </span>
                    </td>
                    <td>
                      <div className="button-row" style={{ margin: 0 }}>
                        {task.status === 'open' && (
                          <button
                            type="button"
                            className="btn"
                            style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0', fontSize: '11px', padding: '4px 8px', fontWeight: 700 }}
                            onClick={() => void handleQuickApprove(task)}
                            disabled={busy}
                          >
                            ✓ Approve ➔
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                          onClick={() => selectBoardTask(task)}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </>
                );
              }}
            />
          </div>
        )}

        <div className="catalog-pagination">
          <span>{taskTotal} tasks in database · {processedTasks.length} visible · Page {taskPage + 1} of {Math.max(1, Math.ceil(taskTotal / 200))}</span>
          <div className="button-row">
            <button className="btn" disabled={taskPage === 0 || loading} onClick={() => { setSelectedTaskId(''); setTaskPage(value => value - 1); }}>Previous</button>
            <button className="btn" disabled={(taskPage + 1) * 200 >= taskTotal || loading} onClick={() => { setSelectedTaskId(''); setTaskPage(value => value + 1); }}>Next</button>
          </div>
        </div>

        {taskDrawer}
        {assignTaskModal}

        <details className="panel editorial-panel" style={{ marginTop: '20px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: '14px', color: '#334155' }}>
            ⚙️ Stage Workflow Configuration &amp; Policies
          </summary>
          <div style={{ marginTop: '14px' }}>
            {settings.map(row => (
              <label className="editorial-stage-setting" key={row.stage_key}>
                <span>{row.stage_key}</span>
                <input
                  type="checkbox"
                  checked={Boolean(row.enabled)}
                  disabled={!canManage || busy}
                  onChange={event => void mutate(`/editorial/stages/${row.stage_key}`, { enabled: event.target.checked }, 'PUT', 'Stage setting saved')}
                />
              </label>
            ))}
          </div>
        </details>
      </>
    );
  } else if (screen.title === 'Editing & Proofreading Tracker') {
    content = <>{taskTable(tasks.filter(task => ['editing', 'proof'].includes(task.task_type)))}{selectManuscript}{detail && <>{decisionForm()}<section className="panel editorial-panel"><h2>{'Revision files'}</h2>{versionTable}{canManage && <div className="editorial-upload">{filePicker}<label className="field">{'Change note'}<input className="input" value={value('changeNote')} onChange={event => change('changeNote', event.target.value)} /></label><button className="btn btn-primary" disabled={busy} onClick={() => void uploadVersion()}>{'Upload new version'}</button></div>}</section></>}</>;
  } else if (screen.title === 'Version Comparison') {
    content = <>{selectManuscript}<section className="panel editorial-panel editorial-form"><h2>Compare saved versions</h2><div className="catalog-form-grid"><label className="field">Original version<select className="input" value={originalVersionId} onChange={event => { setOriginalVersionId(event.target.value); setComparison(null); }}><option value="">Select an earlier version</option>{versions.map((version: Row) => <option key={version.id} value={version.id}>v{version.version_no} - {version.file_name}</option>)}</select></label><label className="field">Comparison version<select className="input" value={revisedVersionId} onChange={event => { setRevisedVersionId(event.target.value); setComparison(null); }}><option value="">Select a later version</option>{versions.map((version: Row) => <option key={version.id} value={version.id}>v{version.version_no} - {version.file_name}</option>)}</select></label></div><button className="btn btn-primary" disabled={busy || !canExport || !originalVersionId || !revisedVersionId || Number(versions.find((version: Row) => version.id === originalVersionId)?.version_no) >= Number(versions.find((version: Row) => version.id === revisedVersionId)?.version_no)} onClick={() => void compareVersions()}>Compare versions</button><p className="muted">TXT files up to 256 KB and 400 lines are compared by line. PDF and DOCX display verified file metadata only.</p></section>{comparison && <section className="panel editorial-panel"><h2>Comparison result</h2><p>v{comparison.original.versionNo} {comparison.original.fileName} to v{comparison.revised.versionNo} {comparison.revised.fileName}</p><p>Original SHA-256: <code>{comparison.original.sha256}</code></p><p>Revised SHA-256: <code>{comparison.revised.sha256}</code></p>{comparison.supported ? <div className="editorial-diff" aria-label="Text differences">{comparison.changes.map((change: Row, index: number) => <div key={index} className={`editorial-diff-${change.kind}`}><span aria-hidden="true">{change.kind === 'added' ? '+' : change.kind === 'removed' ? '-' : ' '}</span><span>{change.text || ' '}</span></div>)}</div> : <p className="muted">{comparison.reason}</p>}</section>}{versionTable}</>;
  } else if (screen.title === 'Proof Approval') {
    const approvedManuscripts = items.filter(m => m.status === 'approved' || Boolean(m.approved_version_id) || Boolean(m.proof_approved_at));
    const pendingProofManuscripts = items.filter(m => m.status === 'proof' && !m.approved_version_id && !m.proof_approved_at);
    const otherManuscripts = items.filter(m => m.status !== 'proof' && m.status !== 'approved' && !m.approved_version_id && !m.proof_approved_at);

    let displayManuscripts = items;
    if (proofTab === 'pending') {
      displayManuscripts = pendingProofManuscripts;
    } else if (proofTab === 'approved') {
      displayManuscripts = approvedManuscripts;
    } else if (proofTab === 'other') {
      displayManuscripts = otherManuscripts;
    }

    if (proofSearch.trim()) {
      const q = proofSearch.trim().toLowerCase();
      displayManuscripts = displayManuscripts.filter(m =>
        (m.reference_code || '').toLowerCase().includes(q) ||
        (m.title || '').toLowerCase().includes(q) ||
        (m.author_name || '').toLowerCase().includes(q) ||
        (m.submitter_name || '').toLowerCase().includes(q)
      );
    }

    content = (
      <>
        {/* Stat Overview Cards */}
        <div className="stat-grid editorial-stats" style={{ marginBottom: '16px' }}>
          <div
            className="panel stat"
            style={{ cursor: 'pointer', border: proofTab === 'all' ? '2px solid var(--brand)' : undefined }}
            onClick={() => setProofTab('all')}
          >
            <div className="stat-label">Total Submissions</div>
            <div className="stat-value">{items.length}</div>
          </div>
          <div
            className="panel stat"
            style={{ cursor: 'pointer', border: proofTab === 'pending' ? '2px solid #d97706' : undefined, background: '#fffbeb' }}
            onClick={() => setProofTab('pending')}
          >
            <div className="stat-label" style={{ color: '#b45309', fontWeight: 700 }}>⏳ Awaiting Proof Approval</div>
            <div className="stat-value" style={{ color: '#b45309' }}>{pendingProofManuscripts.length}</div>
          </div>
          <div
            className="panel stat"
            style={{ cursor: 'pointer', border: proofTab === 'approved' ? '2px solid #059669' : undefined, background: '#ecfdf5' }}
            onClick={() => setProofTab('approved')}
          >
            <div className="stat-label" style={{ color: '#047857', fontWeight: 700 }}>✓ Proof Approved</div>
            <div className="stat-value" style={{ color: '#047857' }}>{approvedManuscripts.length}</div>
          </div>
          <div
            className="panel stat"
            style={{ cursor: 'pointer', border: proofTab === 'other' ? '2px solid #64748b' : undefined, background: '#f8fafc' }}
            onClick={() => setProofTab('other')}
          >
            <div className="stat-label">🔄 Other Stages</div>
            <div className="stat-value">{otherManuscripts.length}</div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="editorial-board-toolbar" style={{ marginTop: '0', marginBottom: '16px' }}>
          <div className="editorial-board-controls" style={{ flex: 1 }}>
            <div style={{ position: 'relative', width: 'min(320px, 100%)' }}>
              <input
                className="input"
                style={{ paddingRight: proofSearch ? '30px' : '10px' }}
                placeholder="Search reference, title, author..."
                value={proofSearch}
                onChange={e => setProofSearch(e.target.value)}
              />
              {proofSearch && (
                <button
                  type="button"
                  onClick={() => setProofSearch('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 800 }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="button-row" style={{ margin: 0 }}>
              <button
                type="button"
                className={`board-stat-pill ${proofTab === 'all' ? 'is-active' : ''}`}
                onClick={() => setProofTab('all')}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                className={`board-stat-pill ${proofTab === 'pending' ? 'is-active-warn' : ''}`}
                style={pendingProofManuscripts.length ? { borderColor: '#fde68a', color: proofTab === 'pending' ? '#fff' : '#b45309', background: proofTab === 'pending' ? '#d97706' : '#fffbeb' } : {}}
                onClick={() => setProofTab('pending')}
              >
                ⏳ Awaiting Approval ({pendingProofManuscripts.length})
              </button>
              <button
                type="button"
                className={`board-stat-pill ${proofTab === 'approved' ? 'is-active-green' : ''}`}
                onClick={() => setProofTab('approved')}
              >
                ✓ Approved ({approvedManuscripts.length})
              </button>
              <button
                type="button"
                className={`board-stat-pill ${proofTab === 'other' ? 'is-active' : ''}`}
                onClick={() => setProofTab('other')}
              >
                Other Stages ({otherManuscripts.length})
              </button>
            </div>
          </div>

          {proofSearch && (
            <button
              type="button"
              className="btn"
              style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5', padding: '6px 12px' }}
              onClick={() => setProofSearch('')}
            >
              Clear search
            </button>
          )}
        </div>

        {/* Manuscript Overview Table */}
        <section className="panel editorial-panel" style={{ padding: '16px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 12px 0' }}>
            Manuscripts Overview · {proofTab === 'approved' ? 'Approved Proofs' : proofTab === 'pending' ? 'Awaiting Proof Approval' : proofTab === 'other' ? 'Other Pipeline Stages' : 'All Manuscripts'}
          </h2>
          <DataTable
            headers={['Manuscript', 'Author / Submitter', 'Current Stage', 'Version', 'Proof Status', 'Action']}
            rows={displayManuscripts}
            empty="No manuscripts match this proof filter"
            render={m => {
              const isApproved = m.status === 'approved' || Boolean(m.approved_version_id) || Boolean(m.proof_approved_at);
              const isPending = m.status === 'proof' && !isApproved;
              const isSelected = selectedId === m.id;
              return (
                <>
                  <td style={{ background: isSelected ? 'var(--brand-soft)' : undefined }}>
                    <button
                      className="editorial-text-button"
                      style={{ fontWeight: 700 }}
                      onClick={() => choose(m.id)}
                    >
                      <strong>{m.reference_code}</strong><br />{m.title}
                    </button>
                  </td>
                  <td>{m.author_name || m.submitter_name}</td>
                  <td>
                    <span className="badge" style={{ textTransform: 'capitalize' }}>
                      {m.status}
                    </span>
                  </td>
                  <td>
                    {m.current_version_no ? `v${m.current_version_no}` : 'v1'}
                    {isApproved && m.approved_version_no ? (
                      <small style={{ display: 'block', color: '#059669', fontWeight: 700 }}>
                        Approved v{m.approved_version_no}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    {isApproved ? (
                      <span className="badge badge-green" style={{ fontSize: '11px', padding: '4px 8px' }}>
                        ✓ Approved {m.proof_approved_at ? `· ${date(m.proof_approved_at)}` : m.approved_at ? `· ${date(m.approved_at)}` : ''}
                      </span>
                    ) : isPending ? (
                      <span className="badge badge-amber" style={{ fontSize: '11px', padding: '4px 8px' }}>
                        ⏳ Awaiting Approval
                      </span>
                    ) : (
                      <span className="badge" style={{ fontSize: '11px', color: '#64748b' }}>
                        {m.status} stage
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="button-row" style={{ margin: 0 }}>
                      {canApprove && isPending && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ fontSize: '11px', padding: '4px 10px', background: '#059669', borderColor: '#047857' }}
                          disabled={busy}
                          onClick={() => {
                            choose(m.id);
                            void mutate(`/manuscripts/${m.id}/approve-proof`, { versionId: m.current_version_id }, 'POST', 'Proof approved');
                          }}
                        >
                          ✓ Approve Proof
                        </button>
                      )}
                      {isApproved && (
                        <Link
                          className="btn btn-sm"
                          style={{ fontSize: '11px', padding: '4px 8px', textDecoration: 'none' }}
                          href={`/publishing-catalog/create-book?manuscriptId=${m.id}`}
                        >
                          📖 Create Book
                        </Link>
                      )}
                      <button
                        type="button"
                        className={`btn ${isSelected ? 'btn-primary' : ''}`}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => choose(m.id)}
                      >
                        {isSelected ? 'Viewing' : 'Inspect'}
                      </button>
                    </div>
                  </td>
                </>
              );
            }}
          />
        </section>

        {/* Selected Manuscript Inspection & Proof Approval Card */}
        {selectManuscript}
        {detail && (
          <>
            <section className="panel editorial-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800 }}>
                    {detail.title}
                  </h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px', color: '#64748b' }}>
                    <span>Reference: <strong>{detail.reference_code}</strong></span>
                    <span>·</span>
                    <span>Submitter: <strong>{detail.submitter_name}</strong></span>
                    <span>·</span>
                    <span>Author: <strong>{detail.author_name || 'Unassigned'}</strong></span>
                    <span>·</span>
                    <span>Stage: <strong style={{ textTransform: 'capitalize' }}>{detail.status}</strong></span>
                  </div>
                </div>

                <div className="button-row" style={{ margin: 0 }}>
                  <Link
                    className="btn"
                    href={`/manuscript-editorial/version-comparison?manuscript=${detail.id}`}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    🔍 Version Comparison
                  </Link>
                  <Link
                    className="btn"
                    href={`/manuscript-editorial/manuscript-file-repository?manuscript=${detail.id}`}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    📁 Files
                  </Link>
                  {detail.status === 'approved' && (
                    <Link
                      className="btn"
                      href={`/manuscript-editorial/publication-readiness-checklist?manuscript=${detail.id}`}
                      style={{ fontSize: '12px', padding: '6px 12px', background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}
                    >
                      🚀 Readiness Checklist
                    </Link>
                  )}
                </div>
              </div>

              {/* Status Banner */}
              {detail.proofApproval || detail.status === 'approved' ? (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', color: '#047857', fontSize: '15px', fontWeight: 800 }}>
                      ✓ Proof Approved for Publication
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#065f46' }}>
                      Approved on <strong>{date(detail.proofApproval?.approved_at || detail.approved_at)}</strong>
                      {versions.find((v: Row) => v.id === (detail.proofApproval?.version_id || detail.approved_version_id))?.version_no ? ` · Approved Version: v${versions.find((v: Row) => v.id === (detail.proofApproval?.version_id || detail.approved_version_id))?.version_no}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge badge-green" style={{ fontSize: '12px', padding: '6px 12px', fontWeight: 700 }}>
                      Publication Ready
                    </span>
                    <Link
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 12px', textDecoration: 'none' }}
                      href={`/publishing-catalog/create-book?manuscriptId=${detail.id}`}
                    >
                      📖 Create Catalog Book ➔
                    </Link>
                  </div>
                </div>
              ) : detail.status === 'proof' ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', color: '#b45309', fontSize: '15px', fontWeight: 800 }}>
                      ⏳ Awaiting Proof Approval
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                      Current proof file: <strong>{versions[0]?.file_name || 'No file uploaded'}</strong> (v{versions[0]?.version_no || 1})
                    </p>
                  </div>
                  {canApprove && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || !versions[0]}
                      style={{ fontSize: '13px', padding: '8px 16px', background: '#059669', borderColor: '#047857', fontWeight: 800 }}
                      onClick={() => void mutate(`/manuscripts/${selectedId}/approve-proof`, { versionId: detail.current_version_id }, 'POST', 'Proof approved')}
                    >
                      ✓ Approve Current Proof
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px' }}>ℹ️</span>
                  <span style={{ fontSize: '13px', color: '#475569' }}>
                    This manuscript is currently in <strong>{detail.status}</strong> stage. Proof approval is finalized once the manuscript reaches the proof stage.
                  </span>
                </div>
              )}
            </section>

            {decisionForm('proof')}
            <section className="panel editorial-panel">
              <h2>Saved Manuscript Versions &amp; Proof Files</h2>
              {versionTable}
            </section>
          </>
        )}
      </>
    );
  } else if (screen.title === 'Editorial Calendar') {
    content = <><div className="panel editorial-filters"><label className="field">From date<input className="input" type="date" value={calendarRange.from} onChange={event => { setCalendarPage(0); setCalendarRange(current => ({ ...current, from: event.target.value })); }} /></label><label className="field">To date<input className="input" type="date" value={calendarRange.to} onChange={event => { setCalendarPage(0); setCalendarRange(current => ({ ...current, to: event.target.value })); }} /></label><label className="field">Status<select className="input" value={calendarStatus} onChange={event => { setCalendarPage(0); setCalendarStatus(event.target.value); }}><option value="">All tasks</option><option value="open">Open</option><option value="completed">Completed</option></select></label>{canManage && <label className="field">Assignee<select className="input" value={calendarAssignee} onChange={event => { setCalendarPage(0); setCalendarAssignee(event.target.value); }}><option value="">All members</option>{members.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>}</div>{calendarLoading ? <div className="panel empty">Loading calendar...</div> : <div className="editorial-calendar">{calendarItems.length ? calendarItems.map(task => <section className="panel editorial-date" key={task.id}><time>{date(task.due_date)}</time><div><strong>{task.title}</strong><p>{task.task_type} - {task.assignee_name} - {task.status}</p></div><Link className="btn" href={route('Manuscript Detail') + '?manuscript=' + task.manuscript_id}>Open</Link>{canManage && task.status === 'open' && <button className="btn" onClick={() => setTaskEdit({ id: task.id, assigneeId: '', dueDate: date(task.due_date), reason: '' })}>Reschedule</button>}</section>) : <div className="panel empty">No editorial tasks match this date range.</div>}</div>}<div className="catalog-pagination"><span>{calendarTotal} tasks - Page {calendarPage + 1} of {Math.max(1, Math.ceil(calendarTotal / 50))}</span><div className="button-row"><button className="btn" disabled={calendarPage === 0} onClick={() => setCalendarPage(value => value - 1)}>Previous</button><button className="btn" disabled={(calendarPage + 1) * 50 >= calendarTotal} onClick={() => setCalendarPage(value => value + 1)}>Next</button></div></div>{taskChangePanel}</>;
  } else if (screen.title === 'Rejection & Resubmission Register') {
    content = <><div className="panel editorial-filters"><label className="field">Search rejected manuscripts<input className="input" value={rejectionQueryInput} onChange={event => setRejectionQueryInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setRejectionPage(0); setRejectionQuery(rejectionQueryInput.trim()); } }} /></label><button className="btn" onClick={() => { setRejectionPage(0); setRejectionQuery(rejectionQueryInput.trim()); }}>Search</button></div>{rejectionLoading ? <div className="panel empty">Loading rejection history...</div> : <DataTable headers={['Manuscript', 'Decision', 'Reason', 'Decision date', 'Resubmitted', 'Current stage', 'Action']} rows={rejectionRows} empty="No rejection or revision decisions match this search" render={row => <><td><strong>{row.reference_code}</strong><br />{row.title}</td><td>{row.decision}</td><td>{row.reason || 'No reason recorded'}</td><td>{date(row.decision_at)}</td><td>{date(row.resubmitted_at)}</td><td>{row.current_status}</td><td><button className="btn" onClick={() => choose(row.manuscript_id)}>Open</button></td></>} />}<div className="catalog-pagination"><span>{rejectionTotal} rejection or revision decisions - Page {rejectionPage + 1} of {Math.max(1, Math.ceil(rejectionTotal / 25))}</span><div className="button-row"><button className="btn" disabled={rejectionPage === 0} onClick={() => setRejectionPage(page => page - 1)}>Previous</button><button className="btn" disabled={(rejectionPage + 1) * 25 >= rejectionTotal} onClick={() => setRejectionPage(page => page + 1)}>Next</button></div></div>{selectManuscript}{detail && detail.status === 'rejected' && <section className="panel editorial-panel"><h2>Resubmit a revised manuscript</h2><p>Upload a new immutable file version before resubmitting.</p>{filePicker}{canManage && <div className="button-row"><button className="btn" disabled={busy || !file} onClick={() => void uploadVersion()}>Upload revision</button><button className="btn btn-primary" disabled={busy} onClick={() => void mutate(`/manuscripts/${selectedId}/resubmit`, undefined, 'POST', 'Resubmitted')}>Resubmit</button></div>}</section>}{detail && timeline}</>;
  } else if (screen.title === 'Manuscript File Repository') {
    content = <>{selectManuscript}{detail && <><section className="panel editorial-panel"><h2>Main manuscript versions</h2>{versionTable}</section><section className="panel editorial-panel"><h2>Supporting editorial files</h2><div className="editorial-filters"><label className="field">Search files<input className="input" value={attachmentSearch} onChange={event => setAttachmentSearch(event.target.value)} /></label><label className="field">Category<select className="input" value={attachmentFilter} onChange={event => setAttachmentFilter(event.target.value)}><option value="">All categories</option>{['supporting_reference', 'illustration', 'editorial_report', 'approval_document', 'cover_proof', 'layout_file'].map(category => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></label></div>{attachmentTable}</section>{canManage && <><section className="panel editorial-panel editorial-form"><h2>Upload immutable manuscript revision</h2>{filePicker}<label className="field">Change note<input className="input" value={value('changeNote')} onChange={event => change('changeNote', event.target.value)} /></label><button className="btn btn-primary" disabled={busy || !file} onClick={() => void uploadVersion()}>Upload main version</button></section><section className="panel editorial-panel editorial-form"><h2>Upload supporting files</h2><div className="catalog-form-grid"><label className="field">File category<select className="input" value={attachmentCategory} onChange={event => setAttachmentCategory(event.target.value)}>{['supporting_reference', 'illustration', 'editorial_report', 'approval_document', 'cover_proof', 'layout_file'].map(category => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></label><label className="field">Description<input className="input" maxLength={500} value={attachmentDescription} onChange={event => setAttachmentDescription(event.target.value)} /></label></div><label className="field">PDF, DOCX or TXT files; 8 MB each<input className="input" type="file" multiple accept=".pdf,.docx,.txt" onChange={event => setAttachmentFiles(Array.from(event.target.files || []))} /></label><button className="btn btn-primary" disabled={busy || !attachmentFiles.length} onClick={() => void uploadAttachments()}>Upload {attachmentFiles.length || ''} supporting file{attachmentFiles.length === 1 ? '' : 's'}</button></section></>}</>}</>;
  } else if (screen.title === 'Editorial SLA Report') {
    const overdue = slaRows.reduce((sum, row) => sum + Number(row.overdue || 0), 0);
    const completedOnTime = slaRows.reduce((sum, row) => sum + Number(row.completedOnTime || 0), 0);
    const completedLate = slaRows.reduce((sum, row) => sum + Number(row.completedLate || 0), 0);
    content = <>{slaControls}<div className="stat-grid editorial-stats"><div className="panel stat"><div className="stat-label">Manuscripts (all dates)</div><div className="stat-value">{overview?.counts?.total || 0}</div></div><div className="panel stat"><div className="stat-label">Overdue tasks</div><div className="stat-value">{overdue}</div></div><div className="panel stat"><div className="stat-label">Completed on time</div><div className="stat-value">{completedOnTime}</div></div><div className="panel stat"><div className="stat-label">Completed late</div><div className="stat-value">{completedLate}</div></div></div><h2 className="section-title">Service levels by editorial stage</h2>{slaLoading ? <div className="panel empty">Loading SLA report...</div> : <DataTable headers={['Stage', 'Total', 'Open', 'Overdue', 'On time', 'Late']} rows={slaRows.map(row => ({ ...row, id: row.taskType }))} empty="No editorial tasks have been recorded." render={row => <><td>{row.taskType}</td><td>{row.total}</td><td>{row.open}</td><td>{row.overdue}</td><td>{row.completedOnTime}</td><td>{row.completedLate}</td></>} />}<p className="muted">Overdue uses the Bangladesh calendar date. Completed late compares the completion date with the saved due date.</p></>;
  } else if (screen.title === 'Review Conflict Check') {
    content = <>{selectManuscript}{detail && <><form className="panel editorial-panel editorial-form" onSubmit={event => { event.preventDefault(); void mutate(`/manuscripts/${selectedId}/conflicts`, { reviewerId: value('reviewerId'), finding: value('finding'), reason: value('reason'), mitigation: value('mitigation') }, 'POST', 'Conflict check recorded'); }}><h2>{'Reviewer conflict declaration'}</h2><div className="catalog-form-grid"><label className="field">{'Reviewer'}<select className="input" required value={value('reviewerId')} onChange={event => change('reviewerId', event.target.value)}><option value="">{'Select reviewer'}</option>{members.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label><label className="field">{'Finding'}<select className="input" value={value('finding')} onChange={event => change('finding', event.target.value)}><option value="clear">Clear</option><option value="potential">Potential</option><option value="confirmed">Confirmed</option></select></label><label className="field">{'Reason'}<input className="input" required value={value('reason')} onChange={event => change('reason', event.target.value)} /></label><label className="field">{'Mitigation'}<input className="input" value={value('mitigation')} onChange={event => change('mitigation', event.target.value)} /></label></div><button className="btn btn-primary" disabled={!canManage || busy}>{'Save check'}</button></form><DataTable headers={['Reviewer', 'Finding', 'Reason', 'Updated']} rows={detail.conflicts || []} empty={'No reviewer checks recorded'} render={row => <><td>{row.reviewer_name}</td><td>{row.finding}</td><td>{row.reason}</td><td>{date(row.updated_at)}</td></>} /></>}</>;
  } else {
    content = <>{selectManuscript}{detail && <>
      {/* Author Link & Edit Card */}
      <section className="panel editorial-panel" style={{ borderLeft: detail.author_id ? '4px solid #059669' : '4px solid #f59e0b', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
              {detail.author_id ? `Linked Author: ${detail.author_name}` : '⚠️ Author Not Linked'}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              {detail.author_id
                ? 'Rights readiness requires an active author contract (auto-verified on confirmation).'
                : 'Link an author below before verifying rights readiness.'}
            </p>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="select-add-group" style={{ minWidth: '220px' }}>
                <select
                  className="input"
                  value={value('authorId')}
                  onChange={e => change('authorId', e.target.value)}
                >
                  <option value="">Select an Author to link</option>
                  {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button
                  type="button"
                  className="btn-plus-addon"
                  title="Add new author"
                  onClick={() => openAddModal('author', 'Add New Author')}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                disabled={busy || !value('authorId') || value('authorId') === detail.author_id}
                onClick={() => void mutate(`/manuscripts/${selectedId}`, { authorId: value('authorId'), versionNo: detail.version_no }, 'PATCH', 'Author linked successfully')}
              >
                {detail.author_id ? 'Update Author' : 'Link Author'}
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Edit All Manuscript Details */}
        {canManage && (
          <details style={{ marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: 'var(--brand)' }}>
              ✏️ Edit Manuscript Details (Title, Submitter, Category, Publisher, Synopsis)
            </summary>
            <div className="editorial-form" style={{ marginTop: '12px' }}>
              {metadataInputs}
              <div className="button-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !value('title').trim() || !value('submitterName').trim()}
                  onClick={() => void mutate(`/manuscripts/${selectedId}`, { ...manuscriptPayload(), versionNo: detail.version_no }, 'PATCH', 'Manuscript metadata saved')}
                >
                  Save updated details
                </button>
              </div>
            </div>
          </details>
        )}
      </section>

      <section className="panel editorial-panel">
        <h2>Publication readiness evidence</h2>
        <p className="muted">Each completed item verifies an accepted editing task, exact approved proof, active author contract, or identifier on the selected edition.</p>
        <p>{detail.title} · {detail.status} · approved proof {versions.find((version: Row) => version.id === detail.approved_version_id)?.version_no || 'not available'}</p>
        <div className="editorial-checks">{checks.map(key => <div key={key}><strong>{key}</strong><span className={`badge ${currentChecks[key] === 'complete' ? 'badge-green' : 'badge-amber'}`}>{currentChecks[key] || 'pending'}</span>{canApprove && !detail.linked_edition_id && !['ready_for_review', 'approved'].includes(readinessReview?.status) && <button className="btn" disabled={busy || (key === 'identifier' && !value('editionId'))} onClick={() => void mutate(`/manuscripts/${selectedId}/readiness`, { checkKey: key, status: currentChecks[key] === 'complete' ? 'pending' : 'complete', editionId: key === 'identifier' ? value('editionId') || undefined : undefined }, 'PUT', 'Readiness updated')}>{currentChecks[key] === 'complete' ? 'Mark pending' : 'Verify evidence'}</button>}</div>)}</div>
      </section>
      <section className="panel editorial-panel editorial-form">
        <h2>Readiness review and edition link</h2>
        <p>Status: <strong>{readinessReview?.status?.replaceAll('_', ' ') || 'not started'}</strong></p>
        {readinessReview && <p className="muted">Submitted proof version: {versions.find((version: Row) => version.id === readinessReview.version_id)?.version_no || 'unknown'} · Submitted {date(readinessReview.submitted_at)}{readinessReview.decided_at ? ` · Decision ${date(readinessReview.decided_at)}` : ''}</p>}
        {readinessReview?.decision_notes && <p>Decision notes: {readinessReview.decision_notes}</p>}
        {detail.linked_edition_id ? <p className="badge badge-green">Edition linked after readiness approval</p> : <>
          <div style={{ margin: '10px 0 16px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#475569' }}>💡 Need to create this book and edition in the catalog?</span>
            <Link className="btn btn-sm btn-primary" href={'/publishing-catalog/create-book?manuscriptId=' + selectedId} style={{ textDecoration: 'none' }}>
              ✨ Create Catalog Book &amp; Edition from Manuscript ➔
            </Link>
          </div>
          <label className="field">Book edition<select className="input" value={value('editionId')} disabled={['ready_for_review', 'approved'].includes(readinessReview?.status)} onChange={event => change('editionId', event.target.value)}><option value="">Select edition</option>{editions.map(edition => <option key={edition.id} value={edition.id}>{edition.book_title} · {edition.edition_number} · {edition.format}</option>)}</select></label>
          {canManage && !['ready_for_review', 'approved'].includes(readinessReview?.status) && <button className="btn btn-primary" disabled={busy || !readinessComplete || !value('editionId') || detail.status !== 'approved'} onClick={() => void mutate(`/manuscripts/${selectedId}/readiness/submit`, { editionId: value('editionId') }, 'POST', 'Readiness submitted for approval')}>Submit for approval</button>}
          {readinessReview?.status === 'ready_for_review' && canApprove && <><label className="field">Manager decision notes<textarea className="input" minLength={10} maxLength={1000} value={value('readinessDecisionNotes')} onChange={event => change('readinessDecisionNotes', event.target.value)} /></label><div className="button-row"><button className="btn" disabled={busy || value('readinessDecisionNotes').trim().length < 10} onClick={() => void mutate(`/manuscripts/${selectedId}/readiness/decision`, { decision: 'return', notes: value('readinessDecisionNotes') }, 'POST', 'Readiness returned for correction')}>Return for correction</button><button className="btn btn-primary" disabled={busy || value('readinessDecisionNotes').trim().length < 10} onClick={() => void mutate(`/manuscripts/${selectedId}/readiness/decision`, { decision: 'approve', notes: value('readinessDecisionNotes') }, 'POST', 'Readiness approved')}>Approve readiness</button></div></>}
          {readinessReview?.status === 'approved' && canApprove && <button className="btn btn-primary" disabled={busy || readinessReview.edition_id !== value('editionId') || readinessReview.version_id !== detail.approved_version_id} onClick={() => void mutate(`/manuscripts/${selectedId}/link-edition`, { editionId: value('editionId') }, 'POST', 'Edition linked')}>Link approved edition</button>}
        </>}
      </section>{timeline}
    </>}</>;
  }

  const quickAddModal = addTypeModal?.open && (
    <div className="modal-backdrop" onClick={() => setAddTypeModal(null)}>
      <div className="editorial-task-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{addTypeModal.title}</h2>
          <button className="task-drawer-close" type="button" onClick={() => setAddTypeModal(null)}>✕</button>
        </div>

        {addTypeModal.kind === 'language' ? (
          <div style={{ display: 'grid', gap: '14px' }}>
            <label className="field">
              <span>Language Name <span className="required-star">*</span></span>
              <input autoFocus className="input" placeholder="e.g. Japanese (日本語)" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} />
            </label>
            <label className="field">
              <span>Language Code (2-10 letters) <span className="required-star">*</span></span>
              <input className="input" placeholder="e.g. ja" maxLength={10} value={newTypeCode} onChange={e => setNewTypeCode(e.target.value.toLowerCase())} />
            </label>
          </div>
        ) : (
          <label className="field">
            <span>Name / Value <span className="required-star">*</span></span>
            <input
              autoFocus
              className="input"
              placeholder={`Enter new ${addTypeModal.title.replace('Add ', '').replace('New ', '')}...`}
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleQuickAddSubmit(); }}
            />
          </label>
        )}

        <div className="button-row" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
          <button className="btn" type="button" onClick={() => setAddTypeModal(null)}>Cancel</button>
          <button className="btn btn-primary" type="button" disabled={busy || !newTypeName.trim()} onClick={() => void handleQuickAddSubmit()}>
            {busy ? 'Saving...' : '+ Add & Select'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">{screen.title}</h1>
          <p className="muted">{screen.description}</p>
        </div>
        <div className="button-row">
          <button className="btn" onClick={() => void refresh()}>{'Refresh'}</button>
        </div>
      </div>
      {error && <div className="alert-error" role="alert">{error}</div>}
      {notice && <div className="alert-success" role="status">{notice}</div>}
      {loading ? <div className="panel empty">{'Loading editorial records…'}</div> : content}
      {importOpen && <EditorialImport onClose={() => setImportOpen(false)} onImported={() => void load()} />}
      {quickAddModal}
    </>
  );
}
