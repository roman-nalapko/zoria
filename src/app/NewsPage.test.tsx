import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewsPage } from './NewsPage'
import type { ApiTransport } from '../api/transport'
import type { News } from '../news/service'

const mockNewsItems: News[] = [
  {
    archivedAt: null,
    body: '## Welcome Participants\nRules and instructions are posted.',
    createdAt: '2026-09-24T12:00:00.000Z',
    id: 'n-1',
    publishedAt: '2026-09-24T12:00:00.000Z',
    title: 'Welcome to Zoria 2026',
    updatedAt: '2026-09-24T12:00:00.000Z',
  },
  {
    archivedAt: null,
    body: 'Stage 1 specs released.',
    createdAt: '2026-09-25T08:00:00.000Z',
    id: 'n-2',
    publishedAt: '2026-09-25T08:00:00.000Z',
    title: 'Stage 1 Available',
    updatedAt: '2026-09-25T08:00:00.000Z',
  },
]

afterEach(cleanup)

describe('NewsPage', () => {
  it('renders news list and displays selected article with markdown', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        items: mockNewsItems,
        nextOffset: 20,
      }),
      ok: true,
      status: 200,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    render(<NewsPage transport={transport} />)

    // Displays news cards and reader pane
    await vi.waitFor(() => {
      expect(screen.getAllByText('Welcome to Zoria 2026')).toHaveLength(2)
      expect(screen.getByText('Stage 1 Available')).toBeInTheDocument()
    })

    // First article is selected and rendered in SafeMarkdown
    expect(
      screen.getByRole('heading', { level: 2, name: 'Welcome Participants' }),
    ).toBeInTheDocument()

    // Pagination button appears when nextOffset is present
    expect(
      screen.getByRole('button', { name: /load older announcements/i }),
    ).toBeInTheDocument()
  })

  it('switches selected article on click', async () => {
    const requestMock = vi.fn().mockResolvedValue({
      body: JSON.stringify({
        items: mockNewsItems,
        nextOffset: null,
      }),
      ok: true,
      status: 200,
    })
    const transport = { request: requestMock } as unknown as ApiTransport

    render(<NewsPage transport={transport} />)

    await vi.waitFor(() => {
      expect(screen.getByText('Stage 1 Available')).toBeInTheDocument()
    })

    // Click on second article
    const secondCard = screen.getByRole('button', {
      name: /stage 1 available/i,
    })
    secondCard.click()

    await vi.waitFor(() => {
      expect(screen.getByText('Stage 1 specs released.')).toBeInTheDocument()
    })
  })
})
