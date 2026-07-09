import React from 'react';
import Icon from './Icon.jsx';

// Top-level render-error guard (DEV-37) — without this, an uncaught throw
// anywhere in the tree white-screens the whole app with no way back.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[WeightTracker] unhandled render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty" style={{ minHeight: '100vh' }}>
          <span className="empty-ic" style={{ background: 'var(--amber-tint)' }}><Icon name="warn" size={26} color="#b9742a" /></span>
          <h2>Something went wrong</h2>
          <p className="t2">An unexpected error stopped this page from loading. Reloading usually fixes it.</p>
          <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
