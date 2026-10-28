'use client';

import { useEffect, useState } from 'react';
import { dashboardJson } from '../dashboard-data';

type Counts = {
  counselorId: string | null;
  name: string;
  assigned: number;
  reported: number;
  awaitingVerification: number;
  verified: number;
  pending: number;
  reportedPercent: number;
};
type Report = {
  activities: { id: string; title: string }[];
  summary?: Counts;
  counselors: Counts[];
  students: {
    studentId: string;
    studentName: string;
    studentIdentifier: string;
    counselorName: string | null;
    completionState: string | null;
    requiresVerification: boolean;
  }[];
  totalStudents: number;
};

export function ActivitySupervision({
  department,
  section,
}: {
  department: string;
  section: string;
}) {
  const [activity, setActivity] = useState('');
  const [offset, setOffset] = useState(0);
  const [options, setOptions] = useState<Report['activities']>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ department, offset: String(offset) });
    if (section) params.set('section', section);
    if (activity) params.set('activity', activity);
    void dashboardJson<Report>(`/api/supervision/activities?${params}`)
      .then((body) => {
        if (!current) return;
        if (
          !Array.isArray(body.activities) ||
          (activity &&
            (!body.summary ||
              !Array.isArray(body.counselors) ||
              !Array.isArray(body.students)))
        )
          throw new Error('Activity supervision data is incomplete.');
        setOptions(body.activities);
        setReport(activity ? body : null);
        setLoading(false);
      })
      .catch((caught) => {
        if (!current) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'Activity results unavailable.',
        );
        setReport(null);
        setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [department, section, activity, offset]);
  function changePage(page: number) {
    setReport(null);
    setError('');
    setLoading(true);
    setOffset(page);
  }
  return (
    <section className="dashboard-panel dashboard-stack">
      <h2>Selected Activity: counselor results</h2>
      <label>
        Activity{' '}
        <select
          value={activity}
          onChange={(event) => {
            setActivity(event.target.value);
            changePage(0);
          }}
        >
          <option value="">Select an Activity</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      {loading && <p role="status">Loading Activity results…</p>}
      {error && <p role="alert">{error}</p>}
      {report?.summary && (
        <>
          <p>
            Current active roster and trusted counselor allocations. Reported
            includes all submissions; it does not mean verified. Awaiting
            verification and verified are subsets of reported. Pending includes
            overdue work. Totals cover every assigned student in the selected
            scope, not just this page.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <caption>
                {section ? 'Selected section' : 'Department-wide'} results for
                the selected Activity
              </caption>
              <thead>
                <tr>
                  {[
                    'Counselor',
                    'Assigned',
                    'Reported',
                    'Awaiting Verification',
                    'Verified',
                    'Pending',
                    'Reported %',
                  ].map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ...report.counselors,
                  {
                    ...report.summary,
                    name: section ? 'Section total' : 'Department total',
                  },
                ].map((row, index) => (
                  <tr key={`${row.counselorId ?? 'unmapped'}-${index}`}>
                    <th scope="row">{row.name}</th>
                    <td>{row.assigned}</td>
                    <td>{row.reported}</td>
                    <td>{row.awaitingVerification}</td>
                    <td>{row.verified}</td>
                    <td>{row.pending}</td>
                    <td>{row.reportedPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Assigned student results ({report.totalStudents})</summary>
            {report.students.map((student) => (
              <div className="dashboard-list-row" key={student.studentId}>
                <span>
                  {student.studentName} · {student.studentIdentifier} ·{' '}
                  {student.counselorName ?? 'Unmapped'}
                </span>
                <span>
                  {student.completionState === 'verified'
                    ? 'Verified'
                    : student.completionState === 'reported'
                      ? student.requiresVerification
                        ? 'Awaiting verification'
                        : 'Reported'
                      : 'Pending'}
                </span>
              </div>
            ))}
            <button
              type="button"
              disabled={loading || offset === 0}
              onClick={() => changePage(Math.max(0, offset - 50))}
            >
              Previous assigned students
            </button>{' '}
            <button
              type="button"
              disabled={loading || offset + 50 >= report.totalStudents}
              onClick={() => changePage(offset + 50)}
            >
              Next assigned students
            </button>
          </details>
        </>
      )}
    </section>
  );
}
