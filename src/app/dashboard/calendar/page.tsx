import { DashboardNav } from '../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../identity';
import { CalendarWorkspace } from './calendar-workspace';

export const dynamic = 'force-dynamic';
export default async function CalendarPage() {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  if (identity!.profile.account_kind !== 'staff')
    return (
      <DashboardFailure message="Calendar management requires an approved staff grant." />
    );
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind="staff"
        responsibilities={identity!.responsibilities}
      />
      <div className="dashboard-intro">
        <p className="dashboard-eyebrow">Academic operations</p>
        <h1>Recurring calendar</h1>
        <p>
          Configure external test windows, blackouts and explicit generation
          decisions. New schedules start paused.
        </p>
      </div>
      <CalendarWorkspace />
    </main>
  );
}
