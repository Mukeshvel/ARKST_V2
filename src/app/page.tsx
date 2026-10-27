import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <header>
        <span className="brand">ARKST</span>
        <span className="badge">Academic Activity workspace</span>
      </header>
      <section aria-labelledby="intro">
        <p className="eyebrow">Academic operations</p>
        <h1 id="intro">
          A dependable start.
          <br />A clearer path ahead.
        </h1>
        <p className="intro">
          Student assignments, staff publication and counselor monitoring use
          the same protected Activity records. Sign in with an approved account
          to view the data available to you.
        </p>
      </section>
      <section className="grid" aria-label="Implementation status">
        <article>
          <p className="eyebrow">Implemented</p>
          <h2>Codebase foundation</h2>
          <p>
            Application structure, strict TypeScript, automated rule tests and
            architectural documentation.
          </p>
        </article>
        <article>
          <p className="eyebrow">Protected</p>
          <h2>Identity &amp; storage</h2>
          <p>
            Identity and Activity views require a provisioned account and a
            configured Supabase environment. This public page shows no private
            academic data.
          </p>
          <Link href="/login">Sign in</Link>
        </article>
        <article>
          <p className="eyebrow">Operational views</p>
          <h2>Assigned activities</h2>
          <p>
            Students can report assigned work. Approved staff can publish to
            sections and monitor results. Counselors see only mapped students.
          </p>
          <Link href="/dashboard">Open dashboard</Link>
        </article>
      </section>
      <footer>
        No private records are shown on this public page. Group targeting,
        notifications and catch-up remain future work.
      </footer>
    </main>
  );
}
