/**
 * Generates an automatic drawing number based on category, sub-code, and sequence count.
 * Example: LND-PL-001 (Landscape Plantation Layout #1)
 * @param {string} category - 'Landscape', 'Irrigation', 'Lighting', 'Hardscape'
 * @param {string} code - 'PL' (Plantation Layout), 'IR' (Irrigation), 'LT' (Lighting), etc.
 * @param {number} count - Sequential number (e.g. 3)
 * @returns {string} - Formatted drawing number
 */
export function generateDrawingNumber(category, code, count) {
  const prefix = {
    'Landscape': 'LND',
    'Irrigation': 'IRR',
    'Lighting': 'LTG',
    'Hardscape': 'HDS'
  }[category] || 'GEN';
  
  const formattedCount = String(count || 1).padStart(3, '0');
  const cleanCode = (code || 'DWG').toUpperCase();
  return `${prefix}-${cleanCode}-${formattedCount}`;
}

/**
 * Formats a numeric value as currency in Indian Rupees (INR) format.
 * @param {number} amount - Value to format
 * @returns {string} - Formatted currency (e.g. ₹1,50,000.00)
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Formats standard date strings into user-friendly display dates.
 * @param {string|Date} dateStr - Date object or date string
 * @returns {string} - Formatted date (e.g., Jun 11, 2026)
 */
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculates GST components for bills and quotations.
 * @param {number} amount 
 * @param {number} [percent=18] 
 * @returns {object} 
 */
export function calculateGST(amount, percent = 18) {
  const base = parseFloat(amount) || 0;
  const pct = parseFloat(percent) || 0;
  const gstAmount = (base * pct) / 100;
  const total = base + gstAmount;
  return {
    base,
    gstPercent: pct,
    gstAmount,
    total
  };
}
