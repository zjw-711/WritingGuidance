/**
 * 管理员账户创建工具
 * 用法：node setup-admin.js
 */
const readline = require('readline');
const { initDb, getDb } = require('./db');
const { createUser } = require('./auth');

// 初始化数据库
initDb();
const db = getDb();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function main() {
  console.log('\n========== 创建管理员账户 ==========\n');

  // 检查是否已有管理员
  const existingAdmins = db.prepare("SELECT username FROM users WHERE role = 'admin'").all();
  if (existingAdmins.length > 0) {
    console.log(`已有 ${existingAdmins.length} 个管理员账户：${existingAdmins.map(a => a.username).join(', ')}`);
    const confirm = await question('是否继续创建新管理员？(y/N) ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('已取消。');
      rl.close();
      return;
    }
  }

  const username = await question('用户名: ');
  if (!username.trim()) {
    console.log('用户名不能为空');
    rl.close();
    return;
  }

  // 检查用户名是否已存在
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    console.log(`用户名 "${username.trim()}" 已存在`);
    rl.close();
    return;
  }

  const password = await question('密码（至少6位）: ');
  if (password.length < 6) {
    console.log('密码长度至少 6 位');
    rl.close();
    return;
  }

  const confirmPwd = await question('确认密码: ');
  if (password !== confirmPwd) {
    console.log('两次密码不一致');
    rl.close();
    return;
  }

  try {
    const user = createUser(username.trim(), password, 'admin');
    console.log(`\n✅ 管理员账户创建成功！`);
    console.log(`   用户名: ${user.username}`);
    console.log(`   角色: ${user.role}`);
    console.log(`\n启动服务后访问 /admin 即可登录。\n`);
  } catch (err) {
    console.error('创建失败：', err.message);
  }

  rl.close();
}

main();
