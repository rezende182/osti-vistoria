import "@/index.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Toaster } from '@/components/ui/sonner';
import Dashboard from './pages/Dashboard';
import NewInspection from './pages/NewInspection';
import EditInspection from './pages/EditInspection';
import InspectionChecklist from './pages/InspectionChecklist';
import InspectionReview from './pages/InspectionReview';
import InspectionDetail from './pages/InspectionDetail';
import OfflineIndicator from './components/OfflineIndicator';

function App() {
  return (
    <div className="App">
      <OfflineIndicator />
      <HashRouter>
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
  );
}

export default App;