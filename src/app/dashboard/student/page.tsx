import { DashboardNav } from '../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../identity';
import { StudentDashboard } from './student-dashboard';

export const dynamic = 'force-dynamic';
export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string }>;
}) {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  if (identity!.profile.account_kind !== 'student')
    return (
      <DashboardFailure message="This view is for provisioned students." />
    );
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind="student"
        responsibilities={identity!.responsibilities}
      />
      <div className="dashboard-intro">
        <p className="dashboard-eyebrow">Student workspace</p>
        <h1>My activities</h1>
        <p>
          Assigned work, deadlines and submission status from your student
          record.
        </p>
      </div>
      <StudentDashboard
        studentId={identity!.profile.id}
        focusedActivityId={(await searchParams).activity}
      />
    </main>
  );
}
