const express = require('express');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const router = express.Router();
const db = require('../db');

// ── Auth middleware ──
function requireAuth(req, res, next) {
  if (!req.session.teacherId) {
    // API requests: return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json') ||
        req.method !== 'GET' || req.path.includes('/api/')) {
      return res.status(401).json({ error: '请先登录' });
    }
    // Page requests: redirect to login
    return res.redirect('/teacher/login');
  }
  next();
}

// ── Helper: generate random 4-digit password ──
function generatePassword() {
  const used = new Set(
    db.all("SELECT password FROM courses WHERE status = 'active'").map(c => c.password)
  );
  let pwd;
  do {
    pwd = String(Math.floor(1000 + Math.random() * 9000));
  } while (used.has(pwd));
  return pwd;
}

// ── Page: Login ──
router.get('/login', (req, res) => {
  if (req.session.teacherId) return res.redirect('/teacher/dashboard');
  res.render('teacher/login');
});

// ── API: Login ──
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('teacher/login', { error: '请输入用户名和密码' });
  }

  const teacher = db.get('SELECT * FROM teachers WHERE username = ?', [username]);
  if (!teacher) {
    return res.render('teacher/login', { error: '用户名或密码错误' });
  }

  if (!bcrypt.compareSync(password, teacher.password)) {
    return res.render('teacher/login', { error: '用户名或密码错误' });
  }

  req.session.teacherId = teacher.id;
  req.session.teacherName = teacher.username;
  res.redirect('/teacher/dashboard');
});

// ── Logout ──
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/teacher/login');
});
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ── Page: Dashboard (course list) ──
router.get('/dashboard', requireAuth, (req, res) => {
  const courses = db.all(
    'SELECT * FROM courses WHERE teacher_id = ? ORDER BY created_at DESC',
    [req.session.teacherId]
  );
  res.render('teacher/dashboard', { courses });
});

// ── API: Create course ──
router.post('/courses', requireAuth, (req, res) => {
  const { name, maxRow, maxCol, studentList } = req.body;
  const teacherId = req.session.teacherId;

  if (!name || !maxRow || !maxCol) {
    return res.status(400).json({ error: '课程名称、行数、列数为必填项' });
  }

  const row = parseInt(maxRow);
  const col = parseInt(maxCol);
  if (row < 1 || row > 20 || col < 1 || col > 20) {
    return res.status(400).json({ error: '行数和列数必须在 1-20 之间' });
  }

  const password = generatePassword();

  const result = db.insert(
    'INSERT INTO courses (teacher_id, name, password, max_row, max_col, status) VALUES (?, ?, ?, ?, ?, ?)',
    [teacherId, name, password, row, col, 'active']
  );

  if (!result.success) {
    return res.status(500).json({ error: '创建课程失败' });
  }

  const courseId = result.id;

  // Parse and insert student list
  if (studentList && studentList.trim()) {
    const lines = studentList.trim().split('\n');
    let inserted = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Support formats: "学号,姓名" or "学号，姓名" or "学号 姓名"
      const parts = trimmed.split(/[,\s，]+/);
      if (parts.length >= 2) {
        const sid = parts[0].trim();
        const sname = parts.slice(1).join('').trim();
        if (sid && sname) {
          db.run('INSERT OR IGNORE INTO students (course_id, student_id, name) VALUES (?, ?, ?)',
            [courseId, sid, sname]);
          inserted++;
        }
      }
    }
  }

  res.json({ success: true, id: courseId, password });
});

// ── Page: Course detail (monitoring) ──
router.get('/course/:id', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).send('课程不存在');

  const checkins = db.all(
    'SELECT * FROM checkins WHERE course_id = ? AND reset_at IS NULL ORDER BY created_at ASC',
    [course.id]
  );

  const totalStudents = db.get(
    'SELECT COUNT(*) as count FROM students WHERE course_id = ?',
    [course.id]
  );

  const conflictSeats = findConflicts(checkins);

  // Parse column groups for visual separators
  let colGroupEnds = [];
  if (course.col_groups) {
    try {
      const groups = JSON.parse(course.col_groups);
      let sum = 0;
      for (let i = 0; i < groups.length - 1; i++) {
        sum += groups[i];
        colGroupEnds.push(sum);
      }
    } catch(e) { /* ignore */ }
  }

  res.render('teacher/course', {
    course,
    checkins,
    totalStudents: totalStudents ? totalStudents.count : 0,
    conflictSeats,
    colGroupEnds,
  });
});

// ── API: Get course detail (JSON) ──
router.get('/api/course/:id', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });
  res.json(course);
});

