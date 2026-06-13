/**
 * 命令行创建教师账号（仅管理员可用）
 *
 * 用法： node create-teacher.js 用户名 密码
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const username = args[0];
const password = args[1];

if (!username || !password) {
  console.error('用法: node create-teacher.js 用户名 密码');
  process.exit(1);
}

if (password.length < 4) {
  console.error('密码至少4位');
  process.exit(1);
}

async function main() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  const dbPath = path.join(__dirname, 'data', 'dianming.db');

  if (!fs.existsSync(dbPath)) {
    console.error('错误: 数据库文件不存在，请先启动一次服务（node server.js）再创建教师。');
    process.exit(1);
  }

  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  // Check if username exists (prepared statement)
  const stmt = db.prepare('SELECT id FROM teachers WHERE username = ?');
  stmt.bind([username]);
  const exists = stmt.step();
  stmt.free();

  if (exists) {
    console.error('错误: 用户名已存在');
    db.close();
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO teachers (username, password) VALUES (?, ?)', [username, hash]);

  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();

  console.log(`✅ 教师账号创建成功`);
  console.log(`   用户名: ${username}`);
  console.log(`   登录地址: http://你的域名/teacher/login`);
}

main().catch(err => {
  console.error('创建失败:', err.message);
  process.exit(1);
});
