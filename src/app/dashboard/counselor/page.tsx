import { DashboardNav, currentCounselor } from '../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../identity';
import { CounselorDashboard } from './counselor-dashboard';

export const dynamic = 'force-dynamic';
export default async function CounselorPage() {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  if (
    identity!.profile.account_kind !== 'staff' ||
    !currentCounselor(identity!.responsibilities)
  )
    return (
      <DashboardFailure message="A current approved counselor responsibility is required for this view." />
    );
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind="staff"
        responsibilities={identity!.responsibilities}
      />
      <div className="dashboard-intro">
        <p className="dashboard-eyebrow">Counselor workspace</p>
        <h1>My counseling students</h1>
        <p>
          Current administrator-mapped students and their assigned Activity
          status, regardless of who published the work.
        </p>
      </div>
      <CounselorDashboard />
    </main>
  );
}
