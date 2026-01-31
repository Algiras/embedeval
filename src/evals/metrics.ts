/**
 * Self-Assessment Metrics System
 * 
 * Enables LLMs to evaluate their own performance across:
 * - Price: Token costs, API costs, cost per eval
 * - Speed: Latency percentiles, throughput, time-to-first-token
 * - Quality: Pass rates, calibration, agreement with humans
 * 
 * Used for:
 * - Model selection (pick best model for task)
 * - Cost optimization (cheap vs expensive evals)
 * - Quality monitoring (drift detection)
 * - A/B testing (compare approaches)
 */

// ==================== PRICING ====================

export interface ModelPricing {
  inputPer1k: number;   // Cost per 1000 input tokens
  outputPer1k: number;  // Cost per 1000 output tokens
  currency: 'USD';
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Gemini 3 Series (2026)
  'gemini-3-pro': { inputPer1k: 0.00125, outputPer1k: 0.005, currency: 'USD' },
  'gemini-3-flash': { inputPer1k: 0.000075, outputPer1k: 0.0003, currency: 'USD' },
  
  // Gemini 2.5 Series
  'gemini-2.5-flash': { inputPer1k: 0.000075, outputPer1k: 0.0003, currency: 'USD' },
  'gemini-2.5-flash-lite': { inputPer1k: 0.000038, outputPer1k: 0.00015, currency: 'USD' },
  'gemini-2.5-pro': { inputPer1k: 0.00125, outputPer1k: 0.005, currency: 'USD' },
  
  // Gemini 2.0 (Legacy)
  'gemini-2.0-flash': { inputPer1k: 0.000075, outputPer1k: 0.0003, currency: 'USD' },
  'gemini-2.0-flash-lite': { inputPer1k: 0.000038, outputPer1k: 0.00015, currency: 'USD' },
  
  // OpenAI
  'gpt-4o': { inputPer1k: 0.005, outputPer1k: 0.015, currency: 'USD' },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006, currency: 'USD' },
  'gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03, currency: 'USD' },
  'gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015, currency: 'USD' },
  
  // Claude (via OpenRouter)
  'anthropic/claude-3.5-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015, currency: 'USD' },
  'anthropic/claude-3-haiku': { inputPer1k: 0.00025, outputPer1k: 0.00125, currency: 'USD' },
  
  // Embedding models
  'text-embedding-004': { inputPer1k: 0.00001, outputPer1k: 0, currency: 'USD' },
  'text-embedding-3-small': { inputPer1k: 0.00002, outputPer1k: 0, currency: 'USD' },
};

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: string;
  currency: 'USD';
}

/**
 * Estimate cost for a model call
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): CostEstimate {
  const pricing = MODEL_PRICING[model] || { inputPer1k: 0, outputPer1k: 0, currency: 'USD' as const };
  
  const inputCost = (inputTokens / 1000) * pricing.inputPer1k;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1k;
  
  return {
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    model,
    currency: 'USD',
  };
}

/**
 * Estimate tokens from text (rough approximation)
 * ~4 chars per token for English
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ==================== SPEED METRICS ====================

export interface SpeedMetrics {
  count: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;  // evals per second
  latencies: number[]; // raw latencies for percentile calculation
}

/**
 * Calculate speed metrics from latency samples
 */
export function calculateSpeedMetrics(latencies: number[]): SpeedMetrics {
  if (latencies.length === 0) {
    return {
      count: 0,
      totalLatency: 0,
      minLatency: 0,
      maxLatency: 0,
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
      latencies: [],
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  
  return {
    count: sorted.length,
    totalLatency: total,
    minLatency: sorted[0],
    maxLatency: sorted[sorted.length - 1],
    avgLatency: total / sorted.length,
    p50Latency: percentile(sorted, 50),
    p95Latency: percentile(sorted, 95),
    p99Latency: percentile(sorted, 99),
    throughput: 1000 / (total / sorted.length), // evals per second
    latencies: sorted,
  };
}

function percentile(sortedArr: number[], p: number): number {
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, index)];
}

// ==================== QUALITY METRICS ====================

