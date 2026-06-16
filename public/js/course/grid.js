// ── Grid view: seat grid rendering, stats, and conflict detection ──
// Depends on: window.COURSE_ID, window.COURSE_MAX_ROW, window.COURSE_MAX_COL, window.COURSE_TOTAL_STUDENTS

// Shared state for picker highlight
let prevCell = null;

// Shared state for area selection
let selectionRect = null;   // { rowMin, rowMax, colMin, colMax } or null
let isDragging = false;
let dragStart = null;

function updateGrid() {
  fetch('/teacher/api/course/' + window.COURSE_ID + '/checkins')
    .then(r => r.json())
    .then(checkins => {
      rebuildGrid(checkins);
    });
}

function rebuildGrid(checkins) {
  const grid = document.getElementById('seatGrid');
  if (!grid) return;

  const maxRow = window.COURSE_MAX_ROW;
  const maxCol = window.COURSE_MAX_COL;

  // Build seat lookup
  const seatMap = {};
  checkins.forEach(c => {
    const key = c.row + '-' + c.col;
    if (!seatMap[key]) seatMap[key] = [];
    seatMap[key].push(c);
  });

  // Update each cell (col-sep cells have no data-col, skipped automatically)
  for (let r = 1; r <= maxRow; r++) {
    for (let co = 1; co <= maxCol; co++) {
      const key = r + '-' + co;
      const cell = grid.querySelector(`td[data-row="${r}"][data-col="${co}"]`);
      if (!cell) continue;
      const entries = seatMap[key] || [];
      delete cell.dataset.checkinId;
      delete cell.dataset.studentId;
      delete cell.dataset.studentName;

      if (entries.length >= 2) {
        cell.className = 'seat-conflict';
        cell.textContent = entries.map(s => s.name).join('/');
        cell.title = `${r}行${co}列 - 冲突! ${entries.map(s => s.name).join(', ')}`;
      } else if (entries.length === 1) {
        cell.className = 'seat-taken';
        cell.textContent = entries[0].name;
        cell.title = `${r}行${co}列 - ${entries[0].student_id} ${entries[0].name}`;
        cell.dataset.checkinId = entries[0].id;
        cell.dataset.studentId = entries[0].student_id;
        cell.dataset.studentName = entries[0].name;
      } else {
        cell.className = 'seat-empty';
        cell.textContent = '';
        cell.title = `${r}行${co}列 - 空位`;
      }
    }
  }

  // Re-apply selection rect if active (preserved across SSE rebuilds)
  if (selectionRect) {
    applySelectionClasses();
  }
}

function updateStats() {
  fetch('/teacher/api/course/' + window.COURSE_ID + '/checkins')
    .then(r => r.json())
    .then(checkins => {
      const total = window.COURSE_TOTAL_STUDENTS || 0;
      document.getElementById('checkedCount').textContent = checkins.length;

      const absentEl = document.getElementById('absentCount');
      if (absentEl) {
        absentEl.textContent = Math.max(0, total - checkins.length);
      }

      const rateEl = document.getElementById('rateCount');
      if (rateEl && total > 0) {
        rateEl.textContent = Math.round(checkins.length / total * 100) + '%';
      }

      // Update conflict count
      const seatMap = {};
      checkins.forEach(c => {
        const key = c.row + '-' + c.col;
        seatMap[key] = (seatMap[key] || 0) + 1;
      });
      const conflicts = Object.values(seatMap).filter(v => v > 1).length;
      const conflictCard = document.getElementById('conflictCard');
      const conflictCount = document.getElementById('conflictCount');
      if (conflictCard && conflictCount) {
        conflictCount.textContent = conflicts;
        conflictCard.style.display = conflicts > 0 ? '' : 'none';
      }
    });
}

// Highlight a seat cell (called by random picker)
function highlightCell(row, col) {
  // Remove previous highlight
  if (prevCell) {
    prevCell.classList.remove('seat-picking');
    if (prevCell.dataset.origClass) {
      prevCell.className = prevCell.dataset.origClass;
    }
  }

  const grid = document.getElementById('seatGrid');
  if (!grid) return;
  const cell = grid.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
  if (cell) {
    if (!cell.dataset.origClass) {
      cell.dataset.origClass = cell.className;
    }
    cell.classList.add('seat-picking');
    prevCell = cell;
  }
}

// Clear all pick highlights (called when closing/restarting pick)
function clearPickHighlight() {
  if (prevCell) {
    prevCell.classList.remove('seat-picking', 'seat-picked');
    if (prevCell.dataset.origClass) {
      prevCell.className = prevCell.dataset.origClass;
    }
    prevCell = null;
  }
}

// ── Rectangular area selection for area-restricted random pick ──

