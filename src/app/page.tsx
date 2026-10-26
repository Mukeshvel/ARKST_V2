import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <header>
        <span className="brand">ARKST</span>
        <span className="badge">Milestone 02 · Identity foundation</span>
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
            Supabase session and profile code is implemented. Real database
            verification requires an isolated local Supabase stack. No live
            academic data is displayed here.
          </p>
          <Link href="/login">Local identity sign-in</Link>
        </article>
        <article>
          <p className="eyebrow">Planned</p>
          <h2>Academic workflows</h2>
          <p>
            Activity creation, targeting, completion, verification and
            announcements will be implemented in later milestones.
          </p>
        </article>
      </section>
      <footer>
        No live academic data. Academic workflows are not implemented.
      </footer>
    </main>
  );
}
