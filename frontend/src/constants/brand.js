/**
 * Marca na interface (LaudoFlow). O PDF oficial continua a usar logo/textos OSTI — ver pdfGenerator.js.
 * Query string força novo fetch quando o ficheiro em /public é substituído (evita PNG antigo em cache).
 */
export const APP_LOGO_URL = `${process.env.PUBLIC_URL || ''}/logo-laudoflow.png?v=8`;
export const APP_LOGO_ALT = 'LaudoFlow';
