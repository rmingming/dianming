const express = require('express');
const session = require('express-session');
const path = require('path');
const EventEmitter = require('events');

const app = express();
const PORT = process.env.PORT || 3000;

// ── SSE Event Bus ──
// Channel name = `course_${courseId}`
const sseEmitter = new EventEmitter();
sseEmitter.setMaxListeners(1000); // Allow many SSE connections

// ── Middleware ──
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dianming-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// ── View engine ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Make session available to all views ──
app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.error = null;
  res.locals.success = null;
  next();
});

// ── Routes ──
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');

app.use('/teacher', teacherRoutes);
app.use('/student', studentRoutes);

// ── SSE endpoint (teacher-side real-time updates) ──
app.get('/api/sse/course/:courseId', (req, res) => {
  if (!req.session.teacherId) {
    return res.status(401).end();
  }

  const courseId = parseInt(req.params.courseId);
  const channel = `course_${courseId}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write('event: connected\ndata: {}\n\n');

  const onUpdate = (data) => {
    res.write(`event: update\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sseEmitter.on(channel, onUpdate);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  req.on('close', () => {
    sseEmitter.off(channel, onUpdate);
    clearInterval(heartbeat);
  });
});

// ── Home page redirect ──
app.get('/', (req, res) => {
  res.redirect('/student');
});

// ── Start server ──
async function start() {
  // Initialize database
  const db = require('./db');
  await db.init();
  console.log('Database initialized.');

  app.listen(PORT, () => {
    console.log(`点名系统已启动: http://localhost:${PORT}`);
    console.log(`教师端: http://localhost:${PORT}/teacher/login`);
    console.log(`学生端: http://localhost:${PORT}/student`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, sseEmitter };