export interface QualityMetrics {
  totalEvals: number;
  passed: number;
  failed: number;
  passRate: number;
  failureCategories: Record<string, number>;
  
  // Calibration (if human annotations available)
  calibration?: CalibrationMetrics;
  
  // Per-eval breakdown
  evalBreakdown: Record<string, { passed: number; failed: number; passRate: number }>;
}

export interface CalibrationMetrics {
  agreement: number;           // % agreement with human
  falsePositives: number;      // LLM said PASS, human said FAIL
  falseNegatives: number;      // LLM said FAIL, human said PASS
  truePositives: number;       // Both said PASS
  trueNegatives: number;       // Both said FAIL
  precision: number;           // TP / (TP + FP)
  recall: number;              // TP / (TP + FN)
  f1Score: number;             // 2 * (precision * recall) / (precision + recall)
  cohensKappa: number;         // Agreement accounting for chance
}

/**
 * Calculate quality metrics from eval results
 */
export function calculateQualityMetrics(
  results: Array<{ evalId: string; passed: boolean; failureCategory?: string }>
): QualityMetrics {
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  
  // Count failure categories
  const failureCategories: Record<string, number> = {};
  for (const r of results.filter(r => !r.passed && r.failureCategory)) {
    failureCategories[r.failureCategory!] = (failureCategories[r.failureCategory!] || 0) + 1;
  }
  
  // Per-eval breakdown
  const evalBreakdown: Record<string, { passed: number; failed: number; passRate: number }> = {};
  for (const r of results) {
    if (!evalBreakdown[r.evalId]) {
      evalBreakdown[r.evalId] = { passed: 0, failed: 0, passRate: 0 };
    }
    if (r.passed) {
      evalBreakdown[r.evalId].passed++;
    } else {
      evalBreakdown[r.evalId].failed++;
    }
  }
  
  // Calculate pass rates
  for (const id of Object.keys(evalBreakdown)) {
    const e = evalBreakdown[id];
    e.passRate = e.passed / (e.passed + e.failed);
  }
  
  return {
    totalEvals: results.length,
    passed,
    failed,
    passRate: results.length > 0 ? passed / results.length : 0,
    failureCategories,
    evalBreakdown,
  };
}

/**
 * Calculate calibration metrics comparing LLM judgments to human annotations
 */
export function calculateCalibration(
  llmResults: Array<{ traceId: string; passed: boolean }>,
  humanAnnotations: Array<{ traceId: string; label: 'pass' | 'fail' }>
): CalibrationMetrics {
  const humanMap = new Map(humanAnnotations.map(a => [a.traceId, a.label === 'pass']));
  
  let tp = 0, fp = 0, tn = 0, fn = 0;
  
  for (const llm of llmResults) {
    const humanPassed = humanMap.get(llm.traceId);
    if (humanPassed === undefined) continue;
    
    if (llm.passed && humanPassed) tp++;
    else if (llm.passed && !humanPassed) fp++;
    else if (!llm.passed && humanPassed) fn++;
    else tn++;
  }
  
  const total = tp + fp + tn + fn;
  const agreement = total > 0 ? (tp + tn) / total : 0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  // Cohen's Kappa
  const pO = agreement;
  const pYes = ((tp + fp) / total) * ((tp + fn) / total);
  const pNo = ((tn + fn) / total) * ((tn + fp) / total);
  const pE = pYes + pNo;
  const cohensKappa = pE < 1 ? (pO - pE) / (1 - pE) : 1;
  
  return {
    agreement,
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
    precision,
    recall,
    f1Score,
    cohensKappa,
  };
}

// ==================== COMPARISON ENGINE ====================

export interface ModelComparison {
  modelA: string;
  modelB: string;
  
  // Quality comparison
  passRateA: number;
  passRateB: number;
  qualityWinner: 'A' | 'B' | 'tie';
  qualityDelta: number;  // B - A (positive = B better)
  
  // Speed comparison
  avgLatencyA: number;
  avgLatencyB: number;
  speedWinner: 'A' | 'B' | 'tie';
  speedRatio: number;    // A / B (>1 = B faster)
  
