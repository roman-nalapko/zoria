import type { EtherFrame } from './verifier'

export interface EtherTiming {
  closesAtMs: number | null
  opensAtMs: number | null
  serverOffsetMs: number
}

export function deriveEtherTiming(
  frame: EtherFrame,
  receivedAtMs: number,
): EtherTiming {
  const frameAtMs = Date.parse(frame.at)
  const opensAtMs = frame.window
    ? Date.parse(frame.window.opensAt)
    : frame.harbinger
      ? frameAtMs + frame.harbinger.opensIn * 1000
      : null
  const closesAtMs = frame.window ? Date.parse(frame.window.closesAt) : null

  return {
    closesAtMs:
      closesAtMs !== null && !Number.isNaN(closesAtMs) ? closesAtMs : null,
    opensAtMs:
      opensAtMs !== null && !Number.isNaN(opensAtMs) ? opensAtMs : null,
    serverOffsetMs: frameAtMs - receivedAtMs,
  }
}

export function formatCountdown(targetMs: number, serverNowMs: number): string {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((targetMs - serverNowMs) / 1000),
  )
  const days = Math.floor(remainingSeconds / 86_400)
  const hours = Math.floor((remainingSeconds % 86_400) / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60
  const clock = [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':')
  return days > 0 ? `${days.toString()}d ${clock}` : clock
}

export function formatLocalTime(valueMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'long',
  }).format(valueMs)
}
