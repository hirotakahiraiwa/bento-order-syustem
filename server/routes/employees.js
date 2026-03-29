const express = require('express');
const bcrypt = require('bcryptjs');
const { queryAll, queryOne, runSql } = require('../db/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const employees = queryAll(
    'SELECT id, employee_number, name, role, is_bento_target, default_order, is_active, created_at FROM employees ORDER BY employee_number'
  );
  res.json(employees);
});

router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { employee_number, name, password, role, is_bento_target, default_order } = req.body;

  if (!employee_number || !name || !password) {
    return res.status(400).json({ error: '社員番号、氏名、パスワードは必須です' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'パスワードは4文字以上にしてください' });
  }

  const existing = queryOne('SELECT id FROM employees WHERE employee_number = ?', [employee_number]);
  if (existing) {
    return res.status(400).json({ error: 'この社員番号は既に登録されています' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = runSql(
    'INSERT INTO employees (employee_number, name, password_hash, role, is_bento_target, default_order) VALUES (?, ?, ?, ?, ?, ?)',
    [
      employee_number,
      name,
      hash,
      role || 'employee',
      is_bento_target !== undefined ? (is_bento_target ? 1 : 0) : 1,
      default_order !== undefined ? (default_order ? 1 : 0) : 1
    ]
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    employee_number, name,
    role: role || 'employee',
    is_bento_target: is_bento_target !== undefined ? is_bento_target : true,
    default_order: default_order !== undefined ? default_order : true
  });
});

router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, role, is_bento_target, default_order, password } = req.body;

  const employee = queryOne('SELECT * FROM employees WHERE id = ?', [parseInt(id)]);
  if (!employee) return res.status(404).json({ error: '従業員が見つかりません' });

  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (role !== undefined) { updates.push('role = ?'); params.push(role); }
  if (is_bento_target !== undefined) { updates.push('is_bento_target = ?'); params.push(is_bento_target ? 1 : 0); }
  if (default_order !== undefined) { updates.push('default_order = ?'); params.push(default_order ? 1 : 0); }
  if (password) {
    if (password.length < 4) return res.status(400).json({ error: 'パスワードは4文字以上にしてください' });
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(password, 10));
  }

  if (updates.length === 0) return res.status(400).json({ error: '更新する項目がありません' });

  updates.push('updated_at = datetime("now", "localtime")');
  params.push(parseInt(id));

  runSql(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = queryOne(
    'SELECT id, employee_number, name, role, is_bento_target, default_order, is_active FROM employees WHERE id = ?',
    [parseInt(id)]
  );
  res.json(updated);
});

router.put('/:id/toggle-active', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const employee = queryOne('SELECT * FROM employees WHERE id = ?', [parseInt(id)]);
  if (!employee) return res.status(404).json({ error: '従業員が見つかりません' });

  const newActive = employee.is_active === 1 ? 0 : 1;
  runSql('UPDATE employees SET is_active = ?, updated_at = datetime("now", "localtime") WHERE id = ?',
    [newActive, parseInt(id)]);

  res.json({ id: parseInt(id), is_active: newActive });
});

router.get('/holidays/:year', authenticateToken, requireAdmin, (req, res) => {
  const { year } = req.params;
  const holidays = queryAll('SELECT * FROM company_holidays WHERE date LIKE ? ORDER BY date', [`${year}%`]);
  res.json(holidays);
});

router.post('/holidays', authenticateToken, requireAdmin, (req, res) => {
  const { date, name } = req.body;
  const existing = queryOne('SELECT id FROM company_holidays WHERE date = ?', [date]);
  if (existing) return res.status(400).json({ error: 'この日付は既に登録されています' });

  runSql('INSERT INTO company_holidays (date, name) VALUES (?, ?)', [date, name || '休業日']);
  res.status(201).json({ date, name: name || '休業日' });
});

router.delete('/holidays/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  runSql('DELETE FROM company_holidays WHERE id = ?', [parseInt(id)]);
  res.json({ message: '削除しました' });
});

module.exports = router;
