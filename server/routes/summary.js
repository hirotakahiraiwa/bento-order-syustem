const express = require('express');
const { queryAll, queryOne, runSql } = require('../db/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

async function getOrdersForDate(date) {
  const employees = await queryAll(
    'SELECT id, employee_number, name, default_order FROM employees WHERE is_bento_target = 1 AND is_active = 1'
  );

  let total = 0;
  const orders = [];
  for (const emp of employees) {
    const order = await queryOne(
      'SELECT is_ordered FROM bento_orders WHERE employee_id = $1 AND date = $2',
      [emp.id, date]
    );
    const ordered = order ? order.is_ordered === 1 : emp.default_order === 1;
    if (ordered) total++;
    orders.push({ employee_number: emp.employee_number, name: emp.name, is_ordered: ordered });
  }

  return { total, orders };
}

function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getWorkdays(startDate, endDate) {
  const workdays = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 3) continue;
    const dateStr = formatLocalDate(d);
    const holiday = await queryOne('SELECT id FROM company_holidays WHERE date = $1', [dateStr]);
    if (!holiday) workdays.push(dateStr);
  }
  return workdays;
}

router.get('/tomorrow', authenticateToken, requireAdmin, async (req, res) => {
  const tomorrow = getTomorrow();
  const result = await getOrdersForDate(tomorrow);
  const summary = await queryOne('SELECT * FROM daily_summaries WHERE date = $1', [tomorrow]);

  res.json({
    date: tomorrow,
    total_count: result.total,
    orders: result.orders,
    is_confirmed: summary?.is_confirmed || 0,
    confirmed_at: summary?.confirmed_at || null
  });
});

router.get('/date/:date', authenticateToken, requireAdmin, async (req, res) => {
  const { date } = req.params;
  const result = await getOrdersForDate(date);
  const summary = await queryOne('SELECT * FROM daily_summaries WHERE date = $1', [date]);

  res.json({
    date,
    total_count: result.total,
    orders: result.orders,
    is_confirmed: summary?.is_confirmed || 0,
    confirmed_at: summary?.confirmed_at || null
  });
});

router.post('/confirm', authenticateToken, requireAdmin, async (req, res) => {
  const { date } = req.body;
  const result = await getOrdersForDate(date);

  const existing = await queryOne('SELECT id FROM daily_summaries WHERE date = $1', [date]);
  if (existing) {
    await runSql(
      'UPDATE daily_summaries SET total_count = $1, is_confirmed = 1, confirmed_by = $2, confirmed_at = NOW() WHERE date = $3',
      [result.total, req.user.id, date]
    );
  } else {
    await runSql(
      'INSERT INTO daily_summaries (date, total_count, is_confirmed, confirmed_by, confirmed_at) VALUES ($1, $2, 1, $3, NOW())',
      [date, result.total, req.user.id]
    );
  }

  res.json({ message: '発注済みにしました', date, total_count: result.total });
});

router.get('/monthly/:year/:month', authenticateToken, requireAdmin, async (req, res) => {
  const { year, month } = req.params;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const employees = await queryAll(
    'SELECT id, employee_number, name, default_order FROM employees WHERE is_bento_target = 1 AND is_active = 1'
  );

  const workdays = await getWorkdays(startDate, endDate);

  const allDays = [];
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${month.padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const isOff = dayOfWeek === 0 || dayOfWeek === 3 || !!(await queryOne('SELECT id FROM company_holidays WHERE date = $1', [dateStr]));
    allDays.push({ date: dateStr, is_off: isOff });
  }

  const results = [];
  for (const emp of employees) {
    const orders = await queryAll(
      'SELECT date, is_ordered FROM bento_orders WHERE employee_id = $1 AND date >= $2 AND date <= $3',
      [emp.id, startDate, endDate]
    );
    const orderMap = {};
    orders.forEach(o => { orderMap[o.date] = o.is_ordered; });

    let orderDays = 0;
    const dailyDetail = allDays.map(({ date: dateStr, is_off }) => {
      if (is_off) {
        return { date: dateStr, ordered: false, is_off: true };
      }
      const ordered = orderMap[dateStr] !== undefined ? orderMap[dateStr] === 1 : emp.default_order === 1;
      if (ordered) orderDays++;
      return { date: dateStr, ordered, is_off: false };
    });

    results.push({
      employee_number: emp.employee_number,
      name: emp.name,
      order_days: orderDays,
      deduction: orderDays * 200,
      daily_detail: dailyDetail
    });
  }

  res.json({ year, month, workday_count: workdays.length, workdays, all_days: allDays, employees: results });
});

router.get('/monthly/:year/:month/csv', authenticateToken, requireAdmin, async (req, res) => {
  const { year, month } = req.params;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const employees = await queryAll(
    'SELECT id, employee_number, name, default_order FROM employees WHERE is_bento_target = 1 AND is_active = 1'
  );
  const workdays = await getWorkdays(startDate, endDate);

  let csv = '\ufeff社員番号,氏名,注文日数,控除額（円）\r\n';

  for (const emp of employees) {
    const orders = await queryAll(
      'SELECT date, is_ordered FROM bento_orders WHERE employee_id = $1 AND date >= $2 AND date <= $3',
      [emp.id, startDate, endDate]
    );
    const orderMap = {};
    orders.forEach(o => { orderMap[o.date] = o.is_ordered; });

    let orderDays = 0;
    workdays.forEach(dateStr => {
      const ordered = orderMap[dateStr] !== undefined ? orderMap[dateStr] === 1 : emp.default_order === 1;
      if (ordered) orderDays++;
    });

    csv += `${emp.employee_number},${emp.name},${orderDays},${orderDays * 200}\r\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=bento_summary_${year}_${month}.csv`);
  res.send(csv);
});

router.get('/history/:year/:month', authenticateToken, requireAdmin, async (req, res) => {
  const { year, month } = req.params;
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const summaries = await queryAll(`
    SELECT ds.*, e.name as confirmed_by_name
    FROM daily_summaries ds
    LEFT JOIN employees e ON ds.confirmed_by = e.id
    WHERE ds.date >= $1 AND ds.date <= $2
    ORDER BY ds.date
  `, [startDate, endDate]);

  res.json(summaries);
});

module.exports = router;
