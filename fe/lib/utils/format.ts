/**
 * Helper to dynamically format big integer reward amounts safely and premiumly.
 * Handles both 18 decimal (standard) and 6 decimal tokens, or falls back to raw values.
 */
export function formatReward(amount: string | number): string {
  try {
    const num = BigInt(amount);
    if (num === BigInt(0)) return "0 Tokens";
    
    // Standard ERC-20 with 18 decimals (e.g. 10^18)
    if (num >= BigInt(1000000000000)) {
      const formatted = Number(num) / 1e18;
      return `${formatted.toLocaleString(undefined, { maximumFractionDigits: 4 })} Tokens`;
    }
    
    // Standard ERC-20 with 6 decimals (e.g. USDC/USDT 10^6)
    if (num >= BigInt(1000)) {
      const formatted = Number(num) / 1e6;
      return `${formatted.toLocaleString(undefined, { maximumFractionDigits: 4 })} Tokens`;
    }
    
    return `${num.toString()} Tokens`;
  } catch (e) {
    return `${amount} Tokens`;
  }
}
