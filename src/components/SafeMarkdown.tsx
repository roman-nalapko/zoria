import { createElement, type ReactNode } from 'react'

export interface SafeMarkdownProps {
  content: string
}

function sanitizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  ) {
    return trimmed
  }
  return '#'
}

/**
 * Parses inline formatting: `code`, **bold**, *italic*, [text](url).
 * Renders native React elements without ever using dangerouslySetInnerHTML.
 */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Matches: `code`, **bold**, *italic*, [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `inline-${match.index.toString()}`

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('[') && token.includes('](')) {
      const closeBracket = token.indexOf('](')
      const label = token.slice(1, closeBracket)
      const url = token.slice(closeBracket + 2, -1)
      const safeUrl = sanitizeUrl(url)
      const isExternal =
        safeUrl.startsWith('http://') || safeUrl.startsWith('https://')

      nodes.push(
        <a
          key={key}
          href={safeUrl}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
        >
          {label}
        </a>,
      )
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

/**
 * T5.3: Safe Markdown renderer.
 * Strictly uses native React elements with tag allowlist:
 * h1-h4, p, ul, ol, li, pre/code, blockquote, a, strong, em.
 * All external links are forced to target="_blank" rel="noopener noreferrer".
 * No raw HTML execution or dangerouslySetInnerHTML.
 */
export function SafeMarkdown({ content }: SafeMarkdownProps) {
  if (!content) return null

  const lines = content.split(/\r?\n/)
  const elements: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const rawLine = lines[index]
    if (rawLine === undefined) {
      index++
      continue
    }

    const trimmed = rawLine.trim()

    // Empty lines
    if (trimmed === '') {
      index++
      continue
    }

    // Fenced code blocks ```
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      index++
      while (index < lines.length) {
        const cur = lines[index]
        if (cur !== undefined && cur.trim().startsWith('```')) {
          index++
          break
        }
        if (cur !== undefined) {
          codeLines.push(cur)
        }
        index++
      }
      elements.push(
        <pre key={`block-${index.toString()}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Headings
    if (trimmed.startsWith('#')) {
      const match = /^(#{1,4})\s+(.+)$/.exec(trimmed)
      if (match && match[1] && match[2]) {
        const level = match[1].length
        const headingText = match[2]
        const tag = `h${level.toString()}` as 'h1' | 'h2' | 'h3' | 'h4'
        elements.push(
          createElement(
            tag,
            { key: `heading-${index.toString()}` },
            ...renderInline(headingText),
          ),
        )
        index++
        continue
      }
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '')
      elements.push(
        <blockquote key={`quote-${index.toString()}`}>
          <p>{renderInline(quoteText)}</p>
        </blockquote>,
      )
      index++
      continue
    }

    // Unordered lists (* or -)
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const listItems: ReactNode[] = []
      while (index < lines.length) {
        const itemLine = lines[index]?.trim()
        if (
          !itemLine ||
          (!itemLine.startsWith('* ') && !itemLine.startsWith('- '))
        ) {
          break
        }
        const itemText = itemLine.slice(2)
        listItems.push(
          <li key={`li-${index.toString()}`}>{renderInline(itemText)}</li>,
        )
        index++
      }
      elements.push(<ul key={`list-${index.toString()}`}>{listItems}</ul>)
      continue
    }

    // Ordered lists (1. )
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: ReactNode[] = []
      while (index < lines.length) {
        const itemLine = lines[index]?.trim()
        if (!itemLine || !/^\d+\.\s+/.test(itemLine)) {
          break
        }
        const itemText = itemLine.replace(/^\d+\.\s+/, '')
        listItems.push(
          <li key={`oli-${index.toString()}`}>{renderInline(itemText)}</li>,
        )
        index++
      }
      elements.push(<ol key={`olist-${index.toString()}`}>{listItems}</ol>)
      continue
    }

    // Normal paragraph
    elements.push(<p key={`p-${index.toString()}`}>{renderInline(trimmed)}</p>)
    index++
  }

  return <div className="markdown-body">{elements}</div>
}
