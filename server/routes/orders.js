const express = require('express');
const { queryAll, queryOne, runSql } = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function isBeforeDeadline(dateStr) {
  const now = new Date();
  const orderDate = new Date(dateStr + 'T00:00:00');
  const deadline = new Date(orderDate);
  deadline.setDate(deadline.getDate() - 1);
  deadline.setHours(17, 0, 0, 0);
  return now < deadline;
}

// 公休日: 水曜(3)と日曜(0)
function isRegularHoliday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 3;
}

function isHoliday(dateStr) {
  return !!queryOne('SELECT id FROM company_holidays WHERE date = ?', [dateStr]);
}

function getLastDayOfMonth(year, month) {
  const y = parseInt(year);
  const m = parseInt(month);
  const lastDay = new Date(y, m, 0).getDate();
  return `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function countWorkdays(startDate, endDate) {
  let count = 0;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 3) continue;
    const dateStr = formatLocalDate(d);
    if (!isHoliday(dateStr)) count++;
  }
  return count;
}

router.get('/my/:year/:month', authenticateToken, (req, res) => {
  const { year, month } = req.params;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = getLastDayOfMonth(year, month);

  const orders = queryAll(
    'SELECT date, is_ordered FROM bento_orders WHERE employee_id = ? AND date >= ? AND date <= ?',
    [req.user.id, startDate, endDate]
  );

  const holidays = queryAll(
    'SELECT date, name FROM company_holidays WHERE date >= ? AND date <= ?',
    [startDate, endDate]
  );

  const user = queryOne('SELECT default_order FROM employees WHERE id = ?', [req.user.id]);

  res.json({ orders, holidays, default_order: user.default_order });
});

router.post('/toggle', authenticateToken, (req, res) => {
  const { date, is_ordered } = req.body;
  if (!date) return res.status(400).json({ error: '日付を指定してください' });
  if (!isBeforeDeadline(date)) return res.status(400).json({ error: '締切（前日17:00）を過ぎているため変更できません' });
  if (isRegularHoliday(date)) return res.status(400).json({ error: '公休日（水・日）は注文できません' });
  if (isHoliday(date)) return res.status(400).json({ error: '休業日は注文できません' });

  const existing = queryOne(
    'SELECT id FROM bento_orders WHERE employee_id = ? AND date = ?',
    [req.user.id, date]
  );

  if (existing) {
    runSql('UPDATE bento_orders SET is_ordered = ?, updated_at = datetime("now", "localtime") WHERE id = ?',
      [is_ordered ? 1 : 0, existing.id]);
  } else {
    runSql('INSERT INTO bento_orders (employee_id, date, is_ordered) VALUES (?, ?, ?)',
      [req.user.id, date, is_ordered ? 1 : 0]);
  }

  res.json({ date, is_ordered });
});

router.put('/default', authenticateToken, (req, res) => {
  const { default_order } = req.body;
  runSql('UPDATE employees SET default_order = ?, updated_at = datetime("now", "localtime") WHERE id = ?',
    [default_order ? 1 : 0, req.user.id]);
  res.json({ default_order });
});

router.get('/my-summary/:year/:month', authenticateToken, (req, res) => {
  const { year, month } = req.params;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = getLastDayOfMonth(year, month);

  const user = queryOne('SELECT default_order FROM employees WHERE id = ?', [req.user.id]);
  const workdays = countWorkdays(startDate, endDate);

  const explicitOff = queryAll(
    'SELECT date FROM bento_orders WHERE employee_id = ? AND date >= ? AND date <= ? AND is_ordered = 0',
    [req.user.id, startDate, endDate]
  );
  const explicitOn = queryAll(
    'SELECT date FROM bento_orders WHERE employee_id = ? AND date >= ? AND date <= ? AND is_ordered = 1',
    [req.user.id, startDate, endDate]
  );

  let totalDays;
  if (user.default_order === 1) {
    totalDays = workdays - explicitOff.length;
  } else {
    totalDays = explicitOn.length;
  }

  res.json({ count: totalDays, amount: totalDays * 200 });
});

module.exports = router;