// ── API: QR Code (returns SVG image) ──
router.get('/course/:id/qrcode', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).send('课程不存在');

  // Build the student URL: https://host/student?code=PASSWORD
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const studentUrl = `${protocol}://${host}/student?code=${course.password}`;

  QRCode.toString(studentUrl, { type: 'svg', width: 256, margin: 2, color: { dark: '#4f46e5', light: '#ffffff' } })
    .then(svg => {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    })
    .catch(err => {
      res.status(500).json({ error: 'QR码生成失败' });
    });
});

// ── API: Get checkins ──
router.get('/api/course/:id/checkins', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });

  const checkins = db.all(
    'SELECT * FROM checkins WHERE course_id = ? AND reset_at IS NULL ORDER BY created_at ASC',
    [course.id]
  );

  res.json(checkins);
});

// ── API: Start course (regenerate password & set active) ──
router.post('/course/:id/start', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });

  const password = generatePassword();
  db.run('UPDATE courses SET password = ?, status = ? WHERE id = ?',
    [password, 'active', course.id]);

  res.json({ success: true, password });
});

// ── API: End course ──
router.post('/course/:id/end', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });

  db.run('UPDATE courses SET status = ?, ended_at = datetime("now","localtime") WHERE id = ?',
    ['ended', course.id]);

  res.json({ success: true });
});

// ── API: Delete course ──
router.post('/course/:id/delete', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });

  // Delete related data
  db.run('DELETE FROM checkins WHERE course_id = ?', [course.id]);
  db.run('DELETE FROM students WHERE course_id = ?', [course.id]);
  db.run('DELETE FROM courses WHERE id = ?', [course.id]);

  res.json({ success: true });
});

// ── API: Regenerate password ──
router.post('/course/:id/regenerate-password', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });

  const password = generatePassword();
  db.run('UPDATE courses SET password = ? WHERE id = ?', [password, course.id]);

  res.json({ success: true, password });
});

// ── API: Reset a check-in ──
router.delete('/course/:id/checkins/:checkinId', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });

  const checkin = db.get('SELECT * FROM checkins WHERE id = ? AND course_id = ?',
    [req.params.checkinId, course.id]);
  if (!checkin) return res.status(404).json({ error: '签到记录不存在' });

  db.run('UPDATE checkins SET reset_at = datetime("now","localtime") WHERE id = ?',
    [checkin.id]);

  // Notify SSE clients
  const { sseEmitter } = require('../server');
  sseEmitter.emit(`course_${course.id}`, {
    type: 'reset',
    checkinId: checkin.id,
    studentId: checkin.student_id,
    row: checkin.row,
    col: checkin.col,
  });

  res.json({ success: true });
});

// ── API: Manual check-in (teacher) ──
router.post('/course/:id/checkins', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });
  if (course.status === 'ended') return res.status(400).json({ error: '课程已结束' });

  const { studentId, name, row, col } = req.body;

  if (!studentId || !name || !row || !col) {
    return res.status(400).json({ error: '所有字段必填' });
  }

  // Check seat
  const seatTaken = db.get(
    'SELECT * FROM checkins WHERE course_id = ? AND row = ? AND col = ? AND reset_at IS NULL',
    [course.id, row, col]
  );
  if (seatTaken) return res.status(409).json({ error: `该座位(${row}行${col}列)已被占用` });

  // Check student not already checked in
  const existing = db.get(
    'SELECT * FROM checkins WHERE course_id = ? AND student_id = ? AND reset_at IS NULL',
    [course.id, studentId]
  );
  if (existing) return res.status(409).json({ error: '该学号已签到' });

  const result = db.insert(
    'INSERT INTO checkins (course_id, student_id, name, row, col) VALUES (?, ?, ?, ?, ?)',
    [course.id, studentId, name, row, col]
  );

  if (!result.success) {
    return res.status(500).json({ error: '添加失败' });
  }

  const newCheckin = db.get('SELECT * FROM checkins WHERE id = ?', [result.id]);

  // Notify SSE
  const { sseEmitter } = require('../server');
  sseEmitter.emit(`course_${course.id}`, {
    type: 'checkin',
    checkin: newCheckin,
  });

  res.status(201).json({ success: true, checkin: newCheckin });
});

// ── API: Reset all checkins ──
router.post('/course/:id/reset-all', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });

  // Mark all active checkins as reset
  db.run(
    'UPDATE checkins SET reset_at = datetime("now","localtime") WHERE course_id = ? AND reset_at IS NULL',
    [course.id]
  );

  // Notify SSE clients to reload
  const { sseEmitter } = require('../server');
  sseEmitter.emit(`course_${course.id}`, {
    type: 'reset-all',
  });

  res.json({ success: true });
});

