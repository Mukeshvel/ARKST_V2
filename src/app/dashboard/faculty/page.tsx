import { DashboardNav } from '../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../identity';
import { FacultyDashboard } from './faculty-dashboard';

export const dynamic = 'force-dynamic';
export default async function FacultyPage() {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  if (identity!.profile.account_kind !== 'staff')
    return (
      <DashboardFailure message="This view is for approved department staff." />
    );
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind="staff"
        responsibilities={identity!.responsibilities}
      />
      <div className="dashboard-intro">
        <p className="dashboard-eyebrow">Faculty and coordinator workspace</p>
        <h1>Activities</h1>
        <p>
          Create for authorized sections and monitor your own published work.
        </p>
      </div>
      <FacultyDashboard />
    </main>
  );
}
