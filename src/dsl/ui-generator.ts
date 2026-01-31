/**
 * EmbedEval DSL UI Generator
 * 
 * Generates interactive HTML annotation interfaces from DSL specs.
 * Based on Hamel's principle: "Build custom annotation tools"
 */

import { EvalSpec, EvalDefinition } from './parser';

export interface UIConfig {
  title?: string;
  theme?: 'light' | 'dark';
  showContext?: boolean;
  showMetadata?: boolean;
  keyboardShortcuts?: boolean;
}

/**
 * Generate an interactive HTML annotation interface from a DSL spec
 */
export function generateAnnotationUI(
  spec: EvalSpec,
  _tracesFile: string,
  outputAnnotationsFile: string,
  config: UIConfig = {}
): string {
  const {
    title = spec.name || 'EmbedEval Annotation',
    theme = 'dark',
    showContext = true,
    showMetadata = true,
    keyboardShortcuts = true,
  } = config;

  // Group evals by type for checklist
  const cheapEvals = spec.evals.filter(e => e.priority !== 'expensive');
  const expensiveEvals = spec.evals.filter(e => e.priority === 'expensive');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      ${theme === 'dark' ? `
      --bg: #1a1a2e;
      --bg-secondary: #16213e;
      --bg-tertiary: #0f3460;
      --text: #eee;
      --text-muted: #888;
      --border: #333;
      --accent: #e94560;
      --success: #4ade80;
      --fail: #f87171;
      --warning: #fbbf24;
      ` : `
      --bg: #f8fafc;
      --bg-secondary: #fff;
      --bg-tertiary: #e2e8f0;
      --text: #1e293b;
      --text-muted: #64748b;
      --border: #cbd5e1;
      --accent: #6366f1;
      --success: #22c55e;
      --fail: #ef4444;
      --warning: #f59e0b;
      `}
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
    }
    .header h1 { font-size: 1.5rem; }
    .progress {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .progress-bar {
      width: 200px;
      height: 8px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--accent);
      transition: width 0.3s;
    }
    .progress-text { font-size: 0.875rem; color: var(--text-muted); }
    
    /* Main layout */
    .main {
      display: grid;
      grid-template-columns: 1fr 350px;
      gap: 24px;
    }
    
    /* Trace display */
    .trace-panel {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--border);
    }
    .trace-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .trace-id {
      font-size: 0.875rem;
      color: var(--text-muted);
      font-family: monospace;
    }
    .trace-nav {
      display: flex;
      gap: 8px;
    }
    .trace-nav button {
      padding: 8px 16px;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text);
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
    }
    .trace-nav button:hover { background: var(--accent); }
    .trace-nav button:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .section {
      margin-bottom: 20px;
    }
    .section-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .query-box, .response-box, .context-box {
      background: var(--bg-tertiary);
      border-radius: 8px;
      padding: 16px;
      font-size: 0.9375rem;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .response-box {
      max-height: 400px;
      overflow-y: auto;
    }
    .context-box {
      font-size: 0.8125rem;
      max-height: 200px;
      overflow-y: auto;
    }
    .context-doc {
      padding: 8px;
      margin-bottom: 8px;
      background: var(--bg-secondary);
      border-radius: 4px;
    }
    .context-score {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    /* Metadata */
    .metadata {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 0.8125rem;
    }
    .metadata-item {
      background: var(--bg-tertiary);
      padding: 4px 10px;
      border-radius: 4px;
    }
    .metadata-label { color: var(--text-muted); }
    
    /* Eval panel */
    .eval-panel {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid var(--border);
      position: sticky;
      top: 20px;
    }
    .eval-panel h2 {
      font-size: 1rem;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    
    .eval-section {
      margin-bottom: 20px;
    }
    .eval-section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    
    .eval-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px;
      margin-bottom: 6px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .eval-item:hover { background: var(--bg); }
    .eval-item.checked { border-left: 3px solid var(--success); }
    .eval-item.failed { border-left: 3px solid var(--fail); }
    
    .eval-checkbox {
      width: 18px;
      height: 18px;
      border: 2px solid var(--border);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
    }
    .eval-item.checked .eval-checkbox {
      background: var(--success);
      border-color: var(--success);
      color: white;
    }
    .eval-item.failed .eval-checkbox {
      background: var(--fail);
      border-color: var(--fail);
      color: white;
    }
    
    .eval-content { flex: 1; }
    .eval-name { font-size: 0.875rem; font-weight: 500; }
    .eval-condition {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .eval-type {
      font-size: 0.625rem;
      padding: 2px 6px;
      background: var(--bg);
      border-radius: 3px;
      text-transform: uppercase;
    }
    
    /* Action buttons */
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .btn {
      flex: 1;
      padding: 14px 20px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-pass {
      background: var(--success);
      color: white;
    }
    .btn-pass:hover { filter: brightness(1.1); }
    .btn-fail {
      background: var(--fail);
      color: white;
    }
    .btn-fail:hover { filter: brightness(1.1); }
    .btn-skip {
      background: var(--bg-tertiary);
      color: var(--text);
    }
    
    /* Notes */
    .notes-section {
      margin-top: 16px;
    }
    .notes-input {
      width: 100%;
      padding: 10px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-family: inherit;
      font-size: 0.875rem;
      resize: vertical;
      min-height: 60px;
    }
    .notes-input:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    /* Keyboard shortcuts */
    .shortcuts {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .shortcut {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    kbd {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }
    
    /* Stats bar */
    .stats-bar {
      display: flex;
      gap: 20px;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 0.875rem;
    }
    .stat {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .stat-value { font-weight: 600; }
    .stat-pass { color: var(--success); }
    .stat-fail { color: var(--fail); }
    
    /* Toast notifications */
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.875rem;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s;
      z-index: 100;
    }
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    .toast.success { border-color: var(--success); }
    .toast.error { border-color: var(--fail); }
    
    /* Loading state */
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
    }
    
    /* File upload */
    .file-upload {
      text-align: center;
      padding: 60px;
      background: var(--bg-secondary);
      border: 2px dashed var(--border);
      border-radius: 12px;
      margin: 40px 0;
    }
    .file-upload input {
      display: none;
    }
    .file-upload label {
      display: inline-block;
      padding: 12px 24px;
      background: var(--accent);
      color: white;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }
    .file-upload p {
      margin-top: 12px;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>📝 ${title}</h1>
      <div class="progress">
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill" style="width: 0%"></div>
        </div>
        <span class="progress-text" id="progressText">0 / 0</span>
      </div>
    </header>
    
    <div class="stats-bar" id="statsBar">
      <div class="stat">
        <span class="stat-label">Total:</span>
        <span class="stat-value" id="statTotal">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Pass:</span>
        <span class="stat-value stat-pass" id="statPass">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Fail:</span>
        <span class="stat-value stat-fail" id="statFail">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Remaining:</span>
        <span class="stat-value" id="statRemaining">0</span>
      </div>
    </div>
    
    <div id="fileUpload" class="file-upload">
      <input type="file" id="tracesInput" accept=".jsonl,.json">
      <label for="tracesInput">📂 Load Traces File</label>
      <p>Upload your traces.jsonl file to start annotating</p>
    </div>
    
    <div class="main" id="mainContent" style="display: none;">
      <div class="trace-panel">
        <div class="trace-header">
          <span class="trace-id" id="traceId">trace-001</span>
          <div class="trace-nav">
            <button id="prevBtn" onclick="prevTrace()">← Prev</button>
            <button id="nextBtn" onclick="nextTrace()">Next →</button>
          </div>
        </div>
        
        <div class="section">
          <div class="section-label">Query</div>
          <div class="query-box" id="queryBox"></div>
        </div>
        
        <div class="section">
          <div class="section-label">Response</div>
          <div class="response-box" id="responseBox"></div>
        </div>
        
        ${showContext ? `
        <div class="section" id="contextSection">
          <div class="section-label">Retrieved Context</div>
          <div class="context-box" id="contextBox"></div>
        </div>
        ` : ''}
        
        ${showMetadata ? `
        <div class="section">
          <div class="section-label">Metadata</div>
          <div class="metadata" id="metadataBox"></div>
        </div>
        ` : ''}
      </div>
      
      <div class="eval-panel">
        <h2>Evaluation Checklist</h2>
        
        ${cheapEvals.length > 0 ? `
        <div class="eval-section">
          <div class="eval-section-title">⚡ Quick Checks</div>
          ${cheapEvals.map((e, i) => generateEvalItemHTML(e, i)).join('')}
        </div>
        ` : ''}
        
        ${expensiveEvals.length > 0 ? `
        <div class="eval-section">
          <div class="eval-section-title">🔍 Deep Checks</div>
          ${expensiveEvals.map((e, i) => generateEvalItemHTML(e, i + cheapEvals.length)).join('')}
        </div>
        ` : ''}
        
        <div class="notes-section">
          <div class="section-label">Notes (optional)</div>
          <textarea class="notes-input" id="notesInput" placeholder="Add any observations..."></textarea>
        </div>
        
        <div class="actions">
          <button class="btn btn-pass" onclick="submitPass()">✓ Pass</button>
          <button class="btn btn-fail" onclick="submitFail()">✗ Fail</button>
          <button class="btn btn-skip" onclick="skipTrace()">Skip</button>
        </div>
        
        ${keyboardShortcuts ? `
        <div class="shortcuts">
          <div class="shortcut"><span>Pass</span> <kbd>P</kbd></div>
          <div class="shortcut"><span>Fail</span> <kbd>F</kbd></div>
          <div class="shortcut"><span>Skip</span> <kbd>S</kbd></div>
          <div class="shortcut"><span>Prev/Next</span> <kbd>←</kbd> <kbd>→</kbd></div>
          <div class="shortcut"><span>Toggle eval 1-9</span> <kbd>1-9</kbd></div>
        </div>
        ` : ''}
      </div>
    </div>
  </div>
  
  <div class="toast" id="toast"></div>
  
  <script>
    // Eval spec from DSL
    const evalSpec = ${JSON.stringify(spec)};
    
    // State
    let traces = [];
    let annotations = [];
    let currentIndex = 0;
    let evalStates = {};  // Track which evals are checked/failed per trace
    
    // DOM elements
    const fileUpload = document.getElementById('fileUpload');
    const mainContent = document.getElementById('mainContent');
    const tracesInput = document.getElementById('tracesInput');
    
    // File upload handler
    tracesInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const text = await file.text();
      traces = text.trim().split('\\n').map(line => JSON.parse(line));
      
      // Load existing annotations if any
      const existingAnnotations = localStorage.getItem('embedeval_annotations_' + evalSpec.name);
      if (existingAnnotations) {
        annotations = JSON.parse(existingAnnotations);
        // Find first unannotated trace
        const annotatedIds = new Set(annotations.map(a => a.traceId));
        currentIndex = traces.findIndex(t => !annotatedIds.has(t.id));
        if (currentIndex === -1) currentIndex = 0;
      }
      
      fileUpload.style.display = 'none';
      mainContent.style.display = 'grid';
      updateDisplay();
      updateStats();
    });
    
    // Display functions
    function updateDisplay() {
      if (traces.length === 0) return;
      
      const trace = traces[currentIndex];
      
      document.getElementById('traceId').textContent = trace.id || \`trace-\${currentIndex + 1}\`;
      document.getElementById('queryBox').textContent = trace.query || '';
      document.getElementById('responseBox').textContent = trace.response || '';
      
      // Context
      ${showContext ? `
      const contextBox = document.getElementById('contextBox');
      if (trace.context?.retrievedDocs?.length) {
        contextBox.innerHTML = trace.context.retrievedDocs.map(doc => \`
          <div class="context-doc">
            <div>\${doc.content}</div>
            \${doc.score ? \`<div class="context-score">Score: \${doc.score.toFixed(2)}</div>\` : ''}
          </div>
        \`).join('');
        document.getElementById('contextSection').style.display = 'block';
      } else {
        document.getElementById('contextSection').style.display = 'none';
      }
      ` : ''}
      
      // Metadata
      ${showMetadata ? `
      const metadataBox = document.getElementById('metadataBox');
      if (trace.metadata) {
        metadataBox.innerHTML = Object.entries(trace.metadata).map(([k, v]) => \`
          <span class="metadata-item">
            <span class="metadata-label">\${k}:</span> \${v}
          </span>
        \`).join('');
      }
      ` : ''}
      
      // Reset eval states
      resetEvalStates();
      
      // Load notes if existing annotation
      const existingAnnotation = annotations.find(a => a.traceId === trace.id);
      document.getElementById('notesInput').value = existingAnnotation?.notes || '';
      
      // Update navigation
      document.getElementById('prevBtn').disabled = currentIndex === 0;
      document.getElementById('nextBtn').disabled = currentIndex >= traces.length - 1;
      
      // Update progress
      updateProgress();
    }
    
    function resetEvalStates() {
      evalStates = {};
      document.querySelectorAll('.eval-item').forEach(item => {
        item.classList.remove('checked', 'failed');
        item.querySelector('.eval-checkbox').textContent = '';
      });
    }
    
    function toggleEval(index) {
      const item = document.querySelector(\`[data-eval-index="\${index}"]\`);
      if (!item) return;
      
      const checkbox = item.querySelector('.eval-checkbox');
      
      if (item.classList.contains('checked')) {
        item.classList.remove('checked');
        item.classList.add('failed');
        checkbox.textContent = '✗';
        evalStates[index] = 'fail';
      } else if (item.classList.contains('failed')) {
        item.classList.remove('failed');
        checkbox.textContent = '';
        delete evalStates[index];
      } else {
        item.classList.add('checked');
        checkbox.textContent = '✓';
        evalStates[index] = 'pass';
      }
    }
    
    function updateProgress() {
      const annotatedCount = annotations.length;
      const total = traces.length;
      const percent = total > 0 ? (annotatedCount / total) * 100 : 0;
      
      document.getElementById('progressFill').style.width = percent + '%';
      document.getElementById('progressText').textContent = \`\${annotatedCount} / \${total}\`;
    }
    
    function updateStats() {
      const passCount = annotations.filter(a => a.label === 'pass').length;
      const failCount = annotations.filter(a => a.label === 'fail').length;
      
      document.getElementById('statTotal').textContent = traces.length;
      document.getElementById('statPass').textContent = passCount;
      document.getElementById('statFail').textContent = failCount;
      document.getElementById('statRemaining').textContent = traces.length - annotations.length;
    }
    
    // Navigation
    function prevTrace() {
      if (currentIndex > 0) {
        currentIndex--;
        updateDisplay();
      }
    }
    
    function nextTrace() {
      if (currentIndex < traces.length - 1) {
        currentIndex++;
        updateDisplay();
      }
    }
    
    // Annotation actions
    function submitPass() {
      saveAnnotation('pass');
    }
    
    function submitFail() {
      saveAnnotation('fail');
    }
    
    function skipTrace() {
      nextTrace();
    }
    
    function saveAnnotation(label) {
      const trace = traces[currentIndex];
      const notes = document.getElementById('notesInput').value;
      
      // Determine failure category from failed evals
      const failedEvals = Object.entries(evalStates)
        .filter(([_, state]) => state === 'fail')
        .map(([idx, _]) => evalSpec.evals[parseInt(idx)]?.name)
        .filter(Boolean);
      
      const annotation = {
        id: \`ann-\${Date.now()}\`,
        traceId: trace.id,
        annotator: 'human@annotation.ui',
        timestamp: new Date().toISOString(),
        label: label,
        failureCategory: failedEvals.length > 0 ? failedEvals[0] : (label === 'fail' ? 'other' : null),
        failedChecks: failedEvals,
        notes: notes || null,
        source: 'dsl-ui',
        evalSpec: evalSpec.name,
      };
      
      // Update or add annotation
      const existingIndex = annotations.findIndex(a => a.traceId === trace.id);
      if (existingIndex >= 0) {
        annotations[existingIndex] = annotation;
      } else {
        annotations.push(annotation);
      }
      
      // Save to localStorage
      localStorage.setItem('embedeval_annotations_' + evalSpec.name, JSON.stringify(annotations));
      
      // Show toast
      showToast(label === 'pass' ? '✓ Marked as Pass' : '✗ Marked as Fail', label === 'pass' ? 'success' : 'error');
      
      // Update stats
      updateStats();
      
      // Move to next
      if (currentIndex < traces.length - 1) {
        currentIndex++;
        updateDisplay();
      }
    }
    
    function showToast(message, type = '') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast show ' + type;
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2000);
    }
    
    // Export function
    function exportAnnotations() {
      const jsonl = annotations.map(a => JSON.stringify(a)).join('\\n');
      const blob = new Blob([jsonl], { type: 'application/jsonl' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${outputAnnotationsFile}';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Annotations exported!', 'success');
    }
    
    // Keyboard shortcuts
    ${keyboardShortcuts ? `
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      
      switch (e.key.toLowerCase()) {
        case 'p': submitPass(); break;
        case 'f': submitFail(); break;
        case 's': skipTrace(); break;
        case 'arrowleft': prevTrace(); break;
        case 'arrowright': nextTrace(); break;
        case 'e': exportAnnotations(); break;
        default:
          // Number keys 1-9 toggle evals
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9) {
            toggleEval(num - 1);
          }
      }
    });
    ` : ''}
    
    // Add export button to header
    document.querySelector('.header').innerHTML += \`
      <button onclick="exportAnnotations()" style="padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">
        📥 Export Annotations
      </button>
    \`;
  </script>
</body>
</html>`;
}

function generateEvalItemHTML(evalDef: EvalDefinition, index: number): string {
  const typeLabel = evalDef.type === 'must' ? 'MUST' : 
                   evalDef.type === 'must-not' ? 'MUST NOT' :
                   evalDef.type === 'should' ? 'SHOULD' : 
                   evalDef.type === 'should-not' ? 'SHOULD NOT' : 'CHECK';
  
  return `
    <div class="eval-item" data-eval-index="${index}" onclick="toggleEval(${index})">
      <div class="eval-checkbox"></div>
      <div class="eval-content">
        <div class="eval-name">${evalDef.name}</div>
        <div class="eval-condition">${evalDef.condition}</div>
      </div>
      <span class="eval-type">${typeLabel}</span>
    </div>
  `;
}

/**
 * Generate a shareable link with embedded spec
 */
export function generateShareableUI(spec: EvalSpec): string {
  const encodedSpec = Buffer.from(JSON.stringify(spec)).toString('base64');
  return `https://embedeval.dev/annotate?spec=${encodedSpec}`;
}
