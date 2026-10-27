import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <header>
        <span className="brand">ARKST</span>
        <span className="badge">Milestone 3A · Activity API</span>
      </header>
      <section aria-labelledby="intro">
        <p className="eyebrow">Academic operations</p>
        <h1 id="intro">
          A dependable start.
          <br />A clearer path ahead.
        </h1>
        <p className="intro">
          The foundation for student academic activities, monitoring, follow-up
          and catch-up. This is a development foundation, not a functioning
          academic dashboard.
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
          <p className="eyebrow">Local configuration required</p>
          <h2>Identity &amp; storage</h2>
          <p>
            Identity and Activity APIs have passed isolated local database
            tests. A configured local Supabase stack is required to use them. No
            live academic data is displayed here.
          </p>
          <Link href="/login">Local identity sign-in</Link>
        </article>
        <article>
          <p className="eyebrow">API implemented</p>
          <h2>Direct activities</h2>
          <p>
            Authorized direct assignment, completion reporting and staff
            verification persist in PostgreSQL. Dashboards, group targeting and
            announcements remain future work.
          </p>
        </article>
      </section>
      <footer>
        No live academic data. This page is a development status page.
      </footer>
    </main>
  );
}