  // Cost comparison
  totalCostA: number;
  totalCostB: number;
  costWinner: 'A' | 'B' | 'tie';
  costRatio: number;     // A / B (>1 = B cheaper)
  
  // Overall recommendation
  recommendation: 'A' | 'B' | 'depends';
  reasoning: string;
}

/**
 * Compare two models across price, speed, quality
 */
export function compareModels(
  modelA: string,
  resultsA: Array<{ passed: boolean; latency: number; inputTokens?: number; outputTokens?: number }>,
  modelB: string,
  resultsB: Array<{ passed: boolean; latency: number; inputTokens?: number; outputTokens?: number }>
): ModelComparison {
  // Quality
  const passRateA = resultsA.filter(r => r.passed).length / resultsA.length;
  const passRateB = resultsB.filter(r => r.passed).length / resultsB.length;
  const qualityDelta = passRateB - passRateA;
  const qualityWinner = Math.abs(qualityDelta) < 0.02 ? 'tie' : (qualityDelta > 0 ? 'B' : 'A');
  
  // Speed
  const avgLatencyA = resultsA.reduce((a, r) => a + r.latency, 0) / resultsA.length;
  const avgLatencyB = resultsB.reduce((a, r) => a + r.latency, 0) / resultsB.length;
  const speedRatio = avgLatencyA / avgLatencyB;
  const speedWinner = Math.abs(speedRatio - 1) < 0.1 ? 'tie' : (speedRatio > 1 ? 'B' : 'A');
  
  // Cost
  let totalCostA = 0, totalCostB = 0;
  for (const r of resultsA) {
    const cost = estimateCost(modelA, r.inputTokens || 100, r.outputTokens || 50);
    totalCostA += cost.totalCost;
  }
  for (const r of resultsB) {
    const cost = estimateCost(modelB, r.inputTokens || 100, r.outputTokens || 50);
    totalCostB += cost.totalCost;
  }
  const costRatio = totalCostA / totalCostB;
  const costWinner = Math.abs(costRatio - 1) < 0.1 ? 'tie' : (costRatio > 1 ? 'B' : 'A');
  
  // Recommendation
  let recommendation: 'A' | 'B' | 'depends' = 'depends';
  let reasoning = '';
  
  const wins = { A: 0, B: 0 };
  if (qualityWinner === 'A') wins.A++; else if (qualityWinner === 'B') wins.B++;
  if (speedWinner === 'A') wins.A++; else if (speedWinner === 'B') wins.B++;
  if (costWinner === 'A') wins.A++; else if (costWinner === 'B') wins.B++;
  
  if (wins.A >= 2) {
    recommendation = 'A';
    reasoning = `${modelA} wins in ${wins.A}/3 categories`;
  } else if (wins.B >= 2) {
    recommendation = 'B';
    reasoning = `${modelB} wins in ${wins.B}/3 categories`;
  } else {
    recommendation = 'depends';
    reasoning = 'No clear winner - choose based on priority (quality/speed/cost)';
  }
  
  return {
    modelA,
    modelB,
    passRateA,
    passRateB,
    qualityWinner,
    qualityDelta,
    avgLatencyA,
    avgLatencyB,
    speedWinner,
    speedRatio,
    totalCostA,
    totalCostB,
    costWinner,
    costRatio,
    recommendation,
    reasoning,
  };
}

// ==================== DRIFT DETECTION ====================

