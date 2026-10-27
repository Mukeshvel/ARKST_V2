import { DashboardNav, currentCounselor } from '../../../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../../../identity';
import { CounselorResults } from './counselor-results';

export const dynamic = 'force-dynamic';
export default async function CounselorActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  if (
    identity!.profile.account_kind !== 'staff' ||
    !currentCounselor(identity!.responsibilities)
  )
    return (
      <DashboardFailure message="A current approved counselor responsibility is required." />
    );
  const { id } = await params;
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind="staff"
        responsibilities={identity!.responsibilities}
      />
      <CounselorResults activityId={id} />
    </main>
  );
}
