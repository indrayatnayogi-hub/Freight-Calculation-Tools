const dropZone = document.getElementById('dropZone');
const rawText = document.getElementById('rawText');
const ocrStatus = document.getElementById('ocrStatus');
const calculateBtn = document.getElementById('calculateBtn');
const copyBtn = document.getElementById('copyBtn');
const resultSection = document.getElementById('resultSection');
const resultBody = document.getElementById('resultBody');
const totalCbmEl = document.getElementById('totalCbm');
const totalCgwtEl = document.getElementById('totalCgwt');

function format2(n) {
  return Number(n).toFixed(2);
}

function parseLine(line) {
  const cleaned = line.replace(/,/g, '.');
  const dimQtyRegex = /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)(?:\s*(?:cm|cms|mm|m))?.{0,20}?\b(?:x|qty|q'ty|pcs|piece|ctn)?\s*(\d+(?:\.\d+)?)/i;
  const dimOnlyRegex = /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/i;

  let match = cleaned.match(dimQtyRegex);
  if (match) {
    return {
      p: parseFloat(match[1]),
      l: parseFloat(match[2]),
      t: parseFloat(match[3]),
      q: parseFloat(match[4])
    };
  }

  match = cleaned.match(dimOnlyRegex);
  if (match) {
    return {
      p: parseFloat(match[1]),
      l: parseFloat(match[2]),
      t: parseFloat(match[3]),
      q: 1
    };
  }

  return null;
}

function calculateFromText() {
  const lines = rawText.value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  const rows = [];
  let totalCbm = 0;
  let totalCgwt = 0;

  lines.forEach((line) => {
    const dims = parseLine(line);
    if (!dims) return;

    const { p, l, t, q } = dims;
    const cbm = (p * l * t * q) / 1000000;
    const cgwt = (p * l * t * q) / 6000;

    totalCbm += cbm;
    totalCgwt += cgwt;

    rows.push({
      dimensi: `${p}x${l}x${t}`,
      qty: q,
      cbm,
      cgwt
    });
  });

  renderTable(rows, totalCbm, totalCgwt);
}

function renderTable(rows, totalCbm, totalCgwt) {
  resultBody.innerHTML = '';
  if (!rows.length) {
    resultSection.hidden = false;
    totalCbmEl.textContent = '0.00';
    totalCgwtEl.textContent = '0.00';
    copyBtn.disabled = true;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4">Tidak ada baris yang cocok dengan pola dimensi.</td>';
    resultBody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.dimensi}</td>
      <td>${format2(row.qty)}</td>
      <td>${format2(row.cbm)}</td>
      <td>${format2(row.cgwt)}</td>
    `;
    resultBody.appendChild(tr);
  });

  totalCbmEl.textContent = format2(totalCbm);
  totalCgwtEl.textContent = format2(totalCgwt);
  resultSection.hidden = false;
  copyBtn.disabled = false;
}

async function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  ocrStatus.textContent = 'Membaca gambar...';
  try {
    const { data } = await Tesseract.recognize(file, 'eng');
    rawText.value = data.text?.trim() || '';
    ocrStatus.textContent = 'OCR selesai.';
    calculateFromText();
  } catch (error) {
    console.error(error);
    ocrStatus.textContent = 'Gagal membaca gambar.';
  }
}

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

['dragleave', 'dragend'].forEach((evt) => {
  dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'));
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  handleImageFile(file);
});

document.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items || [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      handleImageFile(file);
      break;
    }
  }
});

calculateBtn.addEventListener('click', calculateFromText);

copyBtn.addEventListener('click', async () => {
  const table = document.getElementById('resultTable');
  let text = 'Dimensi (PxLxT)\tQty\tCBM\tCGWT (kg)\n';

  [...resultBody.querySelectorAll('tr')].forEach((tr) => {
    const cols = [...tr.children].map((td) => td.textContent.trim());
    if (cols.length === 4) {
      text += `${cols.join('\t')}\n`;
    }
  });

  text += `GRAND TOTAL\t\t${totalCbmEl.textContent}\t${totalCgwtEl.textContent}`;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy Table'; }, 1300);
  } catch {
    copyBtn.textContent = 'Copy gagal';
    setTimeout(() => { copyBtn.textContent = 'Copy Table'; }, 1300);
  }
});