export interface DriftReport {
  detected: boolean;
  metric: 'quality' | 'speed' | 'cost';
  baseline: number;
  current: number;
  delta: number;
  percentChange: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

/**
 * Detect drift from baseline metrics
 */
export function detectDrift(
  baseline: { passRate: number; avgLatency: number; avgCost: number },
  current: { passRate: number; avgLatency: number; avgCost: number },
  thresholds: { quality: number; speed: number; cost: number } = { quality: 0.05, speed: 0.2, cost: 0.3 }
): DriftReport[] {
  const reports: DriftReport[] = [];
  
  // Quality drift (pass rate decrease)
  const qualityDelta = current.passRate - baseline.passRate;
  if (qualityDelta < -thresholds.quality) {
    reports.push({
      detected: true,
      metric: 'quality',
      baseline: baseline.passRate,
      current: current.passRate,
      delta: qualityDelta,
      percentChange: (qualityDelta / baseline.passRate) * 100,
      threshold: thresholds.quality,
      severity: Math.abs(qualityDelta) > 0.15 ? 'high' : Math.abs(qualityDelta) > 0.1 ? 'medium' : 'low',
      message: `Quality degraded: pass rate dropped from ${(baseline.passRate * 100).toFixed(1)}% to ${(current.passRate * 100).toFixed(1)}%`,
    });
  }
  
  // Speed drift (latency increase)
  const speedRatio = current.avgLatency / baseline.avgLatency;
  if (speedRatio > 1 + thresholds.speed) {
    reports.push({
      detected: true,
      metric: 'speed',
      baseline: baseline.avgLatency,
      current: current.avgLatency,
      delta: current.avgLatency - baseline.avgLatency,
      percentChange: ((speedRatio - 1) * 100),
      threshold: thresholds.speed,
      severity: speedRatio > 2 ? 'high' : speedRatio > 1.5 ? 'medium' : 'low',
      message: `Speed degraded: latency increased from ${baseline.avgLatency.toFixed(0)}ms to ${current.avgLatency.toFixed(0)}ms`,
    });
  }
  
  // Cost drift (cost increase)
  const costRatio = current.avgCost / baseline.avgCost;
  if (costRatio > 1 + thresholds.cost) {
    reports.push({
      detected: true,
      metric: 'cost',
      baseline: baseline.avgCost,
      current: current.avgCost,
      delta: current.avgCost - baseline.avgCost,
      percentChange: ((costRatio - 1) * 100),
      threshold: thresholds.cost,
      severity: costRatio > 2 ? 'high' : costRatio > 1.5 ? 'medium' : 'low',
      message: `Cost increased: from $${baseline.avgCost.toFixed(6)} to $${current.avgCost.toFixed(6)} per eval`,
    });
  }
  
  return reports;
}

// ==================== SELF-ASSESSMENT SUMMARY ====================

export interface SelfAssessmentReport {
  timestamp: string;
  model: string;
  sampleSize: number;
  
  // Core metrics
  quality: QualityMetrics;
  speed: SpeedMetrics;
  cost: {
    totalCost: number;
    avgCostPerEval: number;
    costPerPass: number;
    currency: 'USD';
  };
  
  // Derived insights
  efficiency: {
    passesPerDollar: number;
    passesPerSecond: number;
    costEfficiencyScore: number;  // 0-100
    speedEfficiencyScore: number; // 0-100
    overallScore: number;         // 0-100
  };
  
  // Recommendations
  recommendations: string[];
  
