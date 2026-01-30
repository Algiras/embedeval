/**
 * Statistical utility functions
 */

/**
 * Calculate mean of an array
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate percentile of an array
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (upper >= sorted.length) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate standard deviation
 */
export function calculateStd(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

/**
 * Calculate Cohen's d (effect size)
 */
export function calculateCohensD(values1: number[], values2: number[]): number {
  const mean1 = calculateMean(values1);
  const mean2 = calculateMean(values2);
  const std1 = calculateStd(values1);
  const std2 = calculateStd(values2);
  
  const pooledStd = Math.sqrt((Math.pow(std1, 2) + Math.pow(std2, 2)) / 2);
  return (mean2 - mean1) / pooledStd;
}

/**
 * Paired t-test (simplified implementation)
 */
export function pairedTTest(before: number[], after: number[]): {
  tStatistic: number;
  pValue: number;
  isSignificant: boolean;
  confidenceInterval: [number, number];
} {
  const differences = before.map((b, i) => after[i] - b);
  const mean = calculateMean(differences);
  const std = calculateStd(differences);
  const n = differences.length;
  
  const tStatistic = mean / (std / Math.sqrt(n));
  
  // Simplified p-value calculation (using normal approximation)
  // In production, you'd use a proper t-distribution
  const pValue = Math.exp(-0.717 * Math.abs(tStatistic) - 0.416 * Math.pow(tStatistic, 2));
  
  const marginOfError = 1.96 * (std / Math.sqrt(n));
  
  return {
    tStatistic,
    pValue,
    isSignificant: pValue < 0.05,
    confidenceInterval: [mean - marginOfError, mean + marginOfError],
  };
}
