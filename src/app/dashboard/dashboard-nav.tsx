import Link from 'next/link';
import type { Responsibility } from '@/data/identity';
import { InboxLink } from './inbox-link';

export function currentCounselor(responsibilities: Responsibility[]) {
  const now = Date.now();
  return responsibilities.some(
    (item) =>
      item.role === 'counselor' &&
      Date.parse(item.starts_at) <= now &&
      (!item.ends_at || now < Date.parse(item.ends_at)),
  );
}

export function DashboardNav({
  accountKind,
  responsibilities,
}: {
  accountKind: 'student' | 'staff';
  responsibilities: Responsibility[];
}) {
  return (
    <header className="dashboard-header">
      <Link className="dashboard-brand" href="/dashboard">
        ARKST
      </Link>
      <nav aria-label="Academic operations" className="dashboard-nav">
        {accountKind === 'student' ? (
          <Link href="/dashboard/student">My activities</Link>
        ) : (
          <>
            <Link href="/dashboard/faculty">Faculty activities</Link>
            <Link href="/dashboard/groups">Groups</Link>
            <Link href="/dashboard/calendar">Calendar</Link>
            <Link href="/dashboard/supervision">Overview</Link>
            {currentCounselor(responsibilities) && (
              <Link href="/dashboard/counselor">Counselor view</Link>
            )}
          </>
        )}
        <Link href="/dashboard/catch-up">Catch-up</Link>
        <Link href="/dashboard/attention">
          {accountKind === 'staff' ? 'Attention' : 'Escalations'}
        </Link>
        <InboxLink />
        <Link href="/profile">Profile</Link>
        <form action="/auth/logout" method="post">
          <button className="dashboard-text-button" type="submit">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
