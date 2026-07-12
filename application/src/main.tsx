import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles.css';
import './app.css';

// retry: false — a rejected repo call just surfaces as `error`, no automatic
// retry/backoff. Cross-view refresh after a write comes from the mutation
// hooks in hooks/mutations.js, which invalidate exactly the query-key groups
// each write can affect (no change-bus needed: every mutation goes through
// those hooks, so there is nothing else that could silently skip invalidation).
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

// HashRouter keeps deep links working on GitHub Pages with no server rewrites.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
