/**
 * Base URL do backend (Create React App: REACT_APP_BACKEND_URL).
 * Produção (Render): https://osti-vistoria.onrender.com
 * Local: http://127.0.0.1:5000 — use .env.local para desenvolvimento.
 */
export const DEFAULT_BACKEND_URL = 'https://osti-vistoria.onrender.com';

export const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL || DEFAULT_BACKEND_URL
).replace(/\/$/, '');

/** Base da API REST (…/api) — usada por src/services/api.js */
export const API_BASE = `${BACKEND_URL}/api`;
