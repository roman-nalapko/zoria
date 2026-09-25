/**
 * Placeholder pages for routes that will be implemented in later milestones.
 * Each exports a named component matching its route name.
 */

function Placeholder({
  title,
  milestone,
}: {
  title: string
  milestone: string
}) {
  return (
    <section className="page placeholder-page" aria-labelledby="page-title">
      <div className="section-heading">
        <p className="eyebrow">{title}</p>
        <h2 id="page-title">{title}</h2>
        <p className="placeholder-notice">
          Coming in {milestone}. Game specs release: 2026-09-28.
        </p>
      </div>
    </section>
  )
}

export function EtherPage() {
  return <Placeholder title="Ether receiver" milestone="Milestone 1.9" />
}

export function NotFoundPage() {
  return (
    <section className="page not-found-page" aria-labelledby="page-title">
      <div className="section-heading">
        <p className="eyebrow">404</p>
        <h2 id="page-title">Page not found</h2>
        <p>The requested route does not exist.</p>
      </div>
    </section>
  )
}
