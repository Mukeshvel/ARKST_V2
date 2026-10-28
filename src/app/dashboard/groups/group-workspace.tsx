'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { dashboardJson } from '../dashboard-data';

type Department = {
  departmentId: string;
  departmentName: string;
  manageGroups: boolean;
};
type Group = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  memberCount: number;
};
type Student = {
  studentId: string;
  name: string;
  rollNumber: string;
  member: boolean;
};
type CurrentMember = {
  studentId: string;
  name: string;
  rollNumber: string | null;
  eligible: boolean;
  memberSince: string;
};
type History = {
  studentId: string;
  studentName: string | null;
  rollNumber: string | null;
  action: string;
  occurredAt: string;
};

function message(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed.';
}
function post(path: string, value: unknown) {
  return dashboardJson<Record<string, unknown>>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}
function utc(value: string) {
  return new Date(value).toISOString();
}

export function GroupWorkspace() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [department, setDepartment] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [group, setGroup] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [currentMembers, setCurrentMembers] = useState<CurrentMember[]>([]);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [history, setHistory] = useState<History[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [creationOptions, setCreationOptions] = useState<
    { department_id: string; category_key: string }[]
  >([]);
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadGroups = useCallback(async (id: string) => {
    if (!id) return;
    const body = await dashboardJson<{ groups: Group[] }>(
      `/api/groups?department=${id}`,
    );
    if (!Array.isArray(body.groups))
      throw new Error('Group list is unavailable.');
    setGroups(body.groups);
    setGroup((current) =>
      body.groups.some((item) => item.id === current)
        ? current
        : (body.groups[0]?.id ?? ''),
    );
  }, []);
  const loadStudents = useCallback(
    async (id: string, term: string, page: number) => {
      if (!id) {
        setStudents([]);
        setTotal(0);
        return;
      }
      const body = await dashboardJson<{ students: Student[]; total: number }>(
        `/api/groups/${id}/students?search=${encodeURIComponent(term)}&offset=${page}`,
      );
      if (!Array.isArray(body.students) || typeof body.total !== 'number')
        throw new Error('Group roster is unavailable.');
      setStudents(body.students);
      setTotal(body.total);
      setOffset(page);
    },
    [],
  );
  const loadHistory = useCallback(async (id: string, page: number) => {
    if (!id) {
      setHistory([]);
      return;
    }
    const body = await dashboardJson<{ events: History[]; total: number }>(
      `/api/groups/${id}/history?offset=${page}`,
    );
    if (!Array.isArray(body.events) || typeof body.total !== 'number')
      throw new Error('Group history is unavailable.');
    setHistory(body.events);
    setHistoryTotal(body.total);
    setHistoryOffset(page);
  }, []);
  const loadCurrent = useCallback(async (id: string, page: number) => {
    if (!id) {
      setCurrentMembers([]);
      setCurrentTotal(0);
      return;
    }
    const body = await dashboardJson<{
      members: CurrentMember[];
      total: number;
    }>(`/api/groups/${id}/current-members?offset=${page}`);
    if (!Array.isArray(body.members) || typeof body.total !== 'number')
      throw new Error('Current group membership is unavailable.');
    setCurrentMembers(body.members);
    setCurrentTotal(body.total);
    setCurrentOffset(page);
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        const [options, creation] = await Promise.all([
          dashboardJson<{ departments: Department[] }>(
            '/api/department-operations',
          ),
          dashboardJson<{
            options: { department_id: string; category_key: string }[];
          }>('/api/activities/options'),
        ]);
        const manageable = options.departments.filter(
          (row) => row.manageGroups,
        );
        setCreationOptions(creation.options);
        setDepartments(manageable);
        setDepartment(manageable[0]?.departmentId ?? '');
        const initialCategories = [
          ...new Set(
            creation.options
              .filter(
                (row) => row.department_id === manageable[0]?.departmentId,
              )
              .map((row) => row.category_key),
          ),
        ];
        setCategories(initialCategories);
        setCategory(initialCategories[0] ?? '');
      } catch (caught) {
        setError(message(caught));
      }
    })();
  }, []);
  useEffect(() => {
    void loadGroups(department).catch((caught) => setError(message(caught)));
  }, [department, loadGroups]);
  useEffect(() => {
    void Promise.all([
      loadStudents(group, search, 0),
      loadHistory(group, 0),
      loadCurrent(group, 0),
    ]).catch((caught) => setError(message(caught)));
  }, [group, search, loadStudents, loadHistory, loadCurrent]);

  async function run(operation: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      if (success) setNotice(success);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    await run(async () => {
      const result = await post('/api/groups', {
        departmentId: department,
        name: form.get('name'),
        type: form.get('type'),
      });
      await loadGroups(department);
      if (typeof result.id === 'string') setGroup(result.id);
      element.reset();
    }, 'Group created.');
  }
  async function changeMember(studentId: string, add: boolean) {
    await run(
      async () => {
        await post(`/api/groups/${group}/members`, { studentId, add });
        await Promise.all([
          loadStudents(group, search, offset),
          loadHistory(group, 0),
          loadGroups(department),
          loadCurrent(group, 0),
        ]);
      },
      add
        ? 'Member added.'
        : 'Member removed. Published assignments are unchanged.',
    );
  }
  async function publishActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      const output = await post(`/api/groups/${group}/activities`, {
        category: form.get('category'),
        title: form.get('title'),
        description: form.get('description'),
        startsAt: utc(String(form.get('startsAt'))),
        deadlineAt: utc(String(form.get('deadlineAt'))),
        endsAt: utc(String(form.get('endsAt'))),
        requiresVerification: form.get('verify') === 'on',
      });
      if (typeof output.id !== 'string')
        throw new Error('Publication result is unavailable.');
      setNotice(
        `Activity published to ${output.assignedCount} students. Monitor it in Faculty activities.`,
      );
    }, '');
  }
  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      const output = await post(`/api/groups/${group}/announcements`, {
        title: form.get('title'),
        message: form.get('message'),
      });
      if (typeof output.id !== 'string')
        throw new Error('Publication result is unavailable.');
      setNotice(
        `Announcement delivered to ${output.recipientCount} current group members.`,
      );
    }, '');
  }
  async function editGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await post(`/api/groups/${group}`, {
        name: form.get('name'),
        type: form.get('type'),
        active: form.get('active') === 'on',
      });
      await loadGroups(department);
    }, 'Group details updated.');
  }
  if (!departments.length)
    return (
      <section className="dashboard-panel">
        <p>
          {error || 'No group-management grant is available for this account.'}
        </p>
      </section>
    );
  return (
    <div className="dashboard-stack">
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="dashboard-panel dashboard-stack">
        <label>
          Department{' '}
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setGroup('');
              const next = [
                ...new Set(
                  creationOptions
                    .filter((row) => row.department_id === e.target.value)
                    .map((row) => row.category_key),
                ),
              ];
              setCategories(next);
              setCategory(next[0] ?? '');
            }}
          >
            {departments.map((row) => (
              <option key={row.departmentId} value={row.departmentId}>
                {row.departmentName}
              </option>
            ))}
          </select>
        </label>
        <form className="dashboard-form" onSubmit={create}>
          <h2>Create group</h2>
          <div className="dashboard-form-grid">
            <label>
              Name <input name="name" required maxLength={120} />
            </label>
            <label>
              Category or purpose{' '}
              <input
                name="type"
                required
                maxLength={80}
                placeholder="RHP, placement, custom…"
              />
            </label>
          </div>
          <button disabled={busy} type="submit">
            Create group
          </button>
        </form>
      </section>
      <section className="dashboard-panel dashboard-stack">
        <h2>Membership</h2>
        <label>
          Group{' '}
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · {row.type} · {row.memberCount} members
              </option>
            ))}
          </select>
        </label>
        {group && (
          <form
            className="dashboard-form"
            key={`${group}-${groups.find((row) => row.id === group)?.name}-${groups.find((row) => row.id === group)?.type}-${groups.find((row) => row.id === group)?.active}`}
            onSubmit={editGroup}
          >
            <h3>Edit selected group</h3>
            <div className="dashboard-form-grid">
              <label>
                Name{' '}
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={
                    groups.find((row) => row.id === group)?.name ?? ''
                  }
                />
              </label>
              <label>
                Purpose{' '}
                <input
                  name="type"
                  required
                  maxLength={80}
                  defaultValue={
                    groups.find((row) => row.id === group)?.type ?? ''
                  }
                />
              </label>
              <label>
                Active{' '}
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={
                    groups.find((row) => row.id === group)?.active ?? false
                  }
                />
              </label>
            </div>
            <button disabled={busy} type="submit">
              Save group details
            </button>
          </form>
        )}
        {group && (
          <>
            <h3>Current members</h3>
            <p>
              {currentTotal} members, including any who later became ineligible.
            </p>
            {currentMembers.map((row) => (
              <div className="dashboard-list-row" key={row.studentId}>
                <span>
                  {row.name}
                  {row.rollNumber ? ` · ${row.rollNumber}` : ''} ·{' '}
                  {row.eligible ? 'Eligible' : 'No longer eligible'} · since{' '}
                  {new Date(row.memberSince).toLocaleDateString()}
                </span>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => void changeMember(row.studentId, false)}
                >
                  Remove
                </button>
              </div>
            ))}
            <div>
              <button
                disabled={currentOffset === 0}
                type="button"
                onClick={() =>
                  void loadCurrent(
                    group,
                    Math.max(0, currentOffset - 50),
                  ).catch((caught) => setError(message(caught)))
                }
              >
                Previous members
              </button>{' '}
              <button
                disabled={currentOffset + 50 >= currentTotal}
                type="button"
                onClick={() =>
                  void loadCurrent(group, currentOffset + 50).catch((caught) =>
                    setError(message(caught)),
                  )
                }
              >
                Next members
              </button>
            </div>
            <label>
              Find eligible student{' '}
              <input
                value={search}
                maxLength={80}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <p>{total} eligible students</p>
            {students.map((row) => (
              <div className="dashboard-list-row" key={row.studentId}>
                <span>
                  {row.name} · {row.rollNumber}
                </span>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => void changeMember(row.studentId, !row.member)}
                >
                  {row.member ? 'Remove' : 'Add'}
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                disabled={offset === 0}
                onClick={() =>
                  void loadStudents(
                    group,
                    search,
                    Math.max(0, offset - 50),
                  ).catch((caught) => setError(message(caught)))
                }
              >
                Previous
              </button>{' '}
              <button
                type="button"
                disabled={offset + 50 >= total}
                onClick={() =>
                  void loadStudents(group, search, offset + 50).catch(
                    (caught) => setError(message(caught)),
                  )
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
      {group && (
        <>
          <section className="dashboard-panel dashboard-stack">
            <h2>Membership history</h2>
            <p>{historyTotal} recorded changes</p>
            {history.map((row, index) => (
              <p key={`${row.studentId}-${row.occurredAt}-${index}`}>
                {row.action} · {row.studentName ?? row.studentId} ·{' '}
                {new Date(row.occurredAt).toLocaleString()}
              </p>
            ))}
            <button
              disabled={historyOffset + 50 >= historyTotal}
              type="button"
              onClick={() =>
                void loadHistory(group, historyOffset + 50).catch((caught) =>
                  setError(message(caught)),
                )
              }
            >
              Older changes
            </button>
          </section>
          <section className="dashboard-panel dashboard-stack">
            <h2>Publish to current members</h2>
            <p>
              Publication takes a fixed assignment snapshot. Membership edits do
              not change published Activities.
            </p>
            <form className="dashboard-form" onSubmit={publishActivity}>
              <h3>Activity</h3>
              <label>
                Category{' '}
                <select
                  name="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Title <input name="title" required maxLength={160} />
              </label>
              <label>
                Description <textarea name="description" maxLength={5000} />
              </label>
              <div className="dashboard-form-grid">
                <label>
                  Starts (local time){' '}
                  <input name="startsAt" type="datetime-local" required />
                </label>
                <label>
                  Deadline (local time){' '}
                  <input name="deadlineAt" type="datetime-local" required />
                </label>
                <label>
                  Ends (local time){' '}
                  <input name="endsAt" type="datetime-local" required />
                </label>
              </div>
              <label>
                <input name="verify" type="checkbox" /> Requires staff
                verification
              </label>
              <button disabled={busy || !category} type="submit">
                Publish Activity
              </button>
            </form>
            <form className="dashboard-form" onSubmit={publishAnnouncement}>
              <h3>Announcement</h3>
              <label>
                Title <input name="title" required maxLength={160} />
              </label>
              <label>
                Message <textarea name="message" required maxLength={5000} />
              </label>
              <button disabled={busy} type="submit">
                Publish announcement
              </button>
            </form>
            <Link href="/dashboard/faculty">Monitor published Activities</Link>
          </section>
        </>
      )}
    </div>
  );
}
