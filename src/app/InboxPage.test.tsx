import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InboxPage } from './InboxPage'
import { SessionProvider } from './SessionContext'
import { _resetVaultForTest, setSession } from '../auth/session-vault'
import type { ApiTransport } from '../api/transport'
import type { Message } from '../inbox/service'

const mockMessage: Message = {
  body: 'Your repository has passed review.\nCheck .zoria on main.',
  createdAt: '2026-09-25T05:02:40.000Z',
  id: 'msg-1',
  kind: 'message',
  messageId: null,
  notice: {
    accessStatus: 'verified',
    reason: 'Marker found',
    type: 'repository',
    url: 'https://github.com/roman-nalapko/zoria',
  },
  readAt: null,
  stageId: null,
  title: 'Repository review verified',
}

afterEach(() => {
  cleanup()
  _resetVaultForTest()
})

beforeEach(() => {
  _resetVaultForTest()
})

describe('InboxPage', () => {
  it('renders messages and displays selected message with unread status', async () => {
    setSession('tok-inbox', {
      displayName: 'Roman',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      sessionId: 's1',
      username: 'roman-nalapko',
    })

    const requestMock = vi.fn().mockImplementation((path: string) => {
      if (path === '/inbox?limit=10&offset=0') {
        return Promise.resolve({
          body: JSON.stringify({
            items: [mockMessage],
            nextOffset: null,
          }),
          ok: true,
          status: 200,
        })
      }
      if (path === '/inbox/msg-1') {
        return Promise.resolve({
          body: JSON.stringify({ message: mockMessage }),
          ok: true,
          status: 200,
        })
      }
      return Promise.resolve({ body: '{}', ok: true, status: 200 })
    })

    const transport = { request: requestMock } as unknown as ApiTransport

    render(
      <SessionProvider>
        <InboxPage transport={transport} />
      </SessionProvider>,
    )

    // Unread counter shows 1 unread
    await vi.waitFor(() => {
      expect(screen.getByText('(1 unread)')).toBeInTheDocument()
      expect(screen.getAllByText('Repository review verified')).toHaveLength(2)
    })

    // Notice badge is rendered
    expect(screen.getByText(/repository notice/i)).toBeInTheDocument()
    expect(screen.getByText(/marker found/i)).toBeInTheDocument()

    // Mark as read button is visible
    expect(
      screen.getByRole('button', { name: /mark as read/i }),
    ).toBeInTheDocument()
  })

  it('marks message as read on click', async () => {
    setSession('tok-inbox', {
      displayName: 'Roman',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      sessionId: 's1',
      username: 'roman-nalapko',
    })

    const requestMock = vi.fn().mockImplementation((path: string) => {
      if (path.startsWith('/inbox?')) {
        return Promise.resolve({
          body: JSON.stringify({ items: [mockMessage], nextOffset: null }),
          ok: true,
          status: 200,
        })
      }
      if (path === '/inbox/msg-1/read') {
        return Promise.resolve({ body: '{}', ok: true, status: 204 })
      }
      if (path === '/inbox/msg-1') {
        return Promise.resolve({
          body: JSON.stringify({ message: mockMessage }),
          ok: true,
          status: 200,
        })
      }
      return Promise.resolve({ body: '{}', ok: true, status: 200 })
    })

    const transport = { request: requestMock } as unknown as ApiTransport

    render(
      <SessionProvider>
        <InboxPage transport={transport} />
      </SessionProvider>,
    )

    await vi.waitFor(() => {
      expect(
        screen.getByRole('button', { name: /mark as read/i }),
      ).toBeInTheDocument()
    })

    const markBtn = screen.getByRole('button', { name: /mark as read/i })
    fireEvent.click(markBtn)

    await vi.waitFor(
      () => {
        expect(requestMock).toHaveBeenCalledWith(
          '/inbox/msg-1/read',
          expect.objectContaining({
            method: 'POST',
            token: 'tok-inbox',
          }),
        )
        // "Mark as read" button disappears, replaced with read timestamp
        expect(
          screen.queryByRole('button', { name: /mark as read/i }),
        ).toBeNull()
        expect(screen.getByText(/read:/i)).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })
})
