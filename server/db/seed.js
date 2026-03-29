const bcrypt = require('bcryptjs');
const { initDb, queryOne, runSql } = require('./init');

async function seed() {
  await initDb();

  const employees = [
    { number: 'A001', name: '管理 太郎', role: 'admin', password: 'admin123', default_order: 1 },
    { number: 'E001', name: '田中 一郎', role: 'employee', password: 'pass123', default_order: 1 },
    { number: 'E002', name: '佐藤 花子', role: 'employee', password: 'pass123', default_order: 1 },
    { number: 'E003', name: '鈴木 次郎', role: 'employee', password: 'pass123', default_order: 1 },
    { number: 'E004', name: '高橋 美咲', role: 'employee', password: 'pass123', default_order: 1 },
    { number: 'E005', name: '伊藤 健太', role: 'employee', password: 'pass123', default_order: 0 },
  ];

  for (const emp of employees) {
    const existing = await queryOne('SELECT id FROM employees WHERE employee_number = $1', [emp.number]);
    if (existing) continue;

    const hash = bcrypt.hashSync(emp.password, 10);
    await runSql(
      'INSERT INTO employees (employee_number, name, password_hash, role, default_order) VALUES ($1, $2, $3, $4, $5)',
      [emp.number, emp.name, hash, emp.role, emp.default_order]
    );
  }

  console.log('初期データを投入しました。');
  console.log('管理者: A001 / admin123');
  console.log('従業員: E001〜E005 / pass123');
  process.exit(0);
}

seed().catch(console.error);
