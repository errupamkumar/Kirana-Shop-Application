/** Format an INR amount for display, e.g. 1234.5 -> "₹1,234.50". */
export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Whole rupees when there are no paise (₹38), otherwise two decimals (₹38.50). For compact price tags. */
export function formatPrice(amount: number): string {
  return Number.isInteger(amount) ? `₹${amount.toLocaleString('en-IN')}` : formatInr(amount);
}

/** Money math in paise to avoid floating point drift (0.1 + 0.2). */
export function addMoney(...amounts: number[]): number {
  return amounts.reduce((sum, a) => sum + Math.round(a * 100), 0) / 100;
}

export function timesMoney(price: number, qty: number): number {
  return (Math.round(price * 100) * qty) / 100;
}
