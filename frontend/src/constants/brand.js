/**
 * Marca na interface (LaudoFlow). No PDF, logótipo opcional na vistoria; sem logótipo, só o título — ver pdfGenerator.js.
 * Query string força novo fetch quando o ficheiro em /public é substituído (evita PNG antigo em cache).
 */
export const APP_LOGO_URL = `${process.env.PUBLIC_URL || ''}/logo-laudoflow.png?v=9`;
export const APP_LOGO_ALT = 'LaudoFlow';

/** Logo OSTI horizontal — canto inferior do painel escuro (login), não usado no PDF */
export const OSTI_SIDEBAR_LOGO_URL = `${process.env.PUBLIC_URL || ''}/logo-osti-sidebar.png?v=2`;
