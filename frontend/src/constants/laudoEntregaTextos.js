/** Textos alternáveis no app — fluxo Entrega de Imóvel (objetivo e metodologia). Podem ficar vazios. */

export const LAUDO_OBJETIVO_PRESETS = [];

export const METODOLOGIA_PLACEHOLDER_REG_NC = '[REGISTRO FOTOGRÁFICO]';

export const LAUDO_METODOLOGIA_PRESETS = [];

/** Próximo preset de objetivo a partir do texto atual (ciclo). */
export function nextObjetivoPreset(currentText) {
  const presets = LAUDO_OBJETIVO_PRESETS;
  if (!presets.length) return '';
  const t = String(currentText || '').trim();
  const idx = presets.findIndex((p) => p.trim() === t);
  const next = idx >= 0 ? (idx + 1) % presets.length : 0;
  return presets[next];
}

/** Próximo preset de metodologia a partir do texto atual (ciclo). */
export function nextMetodologiaPreset(currentText) {
  const presets = LAUDO_METODOLOGIA_PRESETS;
  if (!presets.length) return '';
  const t = String(currentText || '').trim();
  const idx = presets.findIndex((p) => p.trim() === t);
  const next = idx >= 0 ? (idx + 1) % presets.length : 0;
  return presets[next];
}