  // Drift (if baseline provided)
  drift?: DriftReport[];
}

/**
 * Generate comprehensive self-assessment report
 */
export function generateSelfAssessment(
  model: string,
  results: Array<{
    evalId: string;
    passed: boolean;
    latency: number;
    inputTokens?: number;
    outputTokens?: number;
    failureCategory?: string;
  }>,
  baseline?: { passRate: number; avgLatency: number; avgCost: number }
): SelfAssessmentReport {
  // Quality
  const quality = calculateQualityMetrics(results);
  
  // Speed
  const speed = calculateSpeedMetrics(results.map(r => r.latency));
  
  // Cost
  let totalCost = 0;
  for (const r of results) {
    const cost = estimateCost(model, r.inputTokens || 100, r.outputTokens || 50);
    totalCost += cost.totalCost;
  }
  const avgCostPerEval = results.length > 0 ? totalCost / results.length : 0;
  const costPerPass = quality.passed > 0 ? totalCost / quality.passed : 0;
  
  // Efficiency scores
  const passesPerDollar = totalCost > 0 ? quality.passed / totalCost : 0;
  const passesPerSecond = speed.totalLatency > 0 ? (quality.passed * 1000) / speed.totalLatency : 0;
  
  // Normalize scores (0-100 scale)
  // Cost: $0.001 per pass = 100, $0.01 per pass = 50, $0.1 per pass = 10
  const costEfficiencyScore = Math.max(0, Math.min(100, 100 - (costPerPass * 1000)));
  
  // Speed: 100ms avg = 100, 500ms avg = 80, 1000ms avg = 60, 5000ms avg = 20
  const speedEfficiencyScore = Math.max(0, Math.min(100, 100 - (speed.avgLatency / 50)));
  
  // Overall: weighted average (quality 50%, speed 25%, cost 25%)
  const overallScore = (quality.passRate * 100 * 0.5) + (speedEfficiencyScore * 0.25) + (costEfficiencyScore * 0.25);
  
  // Recommendations
  const recommendations: string[] = [];
  
  if (quality.passRate < 0.7) {
    recommendations.push('⚠️ Pass rate below 70% - review failure categories and improve prompts');
  }
  if (speed.avgLatency > 2000) {
    recommendations.push('⚠️ High latency (>2s) - consider using a faster model like gemini-2.5-flash-lite');
  }
  if (costPerPass > 0.01) {
    recommendations.push('⚠️ High cost per pass (>$0.01) - consider cheaper evals or batching');
  }
  if (quality.passRate > 0.95 && speed.avgLatency < 500) {
    recommendations.push('✅ Excellent performance - consider using cheaper model to save costs');
  }
  
  // Drift detection
  let drift: DriftReport[] | undefined;
  if (baseline) {
    drift = detectDrift(baseline, {
      passRate: quality.passRate,
      avgLatency: speed.avgLatency,
      avgCost: avgCostPerEval,
    });
    
    for (const d of drift) {
      recommendations.push(`🚨 ${d.message}`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ All metrics within normal ranges');
  }
  
  return {
    timestamp: new Date().toISOString(),
    model,
    sampleSize: results.length,
    quality,
    speed,
    cost: {
      totalCost,
      avgCostPerEval,
      costPerPass,
      currency: 'USD',
    },
    efficiency: {
      passesPerDollar,
      passesPerSecond,
      costEfficiencyScore,
      speedEfficiencyScore,
      overallScore,
    },
    recommendations,
    drift,
  };
}

/**
 * Format self-assessment as readable text
 */
export function formatSelfAssessment(report: SelfAssessmentReport): string {
  const lines: string[] = [
    '',
    '═══════════════════════════════════════════════════════════════',
    '                    SELF-ASSESSMENT REPORT                      ',
    '═══════════════════════════════════════════════════════════════',
    '',
    `📊 Model: ${report.model}`,
    `📅 Time: ${report.timestamp}`,
    `📈 Sample: ${report.sampleSize} evaluations`,
    '',
    '┌─────────────────────────────────────────────────────────────┐',
    '│                       QUALITY                               │',
    '├─────────────────────────────────────────────────────────────┤',
    `│  Pass Rate:     ${(report.quality.passRate * 100).toFixed(1)}%`.padEnd(62) + '│',
    `│  Passed:        ${report.quality.passed}`.padEnd(62) + '│',
    `│  Failed:        ${report.quality.failed}`.padEnd(62) + '│',
    '└─────────────────────────────────────────────────────────────┘',
    '',
    '┌─────────────────────────────────────────────────────────────┐',
    '│                        SPEED                                │',
    '├─────────────────────────────────────────────────────────────┤',
    `│  Avg Latency:   ${report.speed.avgLatency.toFixed(0)}ms`.padEnd(62) + '│',
    `│  P50 Latency:   ${report.speed.p50Latency.toFixed(0)}ms`.padEnd(62) + '│',
    `│  P95 Latency:   ${report.speed.p95Latency.toFixed(0)}ms`.padEnd(62) + '│',
    `│  P99 Latency:   ${report.speed.p99Latency.toFixed(0)}ms`.padEnd(62) + '│',
    `│  Throughput:    ${report.speed.throughput.toFixed(2)} evals/sec`.padEnd(62) + '│',
    '└─────────────────────────────────────────────────────────────┘',
    '',
    '┌─────────────────────────────────────────────────────────────┐',
    '│                        COST                                 │',
    '├─────────────────────────────────────────────────────────────┤',
    `│  Total Cost:    $${report.cost.totalCost.toFixed(6)}`.padEnd(62) + '│',
    `│  Avg/Eval:      $${report.cost.avgCostPerEval.toFixed(6)}`.padEnd(62) + '│',
    `│  Cost/Pass:     $${report.cost.costPerPass.toFixed(6)}`.padEnd(62) + '│',
    '└─────────────────────────────────────────────────────────────┘',
    '',
    '┌─────────────────────────────────────────────────────────────┐',
    '│                     EFFICIENCY                              │',
    '├─────────────────────────────────────────────────────────────┤',
    `│  Passes/$:      ${report.efficiency.passesPerDollar.toFixed(0)}`.padEnd(62) + '│',
    `│  Passes/sec:    ${report.efficiency.passesPerSecond.toFixed(2)}`.padEnd(62) + '│',
    `│  Cost Score:    ${report.efficiency.costEfficiencyScore.toFixed(0)}/100`.padEnd(62) + '│',
    `│  Speed Score:   ${report.efficiency.speedEfficiencyScore.toFixed(0)}/100`.padEnd(62) + '│',
    `│  Overall:       ${report.efficiency.overallScore.toFixed(0)}/100`.padEnd(62) + '│',
    '└─────────────────────────────────────────────────────────────┘',
    '',
    '📋 RECOMMENDATIONS:',
  ];
  
  for (const rec of report.recommendations) {
    lines.push(`   ${rec}`);
  }
  
  if (report.drift && report.drift.length > 0) {
    lines.push('');
    lines.push('🚨 DRIFT DETECTED:');
    for (const d of report.drift) {
      lines.push(`   [${d.severity.toUpperCase()}] ${d.message}`);
    }
  }
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

// ==================== MODEL SELECTION ====================

export interface ModelRecommendation {
  model: string;
  reason: string;
  tradeoffs: string[];
}

/**
 * Recommend best model based on priorities
 */
export function recommendModel(
  priority: 'quality' | 'speed' | 'cost' | 'balanced',
  taskComplexity: 'simple' | 'moderate' | 'complex'
): ModelRecommendation {
  const recommendations: Record<string, Record<string, ModelRecommendation>> = {
    quality: {
      simple: { model: 'gemini-2.5-flash', reason: 'Good quality for simple tasks', tradeoffs: ['Slightly slower than lite'] },
      moderate: { model: 'gemini-2.5-flash', reason: 'Best balance of quality and speed', tradeoffs: ['May need 2.5-pro for edge cases'] },
      complex: { model: 'gemini-3-pro', reason: 'Highest reasoning capability', tradeoffs: ['Expensive', 'Slower'] },
    },
    speed: {
      simple: { model: 'gemini-2.5-flash-lite', reason: 'Fastest available', tradeoffs: ['Lower quality on complex tasks'] },
      moderate: { model: 'gemini-2.5-flash', reason: 'Fast with good quality', tradeoffs: ['Not the absolute fastest'] },
      complex: { model: 'gemini-3-flash', reason: 'Fast thinking model', tradeoffs: ['Higher cost than 2.5'] },
    },
    cost: {
      simple: { model: 'gemini-2.5-flash-lite', reason: 'Cheapest option', tradeoffs: ['May miss edge cases'] },
      moderate: { model: 'gemini-2.5-flash-lite', reason: 'Best cost efficiency', tradeoffs: ['Quality tradeoff on harder tasks'] },
      complex: { model: 'gemini-2.5-flash', reason: 'Good balance at lower cost than pro', tradeoffs: ['May need pro for some tasks'] },
    },
    balanced: {
      simple: { model: 'gemini-2.5-flash-lite', reason: 'Great for simple checks', tradeoffs: [] },
      moderate: { model: 'gemini-2.5-flash', reason: 'Best overall balance', tradeoffs: [] },
      complex: { model: 'gemini-2.5-pro', reason: 'Complex reasoning with reasonable cost', tradeoffs: ['Slower'] },
    },
  };
  
  return recommendations[priority][taskComplexity];
}
