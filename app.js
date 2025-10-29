const fileInput = document.getElementById('fileInput');
const drop = document.getElementById('drop');
const uploadBtn = document.getElementById('uploadBtn');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');
const fileInfo = document.getElementById('fileInfo');
const resultsCard = document.getElementById('results');
const tableBody = document.querySelector('#table tbody');
const summary = document.getElementById('summary');
const selectAllBtn = document.getElementById('selectAll');
const deselectAllBtn = document.getElementById('deselectAll');
const exportZipBtn = document.getElementById('exportZip');

let lastUpload = null; // { uploadedFilename, domains: [...] }
let chosenFile = null;

drop.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  chosenFile = e.target.files[0] || null;
  fileInfo.textContent = chosenFile ? `${chosenFile.name} (${Math.round(chosenFile.size/1024)} KB)` : 'No file chosen';
});

['dragenter','dragover'].forEach(ev => {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('hover'); });
});
['dragleave','drop'].forEach(ev => {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('hover'); });
});
drop.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) {
    fileInput.files = e.dataTransfer.files;
    chosenFile = f;
    fileInfo.textContent = `${f.name} (${Math.round(f.size/1024)} KB)`;
  }
});

clearBtn.addEventListener('click', () => {
  fileInput.value = '';
  chosenFile = null;
  fileInfo.textContent = 'No file chosen';
  status.textContent = 'Ready';
  resultsCard.classList.add('hidden');
  tableBody.innerHTML = '';
  lastUpload = null;
});

uploadBtn.addEventListener('click', async () => {
  if (!chosenFile) { alert('Choose a .txt file first'); return; }
  status.textContent = 'Analyzing…';

  const text = await chosenFile.text();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');

  // Extract email:pass only
  const emailPassRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}):([^\s]+)/;
  const domainMap = {};

  lines.forEach(line => {
    const match = line.match(emailPassRegex);
    if (match) {
      const email = match[1];
      const pass = match[2];
      const domain = email.split('@')[1].toLowerCase();
      if (!domainMap[domain]) domainMap[domain] = [];
      domainMap[domain].push(`${email}:${pass}`);
    }
  });

  const domains = Object.keys(domainMap).map((d) => ({
    domain: d,
    count: domainMap[d].length,
    lines: domainMap[d]
  }));

  lastUpload = { uploadedFilename: chosenFile.name, domains };
  renderResults(lastUpload);
  status.textContent = 'Analysis complete';
});

function renderResults(data) {
  resultsCard.classList.remove('hidden');
  tableBody.innerHTML = '';
  summary.textContent = `${data.domains.reduce((a,b)=>a+b.count,0)} emails • ${data.domains.length} domains`;

  data.domains.forEach((row, i) => {
    const tr = document.createElement('tr');
    const id = `chk_${i}`;
    tr.innerHTML = `
      <td><input type="checkbox" id="${id}" data-domain="${row.domain}" checked /></td>
      <td>${i+1}</td>
      <td><strong>${escapeHtml(row.domain)}</strong></td>
      <td>${row.count}</td>
    `;
    tableBody.appendChild(tr);
  });
}

selectAllBtn.addEventListener('click', () => {
  document.querySelectorAll('#table tbody input[type=checkbox]').forEach(cb => cb.checked = true);
});
deselectAllBtn.addEventListener('click', () => {
  document.querySelectorAll('#table tbody input[type=checkbox]').forEach(cb => cb.checked = false);
});

exportZipBtn.addEventListener('click', async () => {
  if (!lastUpload) return alert('Upload and analyze a file first');
  const checked = Array.from(document.querySelectorAll('#table tbody input[type=checkbox]:checked')).map(cb => cb.dataset.domain);
  if (!checked.length) return alert('Select at least one domain to export');

  const JSZip = window.JSZip ? window.JSZip : await import('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js').then(m=>m.default);
  const zip = new JSZip();

  checked.forEach(domain => {
    const entry = lastUpload.domains.find(d => d.domain === domain);
    if(entry){
      const filename = `${domain}_${entry.count}.txt`; // filename with domain and count
      zip.file(filename, entry.lines.join('\n'));
    }
  });

  status.textContent = 'Preparing ZIP…';
  zip.generateAsync({type:'blob'}).then(blob=>{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `domains_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    status.textContent = 'ZIP downloaded';
  });
});

function escapeHtml(str){ 
  return (''+str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[ch]));
}
