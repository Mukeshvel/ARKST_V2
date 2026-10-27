'use client';

import { useEffect, useState } from 'react';
import { dashboardJson, formatWhen } from '../../dashboard-data';

type Announcement = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};
export function AnnouncementView({ id }: { id: string }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void dashboardJson<{ announcement: Announcement }>(
      `/api/announcements/${id}`,
    )
      .then((body) => {
        if (active) {
          if (!body.announcement)
            throw new Error('Announcement is unavailable.');
          setAnnouncement(body.announcement);
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Announcement is unavailable.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <section className="dashboard-panel">
      {loading && <p role="status">Loading announcement…</p>}
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
      {announcement && (
        <>
          <p className="dashboard-eyebrow">
            Announcement · {formatWhen(announcement.created_at)}
          </p>
          <h1>{announcement.title}</h1>
          <p className="dashboard-description">{announcement.message}</p>
          <p className="dashboard-muted">
            This is information only; it does not require a completion report.
          </p>
        </>
      )}
    </section>
  );
}
