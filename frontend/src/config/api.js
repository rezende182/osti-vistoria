/** Base URL do backend (Create React App: REACT_APP_BACKEND_URL). */
export const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:5000';

export const API_BASE = `${BACKEND_URL.replace(/\/$/, '')}/api`;
