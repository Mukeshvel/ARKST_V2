'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Directory = {
  profile: {
    teaching_status: string;
    designation: string;
    subjects: string[];
  } | null;
  teachingStatus: string | null;
  designation: string;
  subjects: string[];
  sections: { id: string; name: string }[];
  sectionIds: string[];
};

export function StaffDirectoryEditor() {
  const [data, setData] = useState<Directory | null>(null);
  const [status, setStatus] = useState('Loading your saved staff details…');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void fetch('/api/staff-directory', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? 'Could not load staff details.');
        setData(body as Directory);
        setStatus('Saved values loaded from the department database.');
      })
      .catch((error) =>
        setStatus(
          error instanceof Error ? error.message : 'Staff profile unavailable.',
        ),
      );
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSaving(true);
    setStatus('Saving…');
    const form = new FormData(event.currentTarget);
    const profile = {
      teachingStatus: form.get('teachingStatus'),
      designation: form.get('designation'),
      subjects: String(form.get('subjects') ?? '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
      sectionIds: data.sections
        .filter((section) => form.getAll('sectionIds').includes(section.id))
        .map((section) => section.id),
    };
    try {
      const response = await fetch('/api/staff-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Save failed.');
      setData(body as Directory);
      setStatus('Saved. The displayed values were reloaded from PostgreSQL.');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Save failed; reload before retrying.',
      );
    } finally {
      setSaving(false);
    }
  }
  if (!data)
    return (
      <section aria-live="polite">
        <h2>Staff details</h2>
        <p role="status">{status}</p>
      </section>
    );
  return (
    <section aria-labelledby="staff-details-heading">
      <h2 id="staff-details-heading">
        Your teaching details and section preferences
      </h2>
      <p>
        These descriptive preferences do not grant activity, counselor, HOD or
        admin permissions.
      </p>
      <form className="identity-form" onSubmit={submit}>
        <label>
          Current teaching status
          <select
            name="teachingStatus"
            defaultValue={data.teachingStatus ?? 'teaching'}
          >
            <option value="teaching">Teaching</option>
            <option value="non_teaching">Non-teaching</option>
          </select>
        </label>
        <label>
          Descriptive designation
          <input
            name="designation"
            maxLength={120}
            defaultValue={data.designation}
            placeholder="e.g. Placement Coordinator"
          />
        </label>
        <label>
          Subjects, one per line
          <textarea
            name="subjects"
            maxLength={2020}
            defaultValue={data.subjects.join('\n')}
            rows={4}
          />
        </label>
        <fieldset>
          <legend>Sections you work with</legend>
          {data.sections.map((section) => (
            <label key={section.id}>
              <input
                type="checkbox"
                name="sectionIds"
                value={section.id}
                defaultChecked={data.sectionIds.includes(section.id)}
              />
              {section.name}
            </label>
          ))}
          {!data.sections.length && (
            <p>
              No department sections are available to your current staff
              assignment.
            </p>
          )}
        </fieldset>
        <button disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save staff details'}
        </button>
      </form>
      <p aria-live="polite" role="status">
        {status}
      </p>
    </section>
  );
}
