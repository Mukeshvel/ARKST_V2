import Link from 'next/link';
import { DashboardNav } from '../../../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../../../identity';
import { CreatorResults } from './creator-results';

export const dynamic = 'force-dynamic';
export default async function FacultyActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  if (identity!.profile.account_kind !== 'staff')
    return (
      <DashboardFailure message="This view is for approved department staff." />
    );
  const { id } = await params;
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind="staff"
        responsibilities={identity!.responsibilities}
      />
      <p>
        <Link href="/dashboard/faculty">← My activities</Link>
      </p>
      <CreatorResults activityId={id} />
    </main>
  );
}
