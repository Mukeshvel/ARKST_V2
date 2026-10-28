import { DashboardNav } from '../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../identity';
import { NotificationInbox } from './notification-inbox';
import { PushControl } from './push-control';

export const dynamic = 'force-dynamic';
export default async function NotificationsPage() {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind={identity!.profile.account_kind}
        responsibilities={identity!.responsibilities}
      />
      <div className="dashboard-intro">
        <p className="dashboard-eyebrow">Updates</p>
        <h1>Inbox</h1>
        <p>Activity assignments and announcements sent to your account.</p>
      </div>
      <NotificationInbox />
      <PushControl />
    </main>
  );
}
