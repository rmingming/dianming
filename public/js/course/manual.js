// ── Manual checkin: add absent students ──
// Depends on: window.COURSE_ID, esc()

let selectedManualStudent = null;

async function showManualForm() {
  const form = document.getElementById('manualForm');
  form.style.display = 'block';
  document.getElementById('selectedStudent').style.display = 'none';
  selectedManualStudent = null;

  const container = document.getElementById('absentListContainer');
  container.innerHTML = '<p class="loading-text">加载中...</p>';

  try {
    const res = await fetch('/teacher/course/' + window.COURSE_ID + '/absent');
    const absentList = await res.json();

    if (absentList.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">✅ 所有学生已签到完毕</p>';
      return;
    }

    container.innerHTML = `
      <table class="checkin-table">
        <thead><tr><th>学号</th><th>姓名</th><th>操作</th></tr></thead>
        <tbody>
          ${absentList.map(s => `
            <tr id="absent-${s.student_id}">
              <td>${esc(s.student_id)}</td>
              <td>${esc(s.name)}</td>
              <td><button class="btn btn-sm btn-primary" onclick="selectStudent('${esc(s.student_id)}', '${esc(s.name)}')">选择</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    container.innerHTML = '<p class="alert alert-error">加载失败，请重试</p>';
  }
}

function selectStudent(sid, name) {
  selectedManualStudent = { studentId: sid, name };
  document.getElementById('selectedInfo').textContent = `${sid} ${name}`;
  document.getElementById('selectedStudent').style.display = 'block';
  // Highlight selected row
  document.querySelectorAll('#absentListContainer tbody tr').forEach(r => r.style.background = '');
  const row = document.getElementById('absent-' + sid);
  if (row) row.style.background = '#dbeafe';
}

function clearManualSelection() {
  selectedManualStudent = null;
  var el = document.getElementById('selectedStudent');
  if (el) el.style.display = 'none';
  document.querySelectorAll('#absentListContainer tbody tr').forEach(function(r) { r.style.background = ''; });
}

async function manualCheckin(e) {
  e.preventDefault();
  if (!selectedManualStudent) {
    alert('请先从列表中选择一个学生');
    return;
  }
  const row = parseInt(document.getElementById('manualRow').value);
  const col = parseInt(document.getElementById('manualCol').value);
  if (!row || !col) {
    alert('请填写行和列');
    return;
  }

  const data = {
    studentId: selectedManualStudent.studentId,
    name: selectedManualStudent.name,
    row, col,
  };

  const res = await fetch('/teacher/course/' + window.COURSE_ID + '/checkins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await res.json();

  if (result.success) {
    // Remove student from absent list
    const rowEl = document.getElementById('absent-' + selectedManualStudent.studentId);
    if (rowEl) rowEl.remove();
    // Check if all absent now gone
    const remaining = document.querySelectorAll('#absentListContainer tbody tr');
    if (remaining.length === 0) {
      document.getElementById('absentListContainer').innerHTML = '<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">✅ 所有学生已签到完毕</p>';
    }
    // Clear selection
    clearManualSelection();
    // Reset form
    document.getElementById('manualRow').value = '';
    document.getElementById('manualCol').value = '';
    alert('签到成功');
  } else {
    alert(result.error || '添加失败');
  }
}
