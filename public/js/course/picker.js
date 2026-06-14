// ── Random Pick: rolling name selector with speed progression ──
// Depends on: window.COURSE_ID, switchView(), highlightCell(), clearPickHighlight(), prevCell

let pickState = 'idle';        // idle | running | result
let pickTimer = null;
let pickInterval = 50;         // current ms between switches
let pickPhase = 0;             // 0=fast, 1=mid, 2=slow
let pickStartTime = 0;
let pickStudents = [];         // shuffled checked-in students
let pickIndex = -1;
let pickCurrent = null;        // currently highlighted student
let pickResult = null;         // final result

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function togglePick() {
  if (pickState === 'idle') startPick();
  else if (pickState === 'running') stopPick();
  else if (pickState === 'result') restartPick();
}

async function startPick() {
  // Fetch current checkins
  let checkins = [];
  try {
    const res = await fetch('/teacher/api/course/' + window.COURSE_ID + '/checkins');
    checkins = await res.json();
  } catch { return; }

  // Filter by selection rect if active
  if (selectionRect) {
    checkins = checkins.filter(function(c) {
      return c.row >= selectionRect.rowMin && c.row <= selectionRect.rowMax &&
             c.col >= selectionRect.colMin && c.col <= selectionRect.colMax;
    });
    if (checkins.length === 0) {
      alert('该区域内暂无已签到学生');
      return;
    }
  } else {
    if (checkins.length === 0) {
      alert('暂无已签到学生');
      return;
    }
  }

  pickStudents = shuffle(checkins);
  pickIndex = -1;
  pickInterval = 50;
  pickPhase = 0;
  pickResult = null;
  pickCurrent = null;

  // Switch to grid view
  switchView('grid');

  // Update button state
  const btn = document.getElementById('btnPick');
  btn.textContent = '⏹ 停止';
  btn.classList.add('running');
  pickState = 'running';

  // Show overlay
  document.getElementById('pickOverlay').style.display = 'flex';
  document.getElementById('pickCard').classList.remove('result');
  document.getElementById('pickAvatar').textContent = '🎲';
  document.getElementById('pickName').textContent = '...';
  document.getElementById('pickInfo').textContent = '随机选择中';
  document.getElementById('pickActions').style.display = 'none';

  pickStartTime = Date.now();
  cyclePick();
}

function cyclePick() {
  if (pickState !== 'running') return;

  // Advance index
  pickIndex = (pickIndex + 1) % pickStudents.length;
  pickCurrent = pickStudents[pickIndex];

  // Highlight grid cell
  highlightCell(pickCurrent.row, pickCurrent.col);

  // Update overlay
  document.getElementById('pickAvatar').textContent = pickCurrent.name.charAt(0);
  document.getElementById('pickName').textContent = pickCurrent.name;
  document.getElementById('pickInfo').textContent = `${pickCurrent.student_id} · ${pickCurrent.row}行${pickCurrent.col}列`;

  // Speed progression
  const elapsed = Date.now() - pickStartTime;
  if (elapsed > 3000) {
    pickInterval = 300; pickPhase = 2;
  } else if (elapsed > 1000) {
    pickInterval = 150; pickPhase = 1;
  }

  // Auto-stop after ~4s
  if (elapsed > 4000) {
    stopPick();
    return;
  }

  pickTimer = setTimeout(cyclePick, pickInterval);
}

function stopPick() {
  if (pickState !== 'running') return;

  pickState = 'result';
  clearTimeout(pickTimer);
  pickResult = pickCurrent;

  const btn = document.getElementById('btnPick');
  btn.textContent = '🎲 重新点名';
  btn.classList.remove('running');

  // Update overlay to result state
  const card = document.getElementById('pickCard');
  card.classList.add('result');
  document.getElementById('pickAvatar').textContent = pickResult ? pickResult.name.charAt(0) : '?';
  document.getElementById('pickName').textContent = pickResult ? pickResult.name : '';
  document.getElementById('pickInfo').textContent = pickResult
    ? `${pickResult.student_id} · ${pickResult.row}行${pickResult.col}列`
    : '';
  document.getElementById('pickActions').style.display = 'flex';

  // Change grid cell to final state
  if (prevCell) {
    prevCell.classList.remove('seat-picking');
    prevCell.classList.add('seat-picked');
  }
}

function confirmPick() {
  document.getElementById('pickOverlay').style.display = 'none';
  pickState = 'idle';
  document.getElementById('btnPick').classList.remove('running');
  document.getElementById('btnPick').textContent = '🎲 随机点名';
  resetSelectionToFullGrid();
}

function restartPick() {
  clearPickHighlight();
  pickState = 'idle';
  document.getElementById('btnPick').classList.remove('running');
  // Keep area selection — restart within same area
  document.getElementById('btnPick').textContent = selectionRect ? '🎲 区域内点名' : '🎲 随机点名';
  startPick();
}

function closePick() {
  pickState = 'idle';
  clearTimeout(pickTimer);
  document.getElementById('pickOverlay').style.display = 'none';
  document.getElementById('btnPick').classList.remove('running');
  clearPickHighlight();
  pickResult = null;
  document.getElementById('btnPick').textContent = '🎲 随机点名';
  resetSelectionToFullGrid();
}

// Directly reset area selection — no dependency on external functions
function resetSelectionToFullGrid() {
  selectionRect = null;
  var grid = document.getElementById('seatGrid');
  if (grid) {
    grid.querySelectorAll('td.seat-selecting, td.seat-selected').forEach(function(c) {
      c.classList.remove('seat-selecting', 'seat-selected');
    });
  }
}
