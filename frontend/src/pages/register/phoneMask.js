/**
 * Máscara (XX) XXXXX-XXXX enquanto digita — apenas dígitos, máx. 11 (DDD + celular).
 */
export function maskBrazilPhoneInput(raw) {
  const digits = String(raw).replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