function initGridSelection() {
  const grid = document.getElementById('seatGrid');
  if (!grid) return;

  var lastValid = null;  // last valid cell during drag

  grid.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    // Only allow selection when picker is idle/result
    var ps = typeof pickState !== 'undefined' ? pickState : 'idle';
    if (ps !== 'idle' && ps !== 'result') return;

    var td = e.target.closest('td[data-row][data-col]');
    if (!td) return;

    var row = parseInt(td.dataset.row);
    var col = parseInt(td.dataset.col);

    // Click inside existing selection → toggle off
    if (selectionRect &&
        row >= selectionRect.rowMin && row <= selectionRect.rowMax &&
        col >= selectionRect.colMin && col <= selectionRect.colMax) {
      clearSelection();
      return;
    }

    // Start new drag
    isDragging = true;
    dragStart = { row: row, col: col };
    lastValid = { row: row, col: col };
    clearAllSelectionClasses();
    selectionRect = null;
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    var td = e.target.closest('td[data-row][data-col]');
    if (!td) return;
    lastValid = { row: parseInt(td.dataset.row), col: parseInt(td.dataset.col) };
    renderSelectionPreview({
      rowMin: Math.min(dragStart.row, lastValid.row),
      rowMax: Math.max(dragStart.row, lastValid.row),
      colMin: Math.min(dragStart.col, lastValid.col),
      colMax: Math.max(dragStart.col, lastValid.col)
    });
  });

  document.addEventListener('mouseup', function(e) {
    if (!isDragging) return;
    isDragging = false;
    if (!lastValid) { dragStart = null; return; }

    selectionRect = {
      rowMin: Math.min(dragStart.row, lastValid.row),
      rowMax: Math.max(dragStart.row, lastValid.row),
      colMin: Math.min(dragStart.col, lastValid.col),
      colMax: Math.max(dragStart.col, lastValid.col)
    };
    dragStart = null;
    lastValid = null;

    clearAllSelectionClasses();
    applySelectionClasses();
    updatePickButtonLabel();
    updateResetSeatButton();
  });

}

function updateResetSeatButton() {
  var btn = document.getElementById('btnResetSeat');
  if (!btn) return;

  // Enable only for 1x1 selection on an occupied cell
  if (selectionRect &&
      selectionRect.rowMin === selectionRect.rowMax &&
      selectionRect.colMin === selectionRect.colMax) {
    var cell = document.querySelector(
      'td[data-row="' + selectionRect.rowMin + '"][data-col="' + selectionRect.colMin + '"]');
    if (cell && cell.dataset.checkinId) {
      btn.disabled = false;
      return;
    }
  }
  btn.disabled = true;
}

function renderSelectionPreview(rect) {
  const grid = document.getElementById('seatGrid');
  if (!grid) return;
  grid.querySelectorAll('td[data-row][data-col]').forEach(function(cell) {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    if (r >= rect.rowMin && r <= rect.rowMax && c >= rect.colMin && c <= rect.colMax) {
      cell.classList.add('seat-selecting');
    } else {
      cell.classList.remove('seat-selecting');
    }
  });
}

function clearAllSelectionClasses() {
  const grid = document.getElementById('seatGrid');
  if (!grid) return;
  grid.querySelectorAll('td[data-row][data-col]').forEach(function(cell) {
    cell.classList.remove('seat-selecting', 'seat-selected');
    delete cell.dataset.origClass;  // force re-save on next highlightCell visit
  });
}

function applySelectionClasses() {
  const grid = document.getElementById('seatGrid');
  if (!grid) return;

  // Clear any leftover preview class
  grid.querySelectorAll('td[data-row][data-col]').forEach(function(cell) {
    cell.classList.remove('seat-selecting');
  });

  if (!selectionRect) return;

  grid.querySelectorAll('td[data-row][data-col]').forEach(function(cell) {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    if (r >= selectionRect.rowMin && r <= selectionRect.rowMax &&
        c >= selectionRect.colMin && c <= selectionRect.colMax) {
      cell.classList.add('seat-selected');
    } else {
      cell.classList.remove('seat-selected');
    }
  });
}

function clearSelection() {
  selectionRect = null;
  clearAllSelectionClasses();
  updatePickButtonLabel();
  updateResetSeatButton();
}

function updatePickButtonLabel() {
  const btn = document.getElementById('btnPick');
  if (!btn) return;
  if (typeof pickState !== 'undefined' && pickState !== 'idle') return;
  // Only show "area pick" when selection covers 2+ cells
  var isMulti = selectionRect &&
    !(selectionRect.rowMin === selectionRect.rowMax && selectionRect.colMin === selectionRect.colMax);
  btn.textContent = isMulti ? '🎲 区域内点名' : '🎲 随机点名';
}

// Init selection: scripts are at end of body, DOM is already parsed
initGridSelection();
