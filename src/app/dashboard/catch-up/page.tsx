import { DashboardNav } from '../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../identity';
import { CatchUpBoard } from './catch-up-board';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export default async function CatchUpPage() {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind={identity!.profile.account_kind as 'student' | 'staff'}
        responsibilities={identity!.responsibilities}
      />
      <div className="dashboard-intro">
        <p className="dashboard-eyebrow">Academic communication</p>
        <h1>Catch-up requests</h1>
        <p>
          Students report missed information. Authorized staff review it and
          publish an official announcement to a permitted audience.
        </p>
        {identity!.profile.account_kind === 'student' && (
          <p>
            Recover existing information in{' '}
            <Link href="/dashboard/student">My activities</Link> and{' '}
            <Link href="/dashboard/notifications">Inbox</Link>. Past deadlines
            remain closed unless an authorized staff member publishes a new
            Activity.
          </p>
        )}
      </div>
      <CatchUpBoard
        kind={identity!.profile.account_kind as 'student' | 'staff'}
      />
    </main>
  );
}
