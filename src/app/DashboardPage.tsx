import { useSession } from './useSession'
import { useEther } from './useEther'
import type { EtherController } from '../ether/controller'
import { etherController } from './runtime'

export interface DashboardPageProps {
  controller?: EtherController
}

/**
 * Dashboard: shows session summary and ether receiver status.
 * Expanded further in Milestone 1.3.
 */
export function DashboardPage({
  controller = etherController,
}: DashboardPageProps) {
  const { info } = useSession()
  const snapshot = useEther(controller)

  return (
    <section className="page dashboard-page" aria-labelledby="dashboard-title">
      <div className="section-heading">
        <p className="eyebrow">Dashboard</p>
        <h2 id="dashboard-title">
          Welcome{info ? `, ${info.displayName}` : ''}
        </h2>
        <p>
          Repository access status: <strong>verified</strong>. Ether receiver:{' '}
          <strong>{snapshot.status}</strong>.
        </p>
      </div>
    </section>
  )
}
