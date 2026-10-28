import { DashboardNav } from '../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../identity';
import { GroupWorkspace } from './group-workspace';

export const dynamic = 'force-dynamic';
export default async function GroupsPage() {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  if (identity!.profile.account_kind !== 'staff')
    return (
      <DashboardFailure message="Group management requires an approved staff grant." />
    );
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind="staff"
        responsibilities={identity!.responsibilities}
      />
      <div className="dashboard-intro">
        <p className="dashboard-eyebrow">Department operations</p>
        <h1>Groups</h1>
        <p>
          Manage current membership and publish to a fixed snapshot of assigned
          students.
        </p>
      </div>
      <GroupWorkspace />
    </main>
  );
}
