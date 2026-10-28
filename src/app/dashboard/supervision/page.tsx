import { DashboardNav } from '../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../identity';
import { SupervisionBoard } from './supervision-board';

export const dynamic = 'force-dynamic';
export default async function SupervisionPage() {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  if (identity!.profile.account_kind !== 'staff')
    return (
      <DashboardFailure message="Department supervision requires an approved staff grant." />
    );
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind="staff"
        responsibilities={identity!.responsibilities}
      />
      <div className="dashboard-intro">
        <p className="dashboard-eyebrow">Department operations</p>
        <h1>Supervisory overview</h1>
        <p>
          Current active students and existing Activity, follow-up and
          escalation records.
        </p>
      </div>
      <SupervisionBoard />
    </main>
  );
}
