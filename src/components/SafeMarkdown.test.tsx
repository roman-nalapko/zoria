import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SafeMarkdown } from './SafeMarkdown'

afterEach(cleanup)

describe('SafeMarkdown', () => {
  it('renders nothing on empty content', () => {
    const { container } = render(<SafeMarkdown content="" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders headings correctly', () => {
    render(<SafeMarkdown content={'# Heading 1\n## Heading 2'} />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Heading 1' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Heading 2' }),
    ).toBeInTheDocument()
  })

  it('renders code blocks and inline code', () => {
    const content =
      '```\nconst x = 1\nconsole.log(x)\n```\nHere is `inline code`.'
    render(<SafeMarkdown content={content} />)
    expect(
      screen.getByText(
        (text) =>
          text.includes('const x = 1') && text.includes('console.log(x)'),
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('inline code')).toBeInTheDocument()
  })

  it('renders lists', () => {
    const content = '- Item Alpha\n- Item Beta\n1. Number One\n2. Number Two'
    render(<SafeMarkdown content={content} />)
    expect(screen.getByText('Item Alpha')).toBeInTheDocument()
    expect(screen.getByText('Item Beta')).toBeInTheDocument()
    expect(screen.getByText('Number One')).toBeInTheDocument()
    expect(screen.getByText('Number Two')).toBeInTheDocument()
  })

  it('enforces rel="noopener noreferrer" and target="_blank" on external links', () => {
    const content = 'Read [Rules](https://zoria.net/rules) or [Docs](/docs)'
    render(<SafeMarkdown content={content} />)

    const externalLink = screen.getByRole('link', { name: 'Rules' })
    expect(externalLink).toHaveAttribute('href', 'https://zoria.net/rules')
    expect(externalLink).toHaveAttribute('target', '_blank')
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer')

    const internalLink = screen.getByRole('link', { name: 'Docs' })
    expect(internalLink).toHaveAttribute('href', '/docs')
    expect(internalLink).not.toHaveAttribute('target')
    expect(internalLink).not.toHaveAttribute('rel')
  })

  it('neutralizes javascript: links', () => {
    const content = '[Malicious](javascript:alert(1))'
    render(<SafeMarkdown content={content} />)
    const link = screen.getByRole('link', { name: 'Malicious' })
    expect(link).toHaveAttribute('href', '#')
  })

  it('renders bold and italic formatting', () => {
    const content = 'This is **bold text** and *italic text*.'
    render(<SafeMarkdown content={content} />)
    expect(screen.getByText('bold text').tagName).toBe('STRONG')
    expect(screen.getByText('italic text').tagName).toBe('EM')
  })
})
