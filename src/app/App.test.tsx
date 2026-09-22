import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('shows the safe training environment by default', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /ready to establish contact/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('training')).toBeInTheDocument()
    expect(
      screen.getByText('https://stand.zoria.net/api/v1'),
    ).toBeInTheDocument()
  })
})
