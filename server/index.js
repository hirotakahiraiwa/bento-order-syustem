const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

async function start() {
  // DB初期化を待つ
  await getDb();

  const authRoutes = require('./routes/auth');
  const orderRoutes = require('./routes/orders');
  const summaryRoutes = require('./routes/summary');
  const employeeRoutes = require('./routes/employees');

  app.use('/api/auth', authRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/summary', summaryRoutes);
  app.use('/api/employees', employeeRoutes);

  // 本番用：ビルド済みフロントエンドを配信
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
