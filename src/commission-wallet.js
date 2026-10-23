export function getCommissionStatus(sale) {
  if (sale?.commission_amount == null || !Number.isFinite(Number(sale.commission_amount)) || Number(sale.commission_amount) <= 0) return { label: 'Sin comisión configurada', claimable: false };
  if (sale.commission_status === 'available') return { label: 'Disponible', claimable: true };
  if (sale.commission_status === 'pending') return { label: 'Canjeada', claimable: false };
  return { label: 'Procesada', claimable: false };
}

export function commissionSummary(sales, advisorId) {
  const own = sales.filter(sale => sale.advisor_id === advisorId && sale.confirmed && sale.commission_amount != null && Number.isFinite(Number(sale.commission_amount)) && Number(sale.commission_amount) > 0);
  return own.reduce((summary, sale) => {
    const amount = Number(sale.commission_amount);
    summary.total += amount;
    summary.sales += 1;
    if (sale.commission_status === 'available') summary.available += amount;
    else if (sale.commission_status === 'pending') summary.pending += amount;
    return summary;
  }, { available: 0, pending: 0, total: 0, sales: 0 });
}