// ── API: Export checkins to CSV ──
router.get('/course/:id/export', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).send('课程不存在');

  const checkins = db.all(
    'SELECT student_id, name, row, col, created_at FROM checkins WHERE course_id = ? AND reset_at IS NULL ORDER BY row, col',
    [course.id]
  );

  const absent = db.all(
    `SELECT s.student_id, s.name FROM students s
     WHERE s.course_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM checkins c
         WHERE c.course_id = s.course_id
           AND c.student_id = s.student_id
           AND c.reset_at IS NULL
       )
     ORDER BY s.student_id`,
    [course.id]
  );

  // Build CSV with BOM for Excel
  let csv = '﻿学号,姓名,座位行,座位列,签到时间,签到状态\n';
  for (const c of checkins) {
    csv += `${c.student_id},${c.name},${c.row},${c.col},${c.created_at},已签到\n`;
  }
  for (const a of absent) {
    csv += `${a.student_id},${a.name},,,,未签到\n`;
  }

  // Generate filename: 课程名_日期_星期几.csv
  const now = new Date();
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const filename = `${course.name}_${y}-${m}-${d}_${weekDays[now.getDay()]}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(csv);
});

// ── API: Get un-checked-in students ──
router.get('/course/:id/absent', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });

  const absent = db.all(
    `SELECT s.* FROM students s
     WHERE s.course_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM checkins c
         WHERE c.course_id = s.course_id
           AND c.student_id = s.student_id
           AND c.reset_at IS NULL
       )
     ORDER BY s.student_id`,
    [course.id]
  );

  res.json(absent);
});

// ── Page: Course settings ──
router.get('/course/:id/settings', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).send('课程不存在');

  const studentList = db.all(
    'SELECT student_id, name FROM students WHERE course_id = ? ORDER BY student_id',
    [course.id]
  );

  res.render('teacher/settings', { course, studentList });
});

// ── API: Update course settings ──
router.put('/course/:id', requireAuth, (req, res) => {
  const course = db.get(
    'SELECT * FROM courses WHERE id = ? AND teacher_id = ?',
    [req.params.id, req.session.teacherId]
  );
  if (!course) return res.status(404).json({ error: '课程不存在' });

  const { name, maxRow, maxCol, studentList } = req.body;
  const row = parseInt(maxRow) || course.max_row;
  const col = parseInt(maxCol) || course.max_col;

  if (row < 1 || row > 20 || col < 1 || col > 20) {
    return res.status(400).json({ error: '行数和列数必须在 1-20 之间' });
  }

  // Parse and validate column groups
  let colGroups = req.body.colGroups || null;
  if (colGroups) {
    // Accept comma-separated numbers like "3,4,3"
    const parts = colGroups.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    const sum = parts.reduce((a, b) => a + b, 0);
    if (sum !== col) {
      return res.status(400).json({ error: `列分组数字之和（${sum}）必须等于最大列数（${col}）` });
    }
    colGroups = JSON.stringify(parts);
  } else {
    colGroups = null;
  }

  db.run('UPDATE courses SET name = ?, max_row = ?, max_col = ?, col_groups = ? WHERE id = ?',
    [name || course.name, row, col, colGroups, course.id]);

  // Update student list if provided
  if (studentList !== undefined) {
    // Clear old list and re-insert
    db.run('DELETE FROM students WHERE course_id = ?', [course.id]);
    if (studentList.trim()) {
      const lines = studentList.trim().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/[,\s，]+/);
        if (parts.length >= 2) {
          const sid = parts[0].trim();
          const sname = parts.slice(1).join('').trim();
          if (sid && sname) {
            db.run('INSERT OR IGNORE INTO students (course_id, student_id, name) VALUES (?, ?, ?)',
              [course.id, sid, sname]);
          }
        }
      }
    }
  }

  res.json({ success: true });
});

// ── Helper: Find seat conflicts ──
function findConflicts(checkins) {
  const seatMap = {};
  const conflicts = new Set();
  for (const c of checkins) {
    const key = `${c.row}-${c.col}`;
    if (seatMap[key]) {
      conflicts.add(key);
    }
    seatMap[key] = (seatMap[key] || 0) + 1;
  }
  return [...conflicts].map(k => {
    const [row, col] = k.split('-').map(Number);
    return { row, col };
  });
}

module.exports = router;
