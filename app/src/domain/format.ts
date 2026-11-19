export function formatKg(grams: number): string {
  return `${Number((grams / 1000).toFixed(2))} kg`;
}

export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? `₹${rupees}` : `₹${rupees.toFixed(2)}`;
}
