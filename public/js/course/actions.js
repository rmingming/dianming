// ── Course actions: start, end, delete, QR code, password, copy URL ──
// Depends on: window.COURSE_ID, window.COURSE_NAME

async function startCourse() {
  const res = await fetch('/teacher/course/' + window.COURSE_ID + '/start', { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    document.getElementById('passwordDisplay').textContent = data.password;
    alert('课程已重新开始！新口令：' + data.password);
    location.reload();
  }
}

async function endCourse() {
  if (!confirm('确定要结束签到吗？结束后学生将无法签到。')) return;
  const res = await fetch('/teacher/course/' + window.COURSE_ID + '/end', { method: 'POST' });
  const data = await res.json();
  if (data.success) { location.reload(); }
}

async function deleteCourse() {
  if (!confirm('确定要删除课程 "' + window.COURSE_NAME + '" 吗？\n\n此操作会同时删除该课程的所有签到记录和学生名单，且不可恢复。')) return;
  if (!confirm('再次确认：真的要删除吗？')) return;
  const res = await fetch('/teacher/course/' + window.COURSE_ID + '/delete', { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    alert('课程已删除');
    location.href = '/teacher/dashboard';
  } else {
    alert(data.error || '删除失败');
  }
}

async function copyCheckinUrl() {
  const pwd = document.getElementById('passwordDisplay').textContent.trim();
  const url = location.origin + '/student?code=' + pwd;
  try {
    await navigator.clipboard.writeText(url);
    alert('已复制签到地址：\n' + url);
  } catch {
    prompt('请手动复制：', url);
  }
}

async function regeneratePassword() {
  const res = await fetch('/teacher/course/' + window.COURSE_ID + '/regenerate-password', { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    document.getElementById('passwordDisplay').textContent = data.password;
    const qrPwd = document.getElementById('qrPassword');
    if (qrPwd) qrPwd.textContent = data.password;
    const qrImg = document.getElementById('qrImage');
    if (qrImg && qrImg.src) {
      qrImg.src = '/teacher/course/' + window.COURSE_ID + '/qrcode?' + Date.now();
    }
  }
}

async function resetAllCheckins() {
  if (!confirm('确定要重置该课程的全部签到记录吗？\n\n此操作会将所有学生的签到状态清除，恢复为无人签到状态。此操作不可恢复。')) return;

  const res = await fetch('/teacher/course/' + window.COURSE_ID + '/reset-all', { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    alert('已重置全部签到记录');
    location.reload();
  } else {
    alert(data.error || '重置失败');
  }
}

function resetSelectedSeat() {
  var cell = document.querySelector('td.seat-selected[data-checkin-id]');
  if (!cell) return;

  var checkinId = cell.dataset.checkinId;
  var sid = cell.dataset.studentId;
  var name = cell.dataset.studentName;
  var row = cell.dataset.row;
  var col = cell.dataset.col;

  if (!confirm('确定要重置 ' + sid + ' ' + name + ' 的签到（' + row + '行' + col + '列）吗？\n\n重置后该学生可重新签到。')) return;

  fetch('/teacher/course/' + window.COURSE_ID + '/checkins/' + checkinId, { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        updateGrid();
        updateStats();
      } else {
        alert(data.error || '重置失败');
      }
    });
}

function showQR() {
  const modal = document.getElementById('qrModal');
  const img = document.getElementById('qrImage');
  img.src = '/teacher/course/' + window.COURSE_ID + '/qrcode?' + Date.now();
  modal.style.display = 'flex';
}

function hideQR(e) {
  if (e.target === e.currentTarget) {
    document.getElementById('qrModal').style.display = 'none';
  }
}
