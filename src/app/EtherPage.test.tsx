import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EtherController } from '../ether/controller'
import type { EtherFrame, EtherKey } from '../ether/verifier'
import { EtherPage } from './EtherPage'
import type { ApiTransport } from '../api/transport'

const TRAINING_KEY: EtherKey = {
  algorithm: 'Ed25519',
  fingerprint:
    'f3a436df65614f08635f18fe0f64f145285203f1faa2905ecb25ffb90969a7de',
  key: 'f3a436df65614f08',
  publicKey: 'GQgsc8G1w5aXEnExpTBE597_7acc0vGKMAT5wUW4L5g',
}

const mockFrame: EtherFrame = {
  at: '2026-09-24T03:00:00.000Z',
  fragment: {
    n: 1,
    of: 2,
    text: 'Ancient ruins awaken.',
  },
  harbinger: {
    opensIn: 7200,
    text: { uk: 'Початок передачі...' },
  },
  kind: 'signal',
  onAir: 42,
  phase: 'window',
  station: 'zoria',
  v: 1,
  window: {
    closesAt: '2026-09-24T12:00:00.000Z',
    opensAt: '2026-09-24T03:00:00.000Z',
  },
}

afterEach(cleanup)

describe('EtherPage', () => {
  it('renders live frame telemetry, harbinger countdown, and fragment progress', () => {
    const transport = { request: vi.fn() } as unknown as ApiTransport
    const controller = new EtherController(transport, TRAINING_KEY.fingerprint)

    vi.spyOn(controller, 'getSnapshot').mockReturnValue({
      consecutiveFailures: 0,
      frame: mockFrame,
      keyFingerprint: TRAINING_KEY.fingerprint,
      lastCheckedAt: 1000,
      message: null,
      nextPollAt: null,
      receivedAt: 1000,
      status: 'signal',
    })
    vi.spyOn(controller, 'getKey').mockReturnValue(TRAINING_KEY)

    render(<EtherPage controller={controller} transport={transport} />)

    expect(screen.getByText('Airwaves & Telemetry')).toBeInTheDocument()
    expect(screen.getByText('Carrier Phase')).toBeInTheDocument()
    expect(screen.getByText('window')).toBeInTheDocument()
    expect(screen.getByText('42 participants')).toBeInTheDocument()
    expect(screen.getByText(/Harbinger Signal Detected/i)).toBeInTheDocument()
    expect(screen.getByText('02:00:00')).toBeInTheDocument()
    expect(screen.getByText('«Початок передачі...»')).toBeInTheDocument()

    // Fragment assembler shows 1 / 2 pieces
    expect(screen.getByText('1 / 2 pieces')).toBeInTheDocument()
  })

  it('queries airwave roll when button is clicked', async () => {
    const rollMock = vi.fn().mockResolvedValue({
      body: '{"error":{"code":"not-found"}}',
      ok: false,
      status: 404,
    })
    const transport = { request: rollMock } as unknown as ApiTransport
    const controller = new EtherController(transport, TRAINING_KEY.fingerprint)
    vi.spyOn(controller, 'getKey').mockReturnValue(TRAINING_KEY)

    render(<EtherPage controller={controller} transport={transport} />)

    const queryBtn = screen.getByRole('button', { name: /query airwave roll/i })
    expect(queryBtn).toBeInTheDocument()
    queryBtn.click()

    await vi.waitFor(() => {
      expect(rollMock).toHaveBeenCalledWith('/ether/roll')
      expect(screen.getByText('http-404')).toBeInTheDocument()
    })
  })
})
