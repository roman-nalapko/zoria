import { useEffect, useSyncExternalStore } from 'react'
import type { EtherController } from '../ether/controller'

export function useEther(controller: EtherController) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )

  useEffect(() => controller.retain(), [controller])
  return snapshot
}
