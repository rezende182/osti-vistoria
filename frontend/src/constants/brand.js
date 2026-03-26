/**
 * Marca na interface (InSpec360). No PDF, logótipo opcional na vistoria; sem logótipo, só o título — ver pdfGenerator.js.
 * Query string força novo fetch quando o ficheiro em /public é substituído (evita PNG antigo em cache).
 */
export const APP_LOGO_URL = `${process.env.PUBLIC_URL || ''}/logo-inspec360.png?v=2`;
export const APP_LOGO_ALT = 'InSpec360';

/** Logo OSTI horizontal — canto inferior do painel escuro (login), não usado no PDF */
export const OSTI_SIDEBAR_LOGO_URL = `${process.env.PUBLIC_URL || ''}/logo-osti-sidebar.png?v=2`;
