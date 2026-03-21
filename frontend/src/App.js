import "@/index.css";
import { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider } from '@/auth';
import { AppRoutes } from '@/routes/AppRoutes';
import OfflineIndicator from './components/OfflineIndicator';
import SyncIdListener from './components/SyncIdListener';
import { startSyncManager } from './services/syncManager';

function App() {
  useEffect(() => {
    return startSyncManager();
  }, []);

  return (
    <AuthProvider>
      <ErrorBoundary>
        <div className="App min-h-dvh">
          <OfflineIndicator />
          <HashRouter>
            <SyncIdListener />
            <AppRoutes />
          </HashRouter>
          <Toaster />
        </div>
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;
