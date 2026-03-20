import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Após sync de POST, substitui id local na URL pelo id do servidor (replace).
 */
export default function SyncIdListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const locRef = useRef(location);
  locRef.current = location;

  useEffect(() => {
    const h = (e) => {
      const { oldId, newId } = e.detail || {};
      if (!oldId || !newId) return;
      const path = locRef.current.pathname;
      if (path.includes(`/${oldId}`)) {
        navigate(path.split(`/${oldId}`).join(`/${newId}`), { replace: true });
      }
    };
    window.addEventListener('sync:inspection-id-replaced', h);
    return () => window.removeEventListener('sync:inspection-id-replaced', h);
  }, [navigate]);

  return null;
}
