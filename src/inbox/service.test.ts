import { describe, expect, it, vi } from 'vitest'
import {
  fetchInbox,
  fetchMessage,
  markMessageRead,
  type Message,
} from './service'
import type { ApiTransport } from '../api/transport'

const mockMessage: Message = {
  body: 'Repository verified.',
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
  title: 'Repository review complete',
}

describe('inbox service', () => {
  it('fetches inbox messages with pagination', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        items: [mockMessage],
        nextOffset: 5,
      }),
      ok: true,
      status: 200,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    const result = await fetchInbox(transport, { limit: 5, offset: 0 })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toEqual(mockMessage)
    expect(result.nextOffset).toBe(5)
    expect(requestMock).toHaveBeenCalledWith(
      '/inbox?limit=5&offset=0',
      expect.anything(),
    )
  })

  it('fetches single message by id', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      body: JSON.stringify({ message: mockMessage }),
      ok: true,
      status: 200,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    const result = await fetchMessage(transport, 'msg-1', 'tok-abc')

    expect(result).toEqual(mockMessage)
    expect(requestMock).toHaveBeenCalledWith('/inbox/msg-1', {
      method: 'GET',
      token: 'tok-abc',
    })
  })

  it('marks message as read via POST /inbox/{id}/read', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      body: '{}',
      ok: true,
      status: 204,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    const success = await markMessageRead(transport, 'msg-1', 'tok-abc')

    expect(success).toBe(true)
    expect(requestMock).toHaveBeenCalledWith('/inbox/msg-1/read', {
      body: {},
      method: 'POST',
      token: 'tok-abc',
    })
  })
})
