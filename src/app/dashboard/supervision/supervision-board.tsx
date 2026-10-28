'use client';

import { useCallback, useEffect, useState } from 'react';
import { dashboardJson } from '../dashboard-data';

type Department = {
  departmentId: string;
  departmentName: string;
  supervise: boolean;
};
type Summary = {
  activeStudents: number;
  assignments: number;
  reported: number;
  awaitingVerification: number;
  verified: number;
  pending: number;
  overdue: number;
  openFollowUps: number;
  openEscalations: number;
};
type Section = {
  sectionId: string;
  sectionName: string;
  activeStudents: number;
  assignments: number;
  completed: number;
};
type Counselor = {
  counselorId: string;
  name: string;
  studentCount: number;
  assignments: number;
  completed: number;
};
type Student = {
  studentId: string;
  studentName: string;
  studentIdentifier: string;
  sectionId: string;
  sectionName: string;
  counselorName: string | null;
  assignments: number;
  completed: number;
  pending: number;
  overdue: number;
  openFollowUps: number;
  openEscalations: number;
};
type Overview = {
  summary: Summary;
  sections: Section[];
  counselors: Counselor[];
  students: Student[];
  totalStudents: number;
  offset: number;
  pageSize: number;
};
type DetailAssignment = {
  assignmentId: string;
  activityId: string;
  title: string;
  category: string;
  deadlineAt: string;
  requiresVerification: boolean;
  completionState: string | null;
  openFollowUpReason: string | null;
  openEscalationStage: string | null;
  openEscalationReason: string | null;
};
type StudentDetail = {
  studentId: string;
  studentName: string;
  assignments: DetailAssignment[];
  total: number;
  offset: number;
};
function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The overview is unavailable.';
}
function Ratio({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div
      className="supervision-ratio"
      role="img"
      aria-label={`${done} of ${total}, ${percent}%`}
    >
      <span style={{ width: `${percent}%` }} />
      <small>
        {done} / {total} ({percent}%)
      </small>
    </div>
  );
}
export function SupervisionBoard() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [department, setDepartment] = useState('');
  const [section, setSection] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  async function showDetail(studentId: string, page = 0) {
    setDetailLoading(true);
    setDetailError('');
    try {
      const body = await dashboardJson<StudentDetail>(
        `/api/supervision/students/${studentId}?department=${department}&offset=${page}`,
      );
      if (!Array.isArray(body.assignments) || typeof body.total !== 'number')
        throw new Error('Student work detail is unavailable.');
      setDetail(body);
    } catch (caught) {
      setDetail(null);
      setDetailError(errorText(caught));
    } finally {
      setDetailLoading(false);
    }
  }
  const load = useCallback(async (dept: string, sec: string, page: number) => {
    if (!dept) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        department: dept,
        offset: String(page),
      });
      if (sec) params.set('section', sec);
      const result = await dashboardJson<Overview>(
        `/api/supervision?${params}`,
      );
      if (
        !result.summary ||
        !Array.isArray(result.sections) ||
        !Array.isArray(result.counselors) ||
        !Array.isArray(result.students)
      )
        throw new Error('Supervision data is incomplete.');
      setOverview(result);
      setOffset(page);
    } catch (caught) {
      setOverview(null);
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void dashboardJson<{ departments: Department[] }>(
      '/api/department-operations',
    )
      .then((body) => {
        const allowed = body.departments.filter((row) => row.supervise);
        setDepartments(allowed);
        setDepartment(allowed[0]?.departmentId ?? '');
      })
      .catch((caught) => {
        setError(errorText(caught));
        setLoading(false);
      });
  }, []);
  useEffect(() => {
    void load(department, section, 0);
  }, [department, section, load]);
  if (!departments.length)
    return (
      <section className="dashboard-panel">
        <p>
          {error ||
            'No department supervision grant is available for this account.'}
        </p>
      </section>
    );
  return (
    <div className="dashboard-stack">
      <section className="dashboard-panel dashboard-stack">
        <div className="dashboard-form-grid">
          <label>
            Department{' '}
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setSection('');
                setDetail(null);
              }}
            >
              {departments.map((row) => (
                <option key={row.departmentId} value={row.departmentId}>
                  {row.departmentName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Section{' '}
            <select
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                setDetail(null);
              }}
            >
              <option value="">All sections</option>
              {overview?.sections.map((row) => (
                <option key={row.sectionId} value={row.sectionId}>
                  {row.sectionName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading && <p>Loading current records…</p>}
        {error && <p role="alert">{error}</p>}
      </section>
      {overview && (
        <>
          <section className="dashboard-panel dashboard-stack">
            <h2>Department progress</h2>
            <p>
              {overview.summary.activeStudents} active students ·{' '}
              {overview.summary.assignments} Activity assignments
            </p>
            <Ratio
              done={
                overview.summary.reported +
                overview.summary.awaitingVerification +
                overview.summary.verified
              }
              total={overview.summary.assignments}
            />
            <div className="supervision-metrics">
              <div>
                <strong>{overview.summary.reported}</strong>
                <span>Self reported</span>
              </div>
              <div>
                <strong>{overview.summary.awaitingVerification}</strong>
                <span>Awaiting verification</span>
              </div>
              <div>
                <strong>{overview.summary.verified}</strong>
                <span>Verified</span>
              </div>
              <div>
                <strong>{overview.summary.pending}</strong>
                <span>Pending</span>
              </div>
              <div>
                <strong>{overview.summary.overdue}</strong>
                <span>Overdue</span>
              </div>
              <div>
                <strong>{overview.summary.openFollowUps}</strong>
                <span>Open follow-ups</span>
              </div>
              <div>
                <strong>{overview.summary.openEscalations}</strong>
                <span>Open escalations</span>
              </div>
            </div>
            <p>
              Counts include current active roster students and their historical
              assignment records. Verification-required reports remain distinct
              from verified work.
            </p>
          </section>
          <section className="dashboard-columns">
            <div className="dashboard-panel dashboard-stack">
              <h2>Sections</h2>
              {overview.sections.map((row) => (
                <button
                  key={row.sectionId}
                  className="dashboard-list-row"
                  type="button"
                  onClick={() => setSection(row.sectionId)}
                >
                  <span>
                    {row.sectionName} · {row.activeStudents} students
                  </span>
                  <Ratio done={row.completed} total={row.assignments} />
                </button>
              ))}
            </div>
            <div className="dashboard-panel dashboard-stack">
              <h2>Current counselors</h2>
              {overview.counselors.map((row) => (
                <div key={row.counselorId} className="dashboard-list-row">
                  <span>
                    {row.name} · {row.studentCount} mapped students
                  </span>
                  <Ratio done={row.completed} total={row.assignments} />
                </div>
              ))}
              {!overview.counselors.length && (
                <p>No current trusted counselor mappings in this view.</p>
              )}
            </div>
          </section>
          <section className="dashboard-panel dashboard-stack">
            <h2>Student drill-down</h2>
            <p>{overview.totalStudents} active students in this scope</p>
            {overview.students.map((row) => (
              <div key={row.studentId} className="dashboard-list-row">
                <div>
                  <strong>{row.studentName}</strong> · {row.studentIdentifier}
                  <p>
                    {row.sectionName} · Counselor:{' '}
                    {row.counselorName ?? 'Unassigned'}
                  </p>
                </div>
                <div>
                  <Ratio done={row.completed} total={row.assignments} />
                  <small>
                    {row.pending} pending · {row.overdue} overdue ·{' '}
                    {row.openFollowUps} follow-ups · {row.openEscalations}{' '}
                    escalations
                  </small>
                  <button
                    type="button"
                    disabled={detailLoading}
                    onClick={() => void showDetail(row.studentId)}
                  >
                    View work
                  </button>
                </div>
              </div>
            ))}
            {detailError && <p role="alert">{detailError}</p>}
            {detailLoading && <p role="status">Loading student work…</p>}
            {detail && (
              <div className="dashboard-card dashboard-stack">
                <h3>{detail.studentName}: Activity and case detail</h3>
                <p>{detail.total} assignments in this department</p>
                {detail.assignments.map((item) => (
                  <div className="dashboard-list-row" key={item.assignmentId}>
                    <div>
                      <strong>{item.title}</strong> · {item.category}
                      <p>
                        Deadline {new Date(item.deadlineAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p>
                        {item.completionState ??
                          (Date.parse(item.deadlineAt) <= Date.now()
                            ? 'Overdue'
                            : 'Pending')}
                        {item.requiresVerification &&
                        item.completionState === 'reported'
                          ? ' · Awaiting verification'
                          : ''}
                      </p>
                      {item.openFollowUpReason && (
                        <p>Open follow-up: {item.openFollowUpReason}</p>
                      )}
                      {item.openEscalationStage && (
                        <p>
                          Open escalation to {item.openEscalationStage}:{' '}
                          {item.openEscalationReason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    disabled={detail.offset === 0 || detailLoading}
                    onClick={() =>
                      void showDetail(
                        detail.studentId,
                        Math.max(0, detail.offset - 50),
                      )
                    }
                  >
                    Previous work
                  </button>{' '}
                  <button
                    type="button"
                    disabled={
                      detail.offset + 50 >= detail.total || detailLoading
                    }
                    onClick={() =>
                      void showDetail(detail.studentId, detail.offset + 50)
                    }
                  >
                    Next work
                  </button>{' '}
                  <button type="button" onClick={() => setDetail(null)}>
                    Close detail
                  </button>
                </div>
              </div>
            )}
            <div>
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() =>
                  void load(department, section, Math.max(0, offset - 50))
                }
              >
                Previous
              </button>{' '}
              <button
                type="button"
                disabled={offset + 50 >= overview.totalStudents || loading}
                onClick={() => void load(department, section, offset + 50)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
