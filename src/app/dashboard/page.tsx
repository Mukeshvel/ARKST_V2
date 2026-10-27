import { redirect } from 'next/navigation';
import { dashboardIdentity, DashboardFailure } from './identity';

export const dynamic = 'force-dynamic';
export default async function DashboardHome() {
  const { identity, failure } = await dashboardIdentity();
  if (failure) return <DashboardFailure message={failure.message} />;
  redirect(
    identity!.profile.account_kind === 'student'
      ? '/dashboard/student'
      : '/dashboard/faculty',
  );
}
