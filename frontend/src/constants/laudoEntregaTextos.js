/** Textos padrão do laudo — fluxo Entrega de Imóvel (objetivo, relato, metodologia). */

export const LAUDO_OBJETIVO_PRESETS = [
  `O presente laudo tem por objetivo avaliar as condições técnicas do imóvel no momento da entrega, por meio de inspeção visual e não destrutiva, identificando eventuais não conformidades, vícios construtivos aparentes e falhas de execução.
Visa, ainda, assegurar que o imóvel seja recebido em condições adequadas de uso, segurança, habitabilidade e desempenho, bem como resguardar o(a) proprietário(a) quanto à qualidade construtiva da unidade.
Adicionalmente, o laudo tem a finalidade de subsidiar tecnicamente a solicitação de correção das anomalias identificadas junto à construtora, podendo servir como instrumento de apoio para a tomada de decisão quanto ao aceite do imóvel.`,

  `Verificar as condições técnicas do imóvel no ato da entrega, com o objetivo de identificar não conformidades, vícios construtivos aparentes e eventuais falhas de execução, assegurando que a unidade esteja apta ao uso, em conformidade com requisitos mínimos de segurança, habitabilidade e desempenho.`,

  `Realizar inspeção técnica no imóvel no momento da entrega, visando identificar e registrar todas as não conformidades e vícios construtivos aparentes, a fim de resguardar o(a) proprietário(a) quanto à qualidade da execução da obra, bem como subsidiar tecnicamente a exigência de correção das falhas junto à construtora antes do aceite definitivo do imóvel.`,

  `O presente laudo tem como objetivo a caracterização das condições técnicas do imóvel no ato da entrega, mediante a identificação e registro de vícios construtivos aparentes, não conformidades e falhas de execução, servindo como instrumento técnico para resguardar os direitos do(a) proprietário(a), bem como para fundamentar eventual solicitação de reparos junto à construtora, previamente à formalização do aceite do imóvel.`,

  `Avaliar as condições do imóvel no momento da entrega, identificando possíveis problemas de construção, acabamento ou funcionamento, garantindo que o imóvel seja recebido em boas condições e permitindo a solicitação de correções à construtora, caso necessário.`,

  `Inspecionar o imóvel no ato da entrega, identificando não conformidades e vícios aparentes, com o objetivo de garantir condições adequadas de uso e permitir a solicitação de correções antes do aceite.`,

  `Este laudo tem por objetivo avaliar tecnicamente o imóvel no momento da entrega, por meio de inspeção visual sistematizada, identificando não conformidades, vícios construtivos aparentes e falhas executivas, de modo a assegurar o desempenho adequado da edificação e resguardar o(a) proprietário(a) quanto à qualidade construtiva, possibilitando a exigência de correções antes da aceitação formal da unidade.`,
];

export const METODOLOGIA_PLACEHOLDER_REG_NC = '[REGISTRO DE NÃO CONFORMIDADES]';

/** Frase que separa o bloco DOCUMENTOS/NBRS do restante (usada no PDF e na lógica dinâmica). */
export const METODOLOGIA_PONTE_OBJETIVO =
  'Com o objetivo de avaliar as características e condições construtivas do imóvel.';

const DEFAULT_NBRS_TOPICS = `• NBR 16747 — Inspeção predial de edificações;
• NBR 15575-1 a 15575-5 — Edificações habitacionais — Desempenho (partes aplicáveis à vistoria);
• NBR 5410 — Instalações elétricas de baixa tensão (verificações aplicáveis);
• NBR 5626 — Instalações prediais de água fria e quente;
• NBR 14565 — Instalações de gás para uso residencial e comercial.`;

const METODOLOGIA_APOS_PONTE = `${METODOLOGIA_PONTE_OBJETIVO}

Foi realizada vistoria in loco, por meio de análise visual dos elementos construtivos acabados, bem como a execução de verificações funcionais e testes de desempenho não destrutivos, quando aplicáveis, nos sistemas e materiais entregues pela construtora.

Os vícios construtivos aparentes identificados durante a vistoria foram devidamente sinalizados, registrados por meio de fotografias e descritos tecnicamente, conforme apresentado no item ${METODOLOGIA_PLACEHOLDER_REG_NC} deste relatório.

O presente relatório não contempla a identificação de vícios ocultos, entendidos como aquelas anomalias que se manifestam ao longo do tempo, decorrentes do uso, envelhecimento ou condições específicas de exposição, não sendo passíveis de detecção no momento da vistoria.

Por fim, este laudo técnico foi elaborado com a finalidade de documentar as condições observadas no imóvel no ato da entrega, caracterizando o estado dos elementos construtivos e registrando eventuais não conformidades que possam comprometer sua qualidade, desempenho e condições adequadas de uso.`;

/** Bloco DOCUMENTOS (tópicos) + NBRS (tópicos), sem o parágrafo “Com o objetivo…”. */
export function buildMetodologiaDocumentosNbrsSection(documentosRecebidos) {
  const docs = Array.isArray(documentosRecebidos)
    ? documentosRecebidos.map((d) => String(d || '').trim()).filter(Boolean)
    : [];
  let docBlock;
  if (docs.length > 0) {
    docBlock = docs.map((d) => `• ${d}`).join('\n');
  } else {
    docBlock =
      '• Na ausência de fornecimento de documentos técnicos pela construtora, tal condição é expressamente registrada neste relatório.';
  }
  return `DOCUMENTOS\n${docBlock}\n\nNBRS\n${DEFAULT_NBRS_TOPICS}`;
}

/** Metodologia completa para novo laudo ou restaurar padrão. */
export function buildLaudoMetodologiaCompleta(documentosRecebidos) {
  return `${buildMetodologiaDocumentosNbrsSection(documentosRecebidos)}\n\n${METODOLOGIA_APOS_PONTE}`;
}

