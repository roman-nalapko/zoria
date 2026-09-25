import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiTransport } from '../api/transport'
import { pollingCoordinator, type PollingCoordinator } from '../api/polling'
import {
  fetchRepository,
  fetchSummary,
  type Repository,
  type Summary,
} from './service'
import { useSession } from '../app/useSession'

export interface ParticipantDashboardState {
  error: string | null
  lastUpdated: number | null
  loading: boolean
  refresh: () => Promise<void>
  repository: Repository | null
  summary: Summary | null
}

export function useParticipantDashboard(
  transport: ApiTransport,
  coordinator: PollingCoordinator = pollingCoordinator,
  pollIntervalMs = 15_000,
): ParticipantDashboardState {
  const { authenticated, token } = useSession()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const repositoryAtRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)

  const loadData = useCallback(
    async (forceRepo = false) => {
      if (!authenticated || isFetchingRef.current) return
      isFetchingRef.current = true
      setLoading(true)
      setError(null)

      try {
        const nextSummary = await fetchSummary(transport, token ?? undefined)
        if (nextSummary) {
          setSummary(nextSummary)
          setLastUpdated(Date.now())

          const repoChanged =
            forceRepo ||
            nextSummary.repositoryAt !== repositoryAtRef.current ||
            repositoryAtRef.current === null

          if (repoChanged) {
            repositoryAtRef.current = nextSummary.repositoryAt
            const nextRepo = await fetchRepository(
              transport,
              token ?? undefined,
            )
            if (nextRepo) {
              setRepository(nextRepo)
            }
          }
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to poll participant data',
        )
      } finally {
        isFetchingRef.current = false
        setLoading(false)
      }
    },
    [authenticated, token, transport],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    await loadData(true)
  }, [loadData])

  // Initial load
  useEffect(() => {
    if (!authenticated) return
    let active = true
    const init = async () => {
      await Promise.resolve()
      if (active) {
        void loadData(true)
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [authenticated, loadData])

  // Periodic polling with visibility state support (T3.5)
  useEffect(() => {
    if (!authenticated) return

    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        coordinator.claim('summary')
      ) {
        void loadData(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      if (coordinator.claim('summary')) {
        void loadData(false)
      }
    }, pollIntervalMs)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [authenticated, coordinator, loadData, pollIntervalMs])

  return {
    error,
    lastUpdated,
    loading,
    refresh,
    repository,
    summary,
  }
}
