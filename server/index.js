const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDb, queryOne, runSql } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

async function seedIfEmpty() {
  const existing = await queryOne('SELECT id FROM employees LIMIT 1');
  if (existing) return;

  console.log('データベースが空のため、初期データを投入します...');
  const employees = [
    { number: 'A001', name: '管理 太郎', role: 'admin', password: 'admin123', default_order: 1 },
    { number: 'E001', name: '田中 一郎', role: 'employee', password: 'pass123', default_order: 1 },
    { number: 'E002', name: '佐藤 花子', role: 'employee', password: 'pass123', default_order: 1 },
    { number: 'E003', name: '鈴木 次郎', role: 'employee', password: 'pass123', default_order: 1 },
    { number: 'E004', name: '高橋 美咲', role: 'employee', password: 'pass123', default_order: 1 },
    { number: 'E005', name: '伊藤 健太', role: 'employee', password: 'pass123', default_order: 0 },
  ];
  for (const emp of employees) {
    const hash = bcrypt.hashSync(emp.password, 10);
    await runSql(
      'INSERT INTO employees (employee_number, name, password_hash, role, default_order) VALUES ($1, $2, $3, $4, $5)',
      [emp.number, emp.name, hash, emp.role, emp.default_order]
    );
  }
  console.log('初期データ投入完了: 管理者 A001/admin123, 従業員 E001-E005/pass123');
}

async function start() {
  await initDb();
  await seedIfEmpty();

  const authRoutes = require('./routes/auth');
  const orderRoutes = require('./routes/orders');
  const summaryRoutes = require('./routes/summary');
  const employeeRoutes = require('./routes/employees');

  app.use('/api/auth', authRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/summary', summaryRoutes);
  app.use('/api/employees', employeeRoutes);

  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });

  app.listen(PORT, () => {
    console.log(`お弁当注文管理サーバー起動: http://localhost:${PORT}`);
  });
}

start().catch(console.error);