export function formatDataLaudoBrasil(dateStr) {
  if (!dateStr) return '___/___/____';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(dateStr);
}

/**
 * No texto do relato, até a finalização: aparece literalmente; no PDF/exibição com horário salvo, é trocado pelo valor.
 */
export const RELATO_TEXTO_PLACEHOLDER_TERMINO = '(será preenchido na finalização do laudo)';

/**
 * Parágrafo inicial do relato. Horário de término: valor já salvo ou placeholder até a finalização.
 * @param {{ data?: string, horario_inicio?: string, horario_termino?: string, cliente?: string, responsavel_tecnico?: string, responsavel_construtora?: string }} p
 */
export function buildRelatoVistoriaIntro(p) {
  const d = formatDataLaudoBrasil(p.data);
  const hi = String(p.horario_inicio || '').trim() || '___:___';
  const ht = String(p.horario_termino || '').trim();
  const terminoPart = ht || RELATO_TEXTO_PLACEHOLDER_TERMINO;
  const cl = String(p.cliente || '').trim() || '___';
  const rt = String(p.responsavel_tecnico || '').trim() || '___';
  const rc = String(p.responsavel_construtora || '').trim();
  let presencas = `${cl}, proprietário(a), ${rt}, responsável técnico`;
  if (rc) {
    presencas += ` e ${rc}, responsável da construtora`;
  }
  presencas += '.';
  return `A vistoria foi realizada no dia ${d}, com início às ${hi} e término às ${terminoPart}. No momento da vistoria estavam presentes ${presencas}`;
}

/**
 * Substitui o placeholder do término pelo horário da finalização (PDF e telas de detalhe).
 * @param {string} text
 * @param {string} [horarioTermino]
 */
export function substituirPlaceholderHorarioTerminoRelato(text, horarioTermino) {
  const t = String(text || '');
  const ht = String(horarioTermino || '').trim();
  if (!t || !ht) return t;
  let out = t.split(RELATO_TEXTO_PLACEHOLDER_TERMINO).join(ht);
  out = out.split('(será definido na finalização do laudo)').join(ht);
  out = out.replace(
    /\. O horário de término será informado na finalização deste laudo\.\s*No momento/gi,
    ` e término às ${ht}. No momento`
  );
  return out;
}

/** Parte editável do relato (tudo após o 1.º parágrafo fixo), para o formulário. */
export function extractRelatoEditableSuffix(fullText) {
  const t = String(fullText || '').trim();
  if (!t) return '';
  const idx = t.indexOf('\n\n');
  const firstPara = idx === -1 ? t : t.slice(0, idx).trim();
  if (firstPara.startsWith('A vistoria foi realizada')) {
    return idx === -1 ? '' : t.slice(idx + 2).trim();
  }
  return t;
}

function relatoCamposParaIntro(p) {
  return {
    data: p.data,
    horario_inicio: p.horario_inicio,
    horario_termino: p.horario_termino,
    cliente: p.cliente,
    responsavel_tecnico: p.responsavel_tecnico,
    responsavel_construtora: p.responsavel_construtora,
  };
}

/** Texto completo guardado no backend: parágrafo fixo + complemento opcional. */
export function buildRelatoVistoriaArmazenado(sufixo, p) {
  const intro = buildRelatoVistoriaIntro(relatoCamposParaIntro(p)).trim();
  const s = String(sufixo || '').trim();
  return s ? `${intro}\n\n${s}` : intro;
}

/** Próximo preset de objetivo a partir do texto atual (ciclo). */
export function nextObjetivoPreset(currentText) {
  const t = String(currentText || '').trim();
  const idx = LAUDO_OBJETIVO_PRESETS.findIndex((p) => p.trim() === t);
  const next = idx >= 0 ? (idx + 1) % LAUDO_OBJETIVO_PRESETS.length : 0;
  return LAUDO_OBJETIVO_PRESETS[next];
}

const OLD_METODOLOGIA_FRASE_REMOVIDA =
  'A inspeção foi fundamentada nas principais normas técnicas aplicáveis à inspeção predial e elaboração de laudos técnicos';

const SPLIT_MARKER = `\n\n${METODOLOGIA_PONTE_OBJETIVO}\n\n`;

/**
 * Atualiza o bloco DOCUMENTOS/NBRS conforme documentos selecionados, preservando o texto após “Com o objetivo…”.
 * @param {string} storedText
 * @param {string[]} documentosRecebidos
 */
export function applyDynamicMetodologiaIntro(storedText, documentosRecebidos) {
  const s = String(storedText || '').trim();
  if (!s) return buildLaudoMetodologiaCompleta(documentosRecebidos);

  if (s.includes(OLD_METODOLOGIA_FRASE_REMOVIDA)) {
    return buildLaudoMetodologiaCompleta(documentosRecebidos);
  }

  const t = s.trimStart();
  if (t.startsWith('DOCUMENTOS')) {
    const idx = s.indexOf(SPLIT_MARKER);
    if (idx !== -1) {
      const tail = s.slice(idx + SPLIT_MARKER.length);
      return `${buildMetodologiaDocumentosNbrsSection(documentosRecebidos)}${SPLIT_MARKER}${tail}`;
    }
  }

  const parts = s.split(/\n\n+/);
  const p0 = parts[0]?.trim() || '';
  const isOldIntro =
    p0.startsWith('Nesta vistoria, considerou-se') ||
    p0.startsWith('Na ausência de fornecimento');
  if (isOldIntro) {
    return buildLaudoMetodologiaCompleta(documentosRecebidos);
  }

  return s;
}
