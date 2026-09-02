let port = null, reader = null, keepReading = false;
let isLogging = false; // 🚩 FLAG BARU: Mencegah data di-plot sebelum tombol 'Mulai' dipencet
let allHistoryData = [];

const MAX_TABLE_ROWS = 50; 
const CALIB_STRAIGHT = 690;
const CALIB_BENT = 790;

const btnConnect = document.getElementById('btnConnect');
const btnStart = document.getElementById('btnStart'); // DOM Tombol Mulai
const btnExport = document.getElementById('btnExport');
const baudRateSelect = document.getElementById('baudRateSelect');
const statusBadge = document.getElementById('statusBadge');
const valRawEl = document.getElementById('valRaw');
const valFlexEl = document.getElementById('valFlex');
const valStatusEl = document.getElementById('valStatus');
const valCountEl = document.getElementById('valCount');
const historyTableBody = document.getElementById('historyTableBody');

if ('serial' in navigator) {
  navigator.serial.addEventListener('disconnect', (event) => {
    if (port && event.target === port) {
      disconnectSerial();
      alert("⚠️ Koneksi terputus! Kabel Serial USB terlepas mendadak.");
    }
  });
}

const ctx = document.getElementById('flexChart').getContext('2d');
const flexChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Nilai Analog (A0)',
      data: [],
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
      borderWidth: 2,
      fill: true,
      tension: 0.2,
      pointRadius: 2
    }]
  },
  options: {
    responsive: true,
    animation: false,
    scales: {
      x: { title: { display: true, text: 'Waktu' } },
      y: { 
        title: { display: true, text: 'Nilai ADC (A0)' },
        suggestedMin: 600,
        suggestedMax: 820
      }
    }
  }
});

async function toggleConnect() {
  if (port) { await disconnectSerial(); } else { await connectSerial(); }
}

// ⏯️ FUNGSI BARU: TOGGLE START / PAUSE STREAMING DATA
function toggleLogging() {
  if (!port) return;

  isLogging = !isLogging;

  if (isLogging) {
    btnStart.textContent = "⏸️ Jeda Stream";
    btnStart.className = "btn-pause";
  } else {
    btnStart.textContent = "▶️ Mulai Stream";
    btnStart.className = "btn-start";
  }
}

async function connectSerial() {
  try {
    const selectedBaud = parseInt(baudRateSelect.value) || 9600;

    port = await navigator.serial.requestPort();
    await port.open({ baudRate: selectedBaud });
    keepReading = true;

    baudRateSelect.disabled = true;
    btnConnect.textContent = "❌ Putuskan Koneksi";
    btnConnect.className = "btn-disconnect";
    statusBadge.textContent = "Terhubung";
    statusBadge.className = "status-badge status-connected";
    
    // AKTIFKAN TOMBOL MULAI SETELAH PORT TERHUBUNG
    btnStart.disabled = false;
    btnStart.textContent = "▶️ Mulai Stream";
    btnStart.className = "btn-start";

    readSerialData();
  } catch (err) {
    alert("Gagal menghubungkan ke Serial Port: " + err.message);
  }
}

async function readSerialData() {
  const textDecoder = new TextDecoderStream();
  port.readable.pipeTo(textDecoder.writable);
  const readerStream = textDecoder.readable.getReader();
  reader = readerStream;
  let buffer = '';

  while (keepReading) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.trim() !== "") processData(line.trim());
      }
    }
  }
}

