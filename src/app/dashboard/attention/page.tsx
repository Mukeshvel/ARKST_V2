import { DashboardNav } from '../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../identity';
import { AttentionBoard } from './attention-board';

export const dynamic = 'force-dynamic';
export default async function AttentionPage() {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind={identity!.profile.account_kind as 'student' | 'staff'}
        responsibilities={identity!.responsibilities}
      />
      <div className="dashboard-intro">
        <p className="dashboard-eyebrow">Follow-up and escalation</p>
        <h1>
          {identity!.profile.account_kind === 'staff'
            ? 'Attention needed'
            : 'My escalations'}
        </h1>
        <p>
          Current pending work is explained from recorded deadlines, follow-ups,
          catch-up requests and assignment history.
        </p>
      </div>
      <AttentionBoard
        kind={identity!.profile.account_kind as 'student' | 'staff'}
      />
    </main>
  );
}
