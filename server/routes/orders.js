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

function isRegularHoliday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 3;
}

async function isHoliday(dateStr) {
  return !!(await queryOne('SELECT id FROM company_holidays WHERE date = $1', [dateStr]));
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

async function countWorkdays(startDate, endDate) {
  let count = 0;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 3) continue;
    const dateStr = formatLocalDate(d);
    if (!(await isHoliday(dateStr))) count++;
  }
  return count;
}

router.get('/my/:year/:month', authenticateToken, async (req, res) => {
  const { year, month } = req.params;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = getLastDayOfMonth(year, month);

  const orders = await queryAll(
    'SELECT date, is_ordered FROM bento_orders WHERE employee_id = $1 AND date >= $2 AND date <= $3',
    [req.user.id, startDate, endDate]
  );

  const holidays = await queryAll(
    'SELECT date, name FROM company_holidays WHERE date >= $1 AND date <= $2',
    [startDate, endDate]
  );

  const user = await queryOne('SELECT default_order FROM employees WHERE id = $1', [req.user.id]);

  res.json({ orders, holidays, default_order: user.default_order });
});

router.post('/toggle', authenticateToken, async (req, res) => {
  const { date, is_ordered } = req.body;
  if (!date) return res.status(400).json({ error: '日付を指定してください' });
  if (!isBeforeDeadline(date)) return res.status(400).json({ error: '締切（前日17:00）を過ぎているため変更できません' });
  if (isRegularHoliday(date)) return res.status(400).json({ error: '公休日（水・日）は注文できません' });
  if (await isHoliday(date)) return res.status(400).json({ error: '休業日は注文できません' });

  const existing = await queryOne(
    'SELECT id FROM bento_orders WHERE employee_id = $1 AND date = $2',
    [req.user.id, date]
  );

  if (existing) {
    await runSql('UPDATE bento_orders SET is_ordered = $1, updated_at = NOW() WHERE id = $2',
      [is_ordered ? 1 : 0, existing.id]);
  } else {
    await runSql('INSERT INTO bento_orders (employee_id, date, is_ordered) VALUES ($1, $2, $3)',
      [req.user.id, date, is_ordered ? 1 : 0]);
  }

  res.json({ date, is_ordered });
});

router.put('/default', authenticateToken, async (req, res) => {
  const { default_order } = req.body;
  await runSql('UPDATE employees SET default_order = $1, updated_at = NOW() WHERE id = $2',
    [default_order ? 1 : 0, req.user.id]);
  res.json({ default_order });
});

router.get('/my-summary/:year/:month', authenticateToken, async (req, res) => {
  const { year, month } = req.params;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = getLastDayOfMonth(year, month);

  const user = await queryOne('SELECT default_order FROM employees WHERE id = $1', [req.user.id]);
  const workdays = await countWorkdays(startDate, endDate);

  const explicitOff = await queryAll(
    'SELECT date FROM bento_orders WHERE employee_id = $1 AND date >= $2 AND date <= $3 AND is_ordered = 0',
    [req.user.id, startDate, endDate]
  );
  const explicitOn = await queryAll(
    'SELECT date FROM bento_orders WHERE employee_id = $1 AND date >= $2 AND date <= $3 AND is_ordered = 1',
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
