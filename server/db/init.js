const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      employee_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      is_bento_target INTEGER NOT NULL DEFAULT 1,
      default_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bento_orders (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      date TEXT NOT NULL,
      is_ordered INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(employee_id, date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id SERIAL PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      total_count INTEGER NOT NULL DEFAULT 0,
      is_confirmed INTEGER NOT NULL DEFAULT 0,
      confirmed_by INTEGER REFERENCES employees(id),
      confirmed_at TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_holidays (
      id SERIAL PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '休業日'
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_bento_orders_date ON bento_orders(date)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_bento_orders_employee_date ON bento_orders(employee_id, date)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date)');

  console.log('PostgreSQL テーブル初期化完了');
}

async function queryAll(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function runSql(sql, params = []) {
  const result = await pool.query(sql, params);
  return {
    rowCount: result.rowCount,
    rows: result.rows
  };
}

module.exports = { initDb, queryAll, queryOne, runSql, pool };
