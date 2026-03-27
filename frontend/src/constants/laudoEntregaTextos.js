/** Textos padrão do laudo — fluxo Entrega de Imóvel (objetivo e metodologia). */

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

export const LAUDO_METODOLOGIA_PRESETS = [
  `Nesta vistoria, considerou-se a análise dos documentos disponibilizados pela construtora, conforme selecionado pelo usuário no início do preenchimento. Na ausência de fornecimento de documentos técnicos, tal condição é expressamente registrada neste relatório.
A inspeção foi fundamentada nas principais normas técnicas aplicáveis à inspeção predial e elaboração de laudos técnicos, com o objetivo de avaliar as características e condições construtivas do imóvel.
Foi realizada vistoria in loco, por meio de análise visual dos elementos construtivos acabados, bem como a execução de verificações funcionais e testes de desempenho não destrutivos, quando aplicáveis, nos sistemas e materiais entregues pela construtora.
Os vícios construtivos aparentes identificados durante a vistoria foram devidamente sinalizados, registrados por meio de fotografias e descritos tecnicamente, conforme apresentado no item ${METODOLOGIA_PLACEHOLDER_REG_NC} deste relatório.
O presente relatório não contempla a identificação de vícios ocultos, entendidos como aquelas anomalias que se manifestam ao longo do tempo, decorrentes do uso, envelhecimento ou condições específicas de exposição, não sendo passíveis de detecção no momento da vistoria.
Por fim, este laudo técnico foi elaborado com a finalidade de documentar as condições observadas no imóvel no ato da entrega, caracterizando o estado dos elementos construtivos e registrando eventuais não conformidades que possam comprometer sua qualidade, desempenho e condições adequadas de uso.`,

  `Para a realização desta vistoria, considerou-se a análise dos documentos disponibilizados pela construtora, conforme declarado pelo usuário, sendo formalmente indicada sua ausência quando não apresentados.
A metodologia adotada baseou-se nas normas técnicas pertinentes à inspeção predial e à elaboração de laudos de engenharia, com o objetivo de avaliar as condições construtivas e o desempenho dos elementos da edificação.
A inspeção foi realizada in loco, por meio de análise visual criteriosa dos elementos construtivos acabados, associada à execução de verificações funcionais e ensaios não destrutivos, quando aplicáveis.
Os vícios construtivos aparentes identificados foram devidamente documentados por meio de registros fotográficos e descrições técnicas detalhadas, conforme apresentado no item ${METODOLOGIA_PLACEHOLDER_REG_NC}.
O presente trabalho limita-se à identificação de vícios aparentes, não abrangendo vícios ocultos, os quais se manifestam ao longo do tempo e não são passíveis de detecção no momento da vistoria.
Por fim, o laudo tem por finalidade consolidar tecnicamente as condições observadas no imóvel, registrando o estado dos sistemas construtivos e eventuais anomalias existentes.`,

  `Nesta vistoria, foram considerados os documentos fornecidos pela construtora, conforme seleção realizada pelo usuário, sendo expressamente indicada sua ausência quando não disponibilizados.
A inspeção foi conduzida com base nas normas técnicas aplicáveis, com foco na avaliação das condições construtivas, funcionais e de desempenho do imóvel.
A vistoria ocorreu in loco, por meio de análise visual dos elementos construtivos acabados, aliada à realização de verificações funcionais e testes não destrutivos, quando pertinentes.
As não conformidades identificadas durante a inspeção foram registradas por meio de fotografias e descrições técnicas, conforme detalhado no item ${METODOLOGIA_PLACEHOLDER_REG_NC} deste relatório.
Este laudo não contempla a identificação de vícios ocultos, definidos como anomalias que se manifestam posteriormente e que não são detectáveis na ocasião da vistoria.
O presente documento tem como finalidade registrar as condições do imóvel no momento da entrega, evidenciando eventuais não conformidades que possam impactar sua qualidade, desempenho e uso adequado.`,
];

/** Próximo preset de objetivo a partir do texto atual (ciclo). */
export function nextObjetivoPreset(currentText) {
  const t = String(currentText || '').trim();
  const idx = LAUDO_OBJETIVO_PRESETS.findIndex((p) => p.trim() === t);
  const next = idx >= 0 ? (idx + 1) % LAUDO_OBJETIVO_PRESETS.length : 0;
  return LAUDO_OBJETIVO_PRESETS[next];
}

/** Próximo preset de metodologia a partir do texto atual (ciclo). */
export function nextMetodologiaPreset(currentText) {
  const t = String(currentText || '').trim();
  const idx = LAUDO_METODOLOGIA_PRESETS.findIndex((p) => p.trim() === t);
  const next = idx >= 0 ? (idx + 1) % LAUDO_METODOLOGIA_PRESETS.length : 0;
  return LAUDO_METODOLOGIA_PRESETS[next];
}
