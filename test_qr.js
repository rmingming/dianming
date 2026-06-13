const http = require('http');

function request(method, path, data, cookie) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost', port: 3000, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const newCookie = res.headers['set-cookie']
          ? res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
          : '';
        resolve({ status: res.statusCode, cookie: newCookie, body, headers: res.headers });
      });
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

let ok = 0, fail = 0;
function check(name, condition) {
  if (condition) { ok++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

async function main() {
  // Create teacher via CLI (register page is disabled)
  const { execSync } = require('child_process');
  try {
    execSync(`"${process.execPath}" create-teacher.js q 1234`, { cwd: __dirname, stdio: 'pipe' });
  } catch (e) { /* may already exist */ }

  console.log('=== 1. Login ===');
  let r = await request('POST', '/teacher/login', { username: 'q', password: '1234' });
  const cookie = r.cookie;
  check('Login', r.status === 302 && cookie !== '');

  console.log('\n=== 2. Create course ===');
  r = await request('POST', '/teacher/courses', {
    name: '测试课', maxRow: 5, maxCol: 5,
    studentList: 'S001,张三\nS002,李四',
  }, cookie);
  const course = JSON.parse(r.body);
  check('Course created', course.success && course.id > 0);
  console.log('    Password: ' + course.password);

  console.log('\n=== 3. QR Code endpoint ===');
  r = await request('GET', `/teacher/course/${course.id}/qrcode`, null, cookie);
  check('QR SVG generated', r.status === 200 && r.body.startsWith('<svg'));
  // QR code encodes URL as visual path patterns — text check not applicable
  check('QR SVG has path elements', r.body.includes('<path'));
  console.log('    SVG size: ' + r.body.length + ' chars');

  console.log('\n=== 4. Student scans QR (GET /student?code=PASSWORD) ===');
  r = await request('GET', `/student?code=${course.password}`);
  check('Auto-verify: renders checkin form directly', r.body.includes('/student/checkin'));
  check('No password input field (skipped)', !r.body.includes('input-password'));
  // Verify course context is rendered (select elements for row/col range)
  check('Seat selectors rendered', r.body.includes('<select') && r.body.includes('name="row"'));

  console.log('\n=== 5. Complete checkin from QR flow ===');
  r = await request('POST', '/student/checkin', {
    courseId: course.id, studentId: 'S001', name: '张三', row: 2, col: 3,
  });
  check('Checkin success', r.body.includes('签到成功'));
  check('Shows correct seat', r.body.includes('2行') && r.body.includes('3列'));

  console.log('\n=== 6. Invalid QR code ===');
  r = await request('GET', '/student?code=9999');
  check('Shows error on invalid code', r.body.includes('无效'));

  console.log('\n=== 7. No code param still works (manual entry) ===');
  r = await request('GET', '/student');
  check('Manual entry form', r.body.includes('请输入教师提供的课程口令'));

  console.log(`\n===== ${ok} OK / ${fail} FAIL =====`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
