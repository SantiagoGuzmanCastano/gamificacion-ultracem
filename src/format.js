// §14: coma decimal, punto de miles y espacio antes de "%".
export function formatPercent(value) {
  return `${Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;
}
