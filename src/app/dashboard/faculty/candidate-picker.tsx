'use client';

import { useCallback, useEffect, useState } from 'react';
import { dashboardJson } from '../dashboard-data';

export type Candidate = {
  studentId: string;
  sectionId: string;
  name: string;
  rollNumber: string;
};

export function CandidatePicker({
  departmentId,
  category,
  counselingOnly,
  selected,
  onChange,
}: {
  departmentId: string;
  category: string;
  counselingOnly: boolean;
  selected: Candidate[];
  onChange: (value: Candidate[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(
    async (query: string, nextOffset: number) => {
      if (!departmentId || !category) return;
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        department: departmentId,
        category,
        counselingOnly: String(counselingOnly),
        search: query,
        offset: String(nextOffset),
      });
      try {
        const body = await dashboardJson<{
          students: Candidate[];
          total: number;
        }>(`/api/activities/candidates?${params}`);
        if (!Array.isArray(body.students) || typeof body.total !== 'number')
          throw new Error('Eligible students are unavailable.');
        setRows(body.students);
        setTotal(body.total);
        setOffset(nextOffset);
      } catch (cause) {
        setRows([]);
        setTotal(0);
        setError(
          cause instanceof Error
            ? cause.message
            : 'Eligible students are unavailable.',
        );
      } finally {
        setLoading(false);
      }
    },
    [departmentId, category, counselingOnly],
  );

  useEffect(() => {
    void load('', 0);
  }, [load]);

  function toggle(row: Candidate) {
    onChange(
      selected.some((item) => item.studentId === row.studentId)
        ? selected.filter((item) => item.studentId !== row.studentId)
        : [...selected, row],
    );
  }

  return (
    <div className="dashboard-candidates">
      <label>
        Find eligible students by name or roll number
        <input
          value={search}
          maxLength={80}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void load(search, 0);
            }
          }}
        />
      </label>
      <button
        type="button"
        className="dashboard-secondary"
        disabled={loading}
        onClick={() => void load(search, 0)}
      >
        Search
      </button>
      <p className="dashboard-muted">
        {selected.length} selected. Search and page through the current
        authorized roster.
      </p>
      {selected.length > 0 && (
        <ul className="dashboard-selected-students">
          {selected.map((row) => (
            <li key={row.studentId}>
              {row.name} · {row.rollNumber}{' '}
              <button
                type="button"
                className="dashboard-secondary"
                aria-label={`Remove ${row.name}`}
                onClick={() => toggle(row)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading eligible students…</p>
      ) : error ? null : rows.length ? (
        <ul className="dashboard-roster">
          {rows.map((row) => (
            <li key={row.studentId}>
              <label className="dashboard-checkbox">
                <input
                  type="checkbox"
                  checked={selected.some(
                    (item) => item.studentId === row.studentId,
                  )}
                  onChange={() => toggle(row)}
                />
                <span>
                  {row.name} · {row.rollNumber}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-empty">
          No eligible students match this search.
        </p>
      )}
      {!error && (
        <div className="dashboard-actions dashboard-pagination">
          <button
            type="button"
            className="dashboard-secondary"
            disabled={loading || offset === 0}
            onClick={() => void load(search, Math.max(0, offset - 50))}
          >
            Previous
          </button>
          <span>
            {total} eligible · Page {Math.floor(offset / 50) + 1}
          </span>
          <button
            type="button"
            className="dashboard-secondary"
            disabled={loading || offset + 50 >= total}
            onClick={() => void load(search, offset + 50)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
