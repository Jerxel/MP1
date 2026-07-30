const numProcInput = document.getElementById('numProc');
const genBtn = document.getElementById('genBtn');
const genHint = document.getElementById('genHint');
const inputPanel = document.getElementById('inputPanel');
const processGrid = document.getElementById('processGrid');
const computeBtn = document.getElementById('computeBtn');
const resetBtn = document.getElementById('resetBtn');
const errorBox = document.getElementById('errorBox');
const resultsPanel = document.getElementById('resultsPanel');
const resultsBody = document.getElementById('resultsBody');
const ganttChart = document.getElementById('ganttChart');
const avgWaitEl = document.getElementById('avgWait');
const avgTATEl = document.getElementById('avgTAT');

function showError(messages){
  errorBox.innerHTML = '<strong>Please fix the following:</strong><ul>' +
    messages.map(m => `<li>${m}</li>`).join('') + '</ul>';
  errorBox.classList.add('show');
}
function clearError(){
  errorBox.classList.remove('show');
  errorBox.innerHTML = '';
}

genBtn.addEventListener('click', () => {
  clearError();
  resultsPanel.classList.remove('show');
  const n = parseInt(numProcInput.value, 10);

  if (isNaN(n)) {
    genHint.textContent = 'Enter a number first.';
    genHint.style.color = 'var(--err)';
    inputPanel.style.display = 'none';
    return;
  }
  if (n < 3 || n > 10) {
    genHint.textContent = 'Number of processes must be between 3 and 10.';
    genHint.style.color = 'var(--err)';
    inputPanel.style.display = 'none';
    return;
  }
  genHint.textContent = '';

  processGrid.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'process-row';
  header.innerHTML = `
    <div></div>
    <div class="hint">Process ID</div>
    <div class="hint">Arrival time</div>
    <div class="hint">Burst time</div>`;
  processGrid.appendChild(header);

  for (let i = 1; i <= n; i++) {
    const row = document.createElement('div');
    row.className = 'process-row';
    row.innerHTML = `
      <div class="idx">${i}</div>
      <input type="text" class="pid">
      <div class="num-wrap">
        <input type="number" class="arrival" min="0">
        <div class="spin-group">
          <span class="spin spin-up"></span>
          <span class="spin spin-down"></span>
        </div>
      </div>
      <div class="num-wrap">
        <input type="number" class="burst" min="1">
        <div class="spin-group">
          <span class="spin spin-up"></span>
          <span class="spin spin-down"></span>
        </div>
      </div>`;
    processGrid.appendChild(row);
  }
  inputPanel.style.display = 'block';
});

resetBtn.addEventListener('click', () => {
  numProcInput.value = '';
  genHint.textContent = '';
  inputPanel.style.display = 'none';
  resultsPanel.classList.remove('show');
  clearError();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.spin-up, .spin-down');
  if (!btn) return;
  const input = btn.closest('.num-wrap').querySelector('input[type=number]');
  const min = input.min !== '' ? Number(input.min) : -Infinity;
  const max = input.max !== '' ? Number(input.max) : Infinity;
  let value = Number(input.value) || 0;
  value += btn.classList.contains('spin-up') ? 1 : -1;
  input.value = Math.min(max, Math.max(min, value));
});

computeBtn.addEventListener('click', () => {
  clearError();
  const pidInputs = [...document.querySelectorAll('.pid')];
  const arrivalInputs = [...document.querySelectorAll('.arrival')];
  const burstInputs = [...document.querySelectorAll('.burst')];

  const errors = [];
  const processes = [];

  pidInputs.forEach((el, i) => {
    const pid = el.value.trim();
    const arrivalRaw = arrivalInputs[i].value.trim();
    const burstRaw = burstInputs[i].value.trim();

    if (!pid) errors.push(`Process ${i+1}: process ID is required.`);
    if (arrivalRaw === '') errors.push(`Process ${i+1}: arrival time is required.`);
    if (burstRaw === '') errors.push(`Process ${i+1}: burst time is required.`);

    const arrival = Number(arrivalRaw);
    const burst = Number(burstRaw);

    if (arrivalRaw !== '' && (isNaN(arrival) || arrival < 0)) {
      errors.push(`Process ${i+1}: arrival time must be a number ≥ 0.`);
    }
    if (burstRaw !== '' && (isNaN(burst) || burst <= 0)) {
      errors.push(`Process ${i+1}: burst time must be a number greater than 0.`);
    }

    processes.push({ pid, arrival, burst });
  });

  // Unique process ID check
  const pidCounts = {};
  processes.forEach(p => {
    if (!p.pid) return;
    pidCounts[p.pid] = (pidCounts[p.pid] || 0) + 1;
  });
  Object.entries(pidCounts).forEach(([pid, count]) => {
    if (count > 1) errors.push(`Process ID "${pid}" is used ${count} times — process IDs must be unique.`);
  });

  // Unique arrival time check
  const arrivalCounts = {};
  processes.forEach(p => {
    if (isNaN(p.arrival)) return;
    arrivalCounts[p.arrival] = (arrivalCounts[p.arrival] || 0) + 1;
  });
  Object.entries(arrivalCounts).forEach(([t, count]) => {
    if (count > 1) errors.push(`Arrival time "${t}" is used by ${count} processes — arrival times must be unique.`);
  });

  if (errors.length) {
    showError(errors);
    resultsPanel.classList.remove('show');
    return;
  }

  runFCFS(processes);
});

function runFCFS(processes) {
  // FCFS: order strictly by arrival time
  const sorted = [...processes].sort((a, b) => a.arrival - b.arrival);

  let clock = 0;
  const results = sorted.map(p => {
    const start = Math.max(clock, p.arrival);
    const completion = start + p.burst;
    const turnaround = completion - p.arrival;
    const waiting = turnaround - p.burst;
    clock = completion;
    return { ...p, start, completion, turnaround, waiting };
  });

  // Render table
  resultsBody.innerHTML = results.map(r => `
    <tr>
      <td>${r.pid}</td>
      <td class="num">${r.arrival}</td>
      <td class="num">${r.burst}</td>
      <td class="num">${r.start}</td>
      <td class="num">${r.completion}</td>
      <td class="num">${r.turnaround}</td>
      <td class="num">${r.waiting}</td>
    </tr>`).join('');

  // Render Gantt chart — fixed scale normally, but shrink to fit if it would overflow
  const scale = 26; // px per time unit
  const availableWidth = ganttChart.clientWidth;
  const totalBurst = results.reduce((s, r) => s + r.burst, 0);
  const fitsAtFixedScale = totalBurst * scale <= availableWidth;

  ganttChart.innerHTML = results.map(r => {
    if (fitsAtFixedScale) {
      const width = Math.max(r.burst * scale, 50);
      return `
        <div class="gantt-block" style="width:${width}px; flex-shrink:0;">
          <div class="pid">${r.pid}</div>
          <div class="times">${r.start} &rarr; ${r.completion}</div>
        </div>`;
    } else {
      return `
        <div class="gantt-block" style="flex-grow:${r.burst}; flex-basis:0; min-width:0;">
          <div class="pid">${r.pid}</div>
          <div class="times">${r.start} &rarr; ${r.completion}</div>
        </div>`;
    }
  }).join('');

  const avgWait = results.reduce((s, r) => s + r.waiting, 0) / results.length;
  const avgTAT = results.reduce((s, r) => s + r.turnaround, 0) / results.length;
  avgWaitEl.textContent = avgWait.toFixed(2);
  avgTATEl.textContent = avgTAT.toFixed(2);

  resultsPanel.classList.add('show');
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
