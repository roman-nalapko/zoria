import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Top-level error boundary that catches render-phase exceptions and shows a
 * safe fallback instead of crashing the whole page.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console for diagnostics; do not include bearer tokens in props.
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="error-boundary" role="alert">
            <p className="eyebrow">Unexpected error</p>
            <p>{this.state.error.message}</p>
            <button type="button" onClick={this.reset}>
              Try again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
