import React from 'react'

type Props = { children: React.ReactNode }

type State = { error: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'monospace',
            color: '#b91c1c',
            background: '#fef2f2',
            minHeight: '100vh',
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>Remi failed to load</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
