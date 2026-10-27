import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwnIdentity } from '@/auth/identity';
import { publicIdentityError } from '@/auth/errors';
import { StaffDirectoryEditor } from './staff-directory-editor';

export const dynamic = 'force-dynamic';
export default async function ProfilePage() {
  let identity;
  try {
    identity = await requireOwnIdentity();
  } catch (error) {
    const failure = publicIdentityError(error);
    if (failure.status === 401) redirect('/login');
    return (
      <main>
        <h1>Profile unavailable</h1>
        <p role="alert">{failure.message}</p>
        <Link href="/login">Return to sign in</Link>
        {failure.status === 403 && (
          <form action="/auth/logout" method="post">
            <button type="submit">Sign out</button>
          </form>
        )}
      </main>
    );
  }
  const { profile, responsibilities } = identity;
  return (
    <main>
      <Link href="/">ARKST foundation</Link>
      <h1>Your profile</h1>
      <p>Verified identity · database-backed profile</p>
      <p>
        <Link href="/dashboard">Open my dashboard</Link>
      </p>
      <dl>
        <dt>Name</dt>
        <dd>{profile.display_name}</dd>
        <dt>Account</dt>
        <dd>{profile.account_kind}</dd>
        {profile.staff_classification && (
          <>
            <dt>Staff classification</dt>
            <dd>{profile.staff_classification.replace('_', '-')}</dd>
          </>
        )}
        <dt>Status</dt>
        <dd>Active</dd>
      </dl>
      <h2>Current responsibilities</h2>
      {responsibilities.length ? (
        <ul>
          {responsibilities.map((role) => (
            <li key={role.id}>
              {role.role.replaceAll('_', ' ')} — scope {role.scope_id}
            </li>
          ))}
        </ul>
      ) : (
        <p>No current staff responsibilities assigned.</p>
      )}
      {profile.account_kind === 'staff' && <StaffDirectoryEditor />}
      <p>
        Self-service details describe your current work preferences. They do not
        grant activity, counselor, HOD or admin permissions.
      </p>
      <form action="/auth/logout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
