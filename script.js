const numProcInput = document.getElementById('numProc');
const inputPanel = document.getElementById('inputPanel');
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

function generateFields() {
  clearError();
  resultsPanel.classList.remove('show');
  const n = parseInt(numProcInput.value, 10);

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
      <div class="pid-wrap">
        <input type="text" class="pid">
        <div class="pid-warn"></div>
      </div>
      <div class="num-wrap">
        <input type="text" inputmode="numeric" class="arrival">
        <div class="pid-warn"></div>
      </div>
      <div class="num-wrap">
        <input type="text" inputmode="numeric" class="burst">
        <div class="pid-warn"></div>
      </div>`;
    processGrid.appendChild(row);
  }
}

numProcInput.addEventListener('change', generateFields);
generateFields();

resetBtn.addEventListener('click', () => {
  numProcInput.value = '3';
  generateFields();
});

document.addEventListener('input', (e) => {
  const input = e.target;

  if (input.classList.contains('pid')) {
    const warn = input.closest('.pid-wrap').querySelector('.pid-warn');
    const cleaned = input.value.replace(/[^A-Za-z0-9]/g, '');
    if (cleaned !== input.value) {
      warn.textContent = 'Special characters and spaces are not allowed.';
      warn.classList.add('show');
      input.value = cleaned;
    } else {
      warn.classList.remove('show');
    }
    return;
  }

  if (input.classList.contains('arrival') || input.classList.contains('burst')) {
    const warn = input.closest('.num-wrap').querySelector('.pid-warn');
    const cleaned = input.value.replace(/[^0-9]/g, '');
    if (cleaned !== input.value) {
      warn.textContent = 'Only whole numbers are allowed.';
      warn.classList.add('show');
      input.value = cleaned;
    } else {
      warn.classList.remove('show');
    }
  }
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

    if (!pid) {
      errors.push(`Process ${i+1}: process ID is required.`);
    } else if (!/^[A-Za-z0-9]+$/.test(pid)) {
      errors.push(`Process ${i+1}: process ID "${pid}" can only contain letters and numbers — no spaces or special symbols.`);
    }
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
  processes.forEach((p, i) => {
    if (arrivalInputs[i].value.trim() === '' || isNaN(p.arrival)) return;
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
  avgWaitEl.textContent = avgWait.toFixed(2) + ' ms';
  avgTATEl.textContent = avgTAT.toFixed(2) + ' ms';

  resultsPanel.classList.add('show');
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
