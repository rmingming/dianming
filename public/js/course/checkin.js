// ── List view: checkin row management ──
// Depends on: window.COURSE_ID, esc(), updateGrid(), updateStats()

function resetCheckin(id, sid, name, row, col) {
  if (!confirm(`确定要重置 ${sid} ${name} 的签到（${row}行${col}列）吗？\n\n重置后该学生可重新签到。`)) return;

  fetch('/teacher/course/' + window.COURSE_ID + '/checkins/' + id, { method: 'DELETE' })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        const rowEl = document.getElementById('row-' + id);
        if (rowEl) rowEl.remove();
        updateGrid();
        updateStats();
      }
    });
}

function addCheckinRow(c) {
  const tbody = document.getElementById('checkinTbody');
  const row = tbody.insertRow();
  row.id = 'row-' + c.id;
  const count = tbody.rows.length;
  row.innerHTML = `
    <td>${count}</td>
    <td>${esc(c.student_id)}</td>
    <td>${esc(c.name)}</td>
    <td>${c.row}</td>
    <td>${c.col}</td>
    <td>${c.created_at}</td>
    <td><button class="btn btn-sm btn-danger" onclick="resetCheckin(${c.id}, '${esc(c.student_id)}', '${esc(c.name)}', ${c.row}, ${c.col})">重置</button></td>
  `;
  refreshConflicts();
}

function removeCheckinRow(id) {
  const row = document.getElementById('row-' + id);
  if (row) row.remove();
  refreshConflicts();
}

function refreshConflicts() {
  const tbody = document.getElementById('checkinTbody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  const seatCount = {};
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if (cells.length >= 6) {
      const rowNum = cells[3].textContent;
      const colNum = cells[4].textContent;
      const key = rowNum + '-' + colNum;
      seatCount[key] = (seatCount[key] || 0) + 1;
    }
  });
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    if (cells.length >= 6) {
      const rowNum = cells[3].textContent;
      const colNum = cells[4].textContent;
      const key = rowNum + '-' + colNum;
      r.classList.toggle('row-conflict', seatCount[key] > 1);
    }
  });
}
