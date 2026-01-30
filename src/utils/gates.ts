/**
 * Gate evaluation utilities for pass/fail thresholds
 */

import { GateConfig, ABTestResult, MetricComparison } from '../core/types';
import { logger } from './logger';

export interface GateViolation {
  metric: string;
  type: 'min' | 'max' | 'improvement' | 'latency' | 'cost';
  expected: number;
  actual: number;
  variant?: string;
}

export interface GateEvaluationResult {
  passed: boolean;
  violations: GateViolation[];
  summary: string;
}

/**
 * Evaluate test results against configured gates
 */
export function evaluateGates(
  result: ABTestResult,
  gates: GateConfig,
  baselineVariantId?: string
): GateEvaluationResult {
  const violations: GateViolation[] = [];
  
  if (!gates.enabled) {
    return { passed: true, violations: [], summary: 'Gates disabled' };
  }

  // Find baseline variant
  const baselineVariant = baselineVariantId 
    ? result.variants.find(v => v.variantId === baselineVariantId)
    : result.variants[0];

  if (!baselineVariant) {
    logger.warn('No baseline variant found for gate evaluation');
    return { passed: true, violations: [], summary: 'No baseline variant' };
  }

  // Check each variant against gates
  for (const variant of result.variants) {
    // Check metric gates
    if (gates.metrics) {
      for (const [metricName, gate] of Object.entries(gates.metrics)) {
        const metricKey = metricName.replace('@', '');
        const value = variant.metrics[metricKey];
        
        if (value === undefined) {
          logger.warn(`Metric ${metricName} not found in results`);
          continue;
        }

        // Check minimum threshold
        if (gate.min !== undefined && value < gate.min) {
          violations.push({
            metric: metricName,
            type: 'min',
            expected: gate.min,
            actual: value,
            variant: variant.variantName,
          });
        }

        // Check maximum threshold
        if (gate.max !== undefined && value > gate.max) {
          violations.push({
            metric: metricName,
            type: 'max',
            expected: gate.max,
            actual: value,
            variant: variant.variantName,
          });
        }

        // Check improvement vs baseline (for non-baseline variants)
        if (gate.improvement !== undefined && variant.variantId !== baselineVariant.variantId) {
          const baselineValue = baselineVariant.metrics[metricKey];
          const improvement = (value - baselineValue) / baselineValue;
          
          if (improvement < gate.improvement) {
            violations.push({
              metric: metricName,
              type: 'improvement',
              expected: gate.improvement,
              actual: improvement,
              variant: variant.variantName,
            });
          }
        }
      }
    }

    // Check latency gates
    if (gates.latency) {
      if (gates.latency.maxMs !== undefined && variant.usage.avgLatency > gates.latency.maxMs) {
        violations.push({
          metric: 'avgLatency',
          type: 'latency',
          expected: gates.latency.maxMs,
          actual: variant.usage.avgLatency,
          variant: variant.variantName,
        });
      }

      if (gates.latency.p95MaxMs !== undefined && variant.usage.p95Latency > gates.latency.p95MaxMs) {
        violations.push({
          metric: 'p95Latency',
          type: 'latency',
          expected: gates.latency.p95MaxMs,
          actual: variant.usage.p95Latency,
          variant: variant.variantName,
        });
      }
    }

    // Check cost gates
    if (gates.cost) {
      if (gates.cost.maxTotal !== undefined && variant.usage.totalCost > gates.cost.maxTotal) {
        violations.push({
          metric: 'totalCost',
          type: 'cost',
          expected: gates.cost.maxTotal,
          actual: variant.usage.totalCost,
          variant: variant.variantName,
        });
      }

      const costPerQuery = variant.usage.totalCost / variant.perQueryResults.length;
      if (gates.cost.maxPerQuery !== undefined && costPerQuery > gates.cost.maxPerQuery) {
        violations.push({
          metric: 'costPerQuery',
          type: 'cost',
          expected: gates.cost.maxPerQuery,
          actual: costPerQuery,
          variant: variant.variantName,
        });
      }
    }
  }

  const passed = violations.length === 0;
  const summary = passed 
    ? `All gates passed (${result.variants.length} variants checked)`
    : `${violations.length} gate violations found`;

  return { passed, violations, summary };
}

/**
 * Format gate violations for display
 */
export function formatGateViolations(violations: GateViolation[]): string {
  if (violations.length === 0) {
    return 'No violations';
  }

  return violations.map(v => {
    const variantStr = v.variant ? ` [${v.variant}]` : '';
    const comparison = v.type === 'improvement' 
      ? `${(v.actual * 100).toFixed(1)}% improvement (required: ${(v.expected * 100).toFixed(1)}%)`
      : `${v.actual.toFixed(4)} (required: ${v.type === 'min' ? '≥' : '≤'} ${v.expected.toFixed(4)})`;
    
    return `  - ${v.metric}${variantStr}: ${comparison}`;
  }).join('\n');
}

/**
 * Check if a specific comparison passes gates
 */
export function checkComparisonGates(
  comparison: MetricComparison,
  gates: GateConfig
): { passed: boolean; reason?: string } {
  if (!gates.enabled || !gates.metrics) {
    return { passed: true };
  }

  const metricGate = gates.metrics[comparison.metric];
  if (!metricGate) {
    return { passed: true };
  }

  // Check improvement requirement
  if (metricGate.improvement !== undefined) {
    const improvement = comparison.improvement;
    if (improvement < metricGate.improvement) {
      return {
        passed: false,
        reason: `${comparison.metric}: ${(improvement * 100).toFixed(1)}% improvement vs baseline (required: ${(metricGate.improvement * 100).toFixed(1)}%)`,
      };
    }
  }

  return { passed: true };
}
