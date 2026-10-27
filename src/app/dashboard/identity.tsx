import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwnIdentity } from '@/auth/identity';
import { publicIdentityError } from '@/auth/errors';

export async function dashboardIdentity() {
  try {
    return { identity: await requireOwnIdentity(), failure: null };
  } catch (error) {
    const failure = publicIdentityError(error);
    if (failure.status === 401) redirect('/login');
    return { identity: null, failure };
  }
}

export function DashboardFailure({ message }: { message: string }) {
  return (
    <main className="dashboard-page">
      <h1>Dashboard unavailable</h1>
      <p role="alert">{message}</p>
      <Link href="/profile">Return to profile</Link>
    </main>
  );
}
