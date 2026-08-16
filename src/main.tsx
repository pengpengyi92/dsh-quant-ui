import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles.css'

// 诊断层：任何运行时错误直接显示在页面上（避免白屏 + 快速定位）
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 32, color: '#c0392b', fontFamily: 'Menlo, monospace', fontSize: 13 }}>
          {'UI 运行时错误:\n\n' + (this.state.error.stack ?? String(this.state.error))}
        </pre>
      )
    }
    return this.props.children
  }
}

window.addEventListener('error', e => {
  const el = document.getElementById('root')
  if (el && el.children.length === 0) {
    el.innerHTML = '<pre style="padding:32px;color:#c0392b;font-family:Menlo,monospace;font-size:13px">加载错误: ' +
      String(e.message) + '</pre>'
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
