/**
 * 集成测试脚本
 * 运行前确保：服务器已启动、已通过 create-teacher.js 创建教师账号
 * 用法：
 *   node test.js
 * 期望服务器已在 http://localhost:3000 运行
 */

const http = require('http');

function request(method, path, data, cookie) {
  return new Promise((resolve, reject) => {
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
        try { resolve({ status: res.statusCode, cookie: newCookie, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, cookie: newCookie, html: body.substring(0, 800) }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

let ok = 0, fail = 0;
function check(name, condition, detail) {
  if (condition) { ok++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`); }
}

async function main() {
  let r, cookie, courseId;

  console.log('=== 页面可达性 ===');
  for (const p of ['/student', '/teacher/login']) {
    r = await request('GET', p);
    check(`GET ${p}`, r.status === 200);
  }
  r = await request('GET', '/teacher/register');
  check('注册页面已关闭', r.status === 404);

  console.log('\n=== 教师登录 ===');
  r = await request('POST', '/teacher/login', { username: 'teacher1', password: '123456' });
  cookie = r.cookie;
  check('登录', r.status === 302 && !!cookie, cookie ? 'OK' : '无session');
  if (!cookie) { console.log('请先执行: node create-teacher.js teacher1 123456'); process.exit(1); }

  console.log('\n=== 课程管理 ===');
  r = await request('POST', '/teacher/courses', {
    name: '高等数学', maxRow: 8, maxCol: 10,
    studentList: 'S001,张三\nS002,李四\nS003,王五',
  }, cookie);
  check('创建课程', r.body?.success && r.body?.id > 0, `id=${r.body?.id}`);
  courseId = r.body?.id;

  r = await request('GET', `/teacher/api/course/${courseId}/checkins`, null, cookie);
  check('空列表', Array.isArray(r.body) && r.body.length === 0);

  console.log('\n=== 学生签到 ===');
  r = await request('POST', '/student/checkin', { courseId, studentId: 'S001', name: '张三', row: 3, col: 4 });
  check('张三签到', r.html?.includes('签到成功'));
  r = await request('POST', '/student/checkin', { courseId, studentId: 'S002', name: '李四', row: 5, col: 2 });
  check('李四签到', r.html?.includes('签到成功'));
  r = await request('POST', '/student/checkin', { courseId, studentId: 'S003', name: '王五', row: 3, col: 4 });
  check('座位冲突', r.html?.includes('已被占用'));
  r = await request('GET', `/teacher/api/course/${courseId}/checkins`, null, cookie);
  check('2条记录', Array.isArray(r.body) && r.body.length === 2);

  console.log('\n=== 学号验证 ===');
  r = await request('POST', '/student/checkin', { courseId, studentId: 'X999', name: 'Ghost', row: 6, col: 6 });
  check('不在名单', r.html?.includes('不在本课程名单'));
  r = await request('POST', '/student/checkin', { courseId, studentId: 'S003', name: '错名', row: 7, col: 7 });
  check('姓名不匹配', r.html?.includes('不一致'));

  console.log('\n=== 重置签到 ===');
  r = await request('GET', `/teacher/api/course/${courseId}/checkins`, null, cookie);
  const cid = r.body?.[0]?.id;
  r = await request('DELETE', `/teacher/course/${courseId}/checkins/${cid}`, null, cookie);
  check('重置', r.body?.success === true);
  r = await request('GET', `/teacher/api/course/${courseId}/checkins`, null, cookie);
  check('1条剩余', Array.isArray(r.body) && r.body.length === 1);
  r = await request('POST', '/student/checkin', { courseId, studentId: 'S001', name: '张三', row: 1, col: 1 });
  check('重新签到', r.html?.includes('签到成功'));

  console.log('\n=== 结束课程 ===');
  r = await request('POST', `/teacher/course/${courseId}/end`, null, cookie);
  check('结束', r.body?.success === true);
  r = await request('POST', '/student/checkin', { courseId, studentId: 'S003', name: '王五', row: 8, col: 8 });
  check('结束拒绝', r.html?.includes('已结束'));

  console.log(`\n===== ${ok} 通过, ${fail} 失败 =====`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
