const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Page: Student verify (enter password, or auto-verify via QR code param) ──
router.get('/', (req, res) => {
  const code = req.query.code;

  // If QR code URL parameter is present, auto-verify server-side
  if (code && /^\d{4}$/.test(code)) {
    const course = db.get(
      `SELECT id, name, password, max_row, max_col, status
       FROM courses
       WHERE password = ? AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [code]
    );
    if (course) {
      // Directly render checkin form — student skips password entry entirely
      return res.render('student/checkin', {
        course,
        error: null,
        success: null,
        formData: {},
      });
    }
    // Invalid code, fall through to show verify page with error
    return res.render('student/verify', { error: '口令无效或课程已结束，请联系教师确认' });
  }

  res.render('student/verify', { error: null });
});

// ── API: Verify course password ──
router.post('/verify', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.render('student/verify', { error: '请输入课程口令' });
  }

  // Find active course with this password (most recently created first)
  const course = db.get(
    `SELECT id, name, password, max_row, max_col, status
     FROM courses
     WHERE password = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [password]
  );

  if (!course) {
    return res.render('student/verify', { error: '口令无效或课程已结束，请确认口令是否正确' });
  }

  // Render the checkin form
  res.render('student/checkin', {
    course,
    error: null,
    success: null,
    formData: {},
  });
});

// ── API: Submit checkin ──
router.post('/checkin', (req, res) => {
  const { courseId, studentId, name, row, col } = req.body;

  // Validate all fields present
  if (!courseId || !studentId || !name || !row || !col) {
    return renderCheckinError(req, res, { studentId, name, row, col }, '所有字段都必须填写');
  }

  const course = db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!course) {
    return renderCheckinError(req, res, { studentId, name, row, col }, '课程不存在');
  }
  if (course.status === 'ended') {
    return renderCheckinError(req, res, { studentId, name, row, col }, '该课程签到已结束');
  }

  // Validate row/col range
  const r = parseInt(row);
  const c = parseInt(col);
  if (isNaN(r) || isNaN(c) || r < 1 || r > course.max_row || c < 1 || c > course.max_col) {
    return renderCheckinError(req, res, { studentId, name, row, col },
      `座位超出范围（行：1-${course.max_row}，列：1-${course.max_col}）`);
  }

  // Verify student is in the roster
  const rosterStudent = db.get(
    'SELECT * FROM students WHERE course_id = ? AND student_id = ?',
    [course.id, studentId.trim()]
  );
  if (!rosterStudent) {
    return renderCheckinError(req, res, { studentId, name, row, col },
      `学号 ${studentId.trim()} 不在本课程名单中，请联系教师确认`);
  }

  // Verify name matches roster
  if (rosterStudent.name.trim() !== name.trim()) {
    return renderCheckinError(req, res, { studentId, name, row, col },
      `姓名 "${name.trim()}" 与名单中的 "${rosterStudent.name}" 不一致，请确认`);
  }

  // Check if student already checked in
  const existingCheckin = db.get(
    'SELECT * FROM checkins WHERE course_id = ? AND student_id = ? AND reset_at IS NULL',
    [course.id, studentId.trim()]
  );
  if (existingCheckin) {
    return renderCheckinError(req, res, { studentId, name, row, col },
      `你已签到过了（${existingCheckin.row}行${existingCheckin.col}列），如需修改请联系教师重置`);
  }

  // Check seat availability
  const seatTaken = db.get(
    'SELECT * FROM checkins WHERE course_id = ? AND row = ? AND col = ? AND reset_at IS NULL',
    [course.id, r, c]
  );
  if (seatTaken) {
    return renderCheckinError(req, res, { studentId, name, row, col },
      `该座位(${r}行${c}列)已被占用，请确认你的座位后重新签到`);
  }

  // Insert checkin
  const result = db.insert(
    'INSERT INTO checkins (course_id, student_id, name, row, col) VALUES (?, ?, ?, ?, ?)',
    [course.id, studentId.trim(), name.trim(), r, c]
  );

  if (!result.success) {
    return renderCheckinError(req, res, { studentId, name, row, col }, '签到失败，请重试');
  }

  // Get the inserted record
  const newCheckin = db.get('SELECT * FROM checkins WHERE id = ?', [result.id]);

  // Notify SSE clients
  const { sseEmitter } = require('../server');
  sseEmitter.emit(`course_${course.id}`, {
    type: 'checkin',
    checkin: newCheckin,
  });

  // Render success
  res.render('student/checkin', {
    course,
    error: null,
    success: {
      studentId: newCheckin.student_id,
      name: newCheckin.name,
      row: newCheckin.row,
      col: newCheckin.col,
      time: newCheckin.created_at,
    },
    formData: {},
  });
});

// ── Helper: render checkin page with error ──
function renderCheckinError(req, res, formData, errorMsg) {
  const courseId = req.body.courseId;
  const course = db.get('SELECT * FROM courses WHERE id = ?', [courseId]);

  res.render('student/checkin', {
    course: course || { id: courseId, name: '', max_row: 10, max_col: 10 },
    error: errorMsg,
    success: null,
    formData: {
      studentId: formData.studentId || '',
      name: formData.name || '',
      row: formData.row || '',
      col: formData.col || '',
    },
  });
}

// ── API: Search student roster (for autocomplete) ──
const { getInitials } = require('../lib/pinyin');

router.get('/api/roster', (req, res) => {
  const { courseId, q } = req.query;

  if (!courseId) {
    return res.json({ students: [] });
  }

  const course = db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!course) {
    return res.json({ students: [] });
  }

  const students = db.all(
    'SELECT student_id, name FROM students WHERE course_id = ? ORDER BY student_id ASC',
    [courseId]
  );

  // If no query, return all (limit 200 for performance)
  if (!q || !q.trim()) {
    return res.json({ students: students.slice(0, 200) });
  }

  const query = q.trim().toLowerCase();

  // Filter: match against student_id, name, or pinyin initials
  const filtered = students.filter(s => {
    // Direct substring match on student_id
    if (s.student_id.toLowerCase().includes(query)) return true;
    // Direct substring match on name
    if (s.name.includes(query)) return true;
    // Pinyin initials match (e.g. "zs" matches "张三")
    const initials = getInitials(s.name);
    if (initials && initials.includes(query)) return true;
    return false;
  });

  res.json({ students: filtered.slice(0, 50) });
});

module.exports = router;
