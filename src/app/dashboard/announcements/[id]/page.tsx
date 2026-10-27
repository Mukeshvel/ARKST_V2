import { DashboardNav } from '../../dashboard-nav';
import { dashboardIdentity, DashboardFailure } from '../../identity';
import { AnnouncementView } from './announcement-view';

export const dynamic = 'force-dynamic';
export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  const { id } = await params;
  return (
    <main className="dashboard-page">
      <DashboardNav
        accountKind={identity!.profile.account_kind}
        responsibilities={identity!.responsibilities}
      />
      <AnnouncementView id={id} />
    </main>
  );
}
