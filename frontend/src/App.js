import "@/index.css";
import { useEffect } from 'react';
import { HashRouter, Routes, Route } from "react-router-dom";
import { Toaster } from '@/components/ui/sonner';
import ErrorBoundary from '@/components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import NewInspection from './pages/NewInspection';
import EditInspection from './pages/EditInspection';
import InspectionChecklist from './pages/InspectionChecklist';
import InspectionReview from './pages/InspectionReview';
import InspectionDetail from './pages/InspectionDetail';
import OfflineIndicator from './components/OfflineIndicator';
import SyncIdListener from './components/SyncIdListener';
import { startSyncManager } from './services/syncManager';

function App() {
  useEffect(() => {
    return startSyncManager();
  }, []);

  return (
    <ErrorBoundary>
      <div className="App">
        <OfflineIndicator />
        <HashRouter>
          <SyncIdListener />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-inspection" element={<NewInspection />} />
            <Route path="/inspection/:id" element={<InspectionDetail />} />
            <Route path="/inspection/:id/edit" element={<EditInspection />} />
            <Route path="/inspection/:id/checklist" element={<InspectionChecklist />} />
            <Route path="/inspection/:id/review" element={<InspectionReview />} />
          </Routes>
        </HashRouter>
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}

export default App;