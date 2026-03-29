import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function Calendar() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [orders, setOrders] = useState({});
  const [holidays, setHolidays] = useState({});
  const [defaultOrder, setDefaultOrder] = useState(1);
  const [summary, setSummary] = useState({ count: 0, amount: 0 });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orderData, summaryData] = await Promise.all([
        api.getMyOrders(year, String(month)),
        api.getMySummary(year, String(month)),
      ]);

      const orderMap = {};
      orderData.orders.forEach(o => {
        orderMap[o.date] = o.is_ordered;
      });
      setOrders(orderMap);

      const holidayMap = {};
      orderData.holidays.forEach(h => {
        holidayMap[h.date] = h.name;
      });
      setHolidays(holidayMap);

      setDefaultOrder(orderData.default_order);
      setSummary(summaryData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 公休日: 水曜(3)と日曜(0)
  const isRegularHoliday = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDay() === 0 || d.getDay() === 3;
  };

  const isBeforeDeadline = (dateStr) => {
    const now = new Date();
    const orderDate = new Date(dateStr + 'T00:00:00');
    const deadline = new Date(orderDate);
    deadline.setDate(deadline.getDate() - 1);
    deadline.setHours(17, 0, 0, 0);
    return now < deadline;
  };

  const isToday = (dateStr) => {
    const today = new Date();
    return dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const getOrderStatus = (dateStr) => {
    if (orders[dateStr] !== undefined) {
      return orders[dateStr] === 1;
    }
    return defaultOrder === 1;
  };

  const handleToggle = async (dateStr) => {
    if (isRegularHoliday(dateStr) || holidays[dateStr] || !isBeforeDeadline(dateStr)) return;

    const currentStatus = getOrderStatus(dateStr);
    setToggling(dateStr);

    try {
      await api.toggleOrder(dateStr, !currentStatus);
      setOrders(prev => ({ ...prev, [dateStr]: !currentStatus ? 1 : 0 }));

      // サマリーも更新
      const summaryData = await api.getMySummary(year, String(month));
      setSummary(summaryData);
    } catch (err) {
      alert(err.message);
    } finally {
      setToggling(null);
    }
  };

  const handleDefaultChange = async () => {
    const newDefault = !defaultOrder;
    try {
      await api.setDefaultOrder(newDefault);
      setDefaultOrder(newDefault ? 1 : 0);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else { setMonth(m => m - 1); }
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else { setMonth(m => m + 1); }
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  // カレンダーグリッド生成
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(dateStr);
  }

  if (loading) {
    return <div className="loading"><div className="spinner" />読み込み中...</div>;
  }

  return (
    <div>
      <h2 className="page-title">注文カレンダー</h2>

      {/* 統計 */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{summary.count}<span style={{ fontSize: '16px', color: '#6b7280' }}>日</span></div>
          <div className="stat-label">今月の注文数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#dc2626' }}>
            {summary.amount.toLocaleString()}<span style={{ fontSize: '16px' }}>円</span>
          </div>
          <div className="stat-label">控除予定額</div>
        </div>
      </div>

      {/* デフォルト設定 */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>デフォルト設定</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              {defaultOrder ? '毎日注文あり（不要な日だけOFF）' : '毎日注文なし（必要な日だけON）'}
            </div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={!!defaultOrder} onChange={handleDefaultChange} />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* カレンダー */}
      <div className="card">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className="btn btn-outline btn-sm" onClick={prevMonth}>◀</button>
            <div className="calendar-month">{year}年 {month}月</div>
            <button className="btn btn-outline btn-sm" onClick={nextMonth}>▶</button>
          </div>
          <button className="btn btn-outline btn-sm" onClick={goToday}>今月</button>
        </div>

        {/* 凡例 */}
        <div className="legend">
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#dcfce7', borderColor: '#16a34a' }}></div>
            <span>注文あり</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: 'white' }}></div>
            <span>注文なし</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#fee2e2' }}></div>
            <span>公休日（水・日）</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: '#f3f4f6' }}></div>
            <span>締切済み</span>
          </div>
        </div>

        <div className="calendar-grid">
          {WEEKDAYS.map(d => (
            <div key={d} className="calendar-day-header">{d}</div>
          ))}

          {cells.map((dateStr, i) => {
            if (!dateStr) {
              return <div key={`empty-${i}`} className="calendar-day empty"></div>;
            }

            const day = parseInt(dateStr.split('-')[2]);
            const regularHoliday = isRegularHoliday(dateStr);
            const holiday = holidays[dateStr];
            const pastDeadline = !isBeforeDeadline(dateStr);
            const disabled = regularHoliday || !!holiday;
            const ordered = getOrderStatus(dateStr);
            const today = isToday(dateStr);

            let className = 'calendar-day';
            if (disabled) className += regularHoliday ? ' weekend' : ' holiday';
            else if (pastDeadline) className += ' past-deadline';

            if (!disabled && ordered) className += ' ordered';
            else if (!disabled && !ordered) className += ' not-ordered';
            if (today) className += ' today';

            return (
              <div
                key={dateStr}
                className={className}
                onClick={() => !disabled && !pastDeadline && handleToggle(dateStr)}
                title={
                  holiday ? `${holiday}` :
                  pastDeadline ? '締切済み' :
                  ordered ? 'クリックでキャンセル' : 'クリックで注文'
                }
              >
                <span className="day-number">{day}</span>
                {!disabled && (
                  <span className="day-status">
                    {toggling === dateStr ? '...' : ordered ? '✅' : '−'}
                  </span>
                )}
                {holiday && <span className="day-label" style={{ color: '#dc2626', fontSize: '9px' }}>休</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="alert alert-info">
        ※ 変更は<strong>前日17:00</strong>まで可能です。締切を過ぎた日は変更できません。
      </div>
    </div>
  );
}