function processData(rawDataStr) {
  // ⛔ CEK DULU: KALAU BELUM DIPENCET 'MULAI', ABAIKAN DATA MASUK
  if (!isLogging) return;

  const rawVal = parseInt(rawDataStr);
  if (isNaN(rawVal)) return;

  const timeStr = new Date().toLocaleTimeString();

  let flexPercent = Math.round(((rawVal - CALIB_STRAIGHT) / (CALIB_BENT - CALIB_STRAIGHT)) * 100);
  flexPercent = Math.max(0, Math.min(100, flexPercent));

  let pwmVal = Math.round(((rawVal - CALIB_STRAIGHT) / (CALIB_BENT - CALIB_STRAIGHT)) * 255);
  pwmVal = Math.max(0, Math.min(255, pwmVal));

  let statusTxt = flexPercent >= 80 ? "Tekuk Penuh (~90°)" : flexPercent >= 40 ? "Tekuk Sedang (~45°)" : flexPercent >= 15 ? "Mulai Menekuk (~30°)" : "Lurus (0°)";

  valRawEl.textContent = rawVal;
  valFlexEl.textContent = flexPercent + "%";
  valStatusEl.textContent = statusTxt;

  const dataRow = {
    no: allHistoryData.length + 1,
    waktu: timeStr,
    adc: rawVal,
    flex: flexPercent,
    status: statusTxt,
    pwm: pwmVal
  };
  
  allHistoryData.push(dataRow);
  valCountEl.textContent = allHistoryData.length;
  btnExport.disabled = false;

  updateHistoryTable(dataRow);
  updateChartDisplay();
}

function updateHistoryTable(newRow) {
  if (allHistoryData.length === 1) historyTableBody.innerHTML = '';
  
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><b>${newRow.no}</b></td>
    <td>${newRow.waktu}</td>
    <td>${newRow.adc}</td>
    <td>${newRow.flex}%</td>
    <td>${newRow.status}</td>
    <td>${newRow.pwm}</td>
  `;
  historyTableBody.insertBefore(tr, historyTableBody.firstChild);

  while (historyTableBody.children.length > MAX_TABLE_ROWS) {
    historyTableBody.removeChild(historyTableBody.lastChild);
  }
}

function updateChartDisplay() {
  const limitOption = document.getElementById('historyLimit').value;
  let filteredData = allHistoryData;

  if (limitOption !== "all") {
    const limit = parseInt(limitOption);
    filteredData = allHistoryData.slice(-limit);
  }

  flexChart.data.labels = filteredData.map(d => d.waktu);
  flexChart.data.datasets[0].data = filteredData.map(d => d.adc);
  flexChart.update();
}

function saveChartImage() {
  if (allHistoryData.length === 0) return alert("Belum ada data!");
  const canvas = document.getElementById('flexChart');
  const imageURI = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `grafik_sensor_flex_${new Date().toISOString().slice(0,10)}.png`;
  link.href = imageURI;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function disconnectSerial() {
  keepReading = false;
  isLogging = false; // Reset status logging
  
  if (reader) await reader.cancel();
  if (port) { await port.close(); port = null; }
  
  baudRateSelect.disabled = false;
  btnConnect.textContent = "🔌 Hubungkan Arduino";
  btnConnect.className = "btn-connect";

  // RESET TOMBOL START
  btnStart.disabled = true;
  btnStart.textContent = "▶️ Mulai Stream";
  btnStart.className = "btn-start";

  statusBadge.textContent = "Terputus";
  statusBadge.className = "status-badge status-disconnected";
}

function clearData() {
  if (confirm("Apakah Anda yakin ingin menghapus seluruh history data?")) {
    allHistoryData = [];
    flexChart.data.labels = [];
    flexChart.data.datasets[0].data = [];
    flexChart.update();
    historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Belum ada data masuk...</td></tr>';
    valRawEl.textContent = "690";
    valFlexEl.textContent = "0%";
    valCountEl.textContent = "0";
    valStatusEl.textContent = "Lurus (0°)";
    btnExport.disabled = true;
  }
}

function exportCSV() {
  if (allHistoryData.length === 0) return alert("Belum ada data!");
  let csv = "data:text/csv;charset=utf-8,No,Waktu,Nilai_ADC_A0,Tekukan_Persen,Status,PWM_LED\n";
  allHistoryData.forEach(r => { csv += `${r.no},${r.waktu},${r.adc},${r.flex},${r.status},${r.pwm}\n`; });
  const link = document.createElement("a");
  link.href = encodeURI(csv);
  link.download = `history_sensor_flex_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}