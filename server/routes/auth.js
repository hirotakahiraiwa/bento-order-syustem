const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne, runSql } = require('../db/init');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { employee_number, password } = req.body;

  if (!employee_number || !password) {
    return res.status(400).json({ error: '社員番号とパスワードを入力してください' });
  }

  const user = queryOne(
    'SELECT * FROM employees WHERE employee_number = ? AND is_active = 1',
    [employee_number]
  );

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '社員番号またはパスワードが正しくありません' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      employee_number: user.employee_number,
      name: user.name,
      role: user.role,
      is_bento_target: user.is_bento_target,
      default_order: user.default_order
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      employee_number: user.employee_number,
      name: user.name,
      role: user.role,
      is_bento_target: user.is_bento_target,
      default_order: user.default_order
    }
  });
});

router.get('/me', authenticateToken, (req, res) => {
  const user = queryOne(
    'SELECT id, employee_number, name, role, is_bento_target, default_order FROM employees WHERE id = ?',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json(user);
});

router.put('/password', authenticateToken, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: '現在のパスワードと新しいパスワードを入力してください' });
  }
  if (new_password.length < 4) {
    return res.status(400).json({ error: 'パスワードは4文字以上にしてください' });
  }

  const user = queryOne('SELECT * FROM employees WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: '現在のパスワードが正しくありません' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  runSql('UPDATE employees SET password_hash = ?, updated_at = datetime("now", "localtime") WHERE id = ?',
    [hash, req.user.id]);

  res.json({ message: 'パスワードを変更しました' });
});

module.exports = router;
