import { useState, useEffect } from 'react';
import { api } from '../api';

export default function OrderConfirm() {
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState([]);

  const now = new Date();
  const [histYear, setHistYear] = useState(now.getFullYear());
  const [histMonth, setHistMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    loadTomorrow();
  }, []);

  useEffect(() => {
    loadHistory();
  }, [histYear, histMonth]);

  const loadTomorrow = async () => {
    setLoading(true);
    try {
      const result = await api.getTomorrowSummary();
      setData(result);
      setSelectedDate(result.date);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDateSummary = async (date) => {
    setLoading(true);
    setSelectedDate(date);
    try {
      const result = await api.getDateSummary(date);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const result = await api.getOrderHistory(histYear, String(histMonth));
      setHistory(result);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirm = async () => {
    if (!confirm(`${formatDate(data.date)} の弁当 ${data.total_count}個 を発注済みにしますか？`)) return;

    setConfirming(true);
    try {
      await api.confirmOrder(data.date);
      await loadDateSummary(data.date);
      await loadHistory();
      alert('発注済みにしました');
    } catch (err) {
      alert(err.message);
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}（${weekday}）`;
  };

  if (loading && !data) {
    return <div className="loading"><div className="spinner" />読み込み中...</div>;
  }

  return (
    <div>
      <h2 className="page-title">発注確認</h2>

      {/* 日付選択 */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>日付を選択:</label>
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto' }}
            value={selectedDate}
            onChange={(e) => loadDateSummary(e.target.value)}
          />
          <button className="btn btn-outline btn-sm" onClick={loadTomorrow}>明日に戻す</button>
        </div>
      </div>

      {data && (
        <>
          {/* 発注数カード */}
          <div className="card">
            <div className="confirm-box">
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                {formatDate(data.date)} の弁当注文数
              </div>
              <div className="count">{data.total_count}</div>
              <div className="unit">個</div>

              {data.is_confirmed ? (
                <div className="alert alert-success" style={{ marginTop: '16px', marginBottom: 0 }}>
                  発注済み（{data.confirmed_at}）
                </div>
              ) : (
                <button
                  className="btn btn-success btn-lg"
                  style={{ marginTop: '16px' }}
                  onClick={handleConfirm}
                  disabled={confirming || data.total_count === 0}
                >
                  {confirming ? '処理中...' : '発注済みにする'}
                </button>
              )}
            </div>
          </div>

          {/* 注文者一覧 */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '12px' }}>注文者一覧</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>社員番号</th>
                    <th>氏名</th>
                    <th style={{ textAlign: 'center' }}>注文</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map(o => (
                    <tr key={o.employee_number}>
                      <td>{o.employee_number}</td>
                      <td>{o.name}</td>
                      <td style={{ textAlign: 'center', fontSize: '18px' }}>
                        {o.is_ordered ? '✅' : '−'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 発注履歴 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">発注履歴</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={`${histYear}-${histMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-');
                setHistYear(parseInt(y));
                setHistMonth(parseInt(m));
              }}
            >
              {generateMonthOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th style={{ textAlign: 'center' }}>数量</th>
                <th style={{ textAlign: 'center' }}>状態</th>
                <th>確認者</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af' }}>データがありません</td></tr>
              ) : history.map(h => (
                <tr key={h.date}>
                  <td>{formatDate(h.date)}</td>
                  <td style={{ textAlign: 'center' }}>{h.total_count}個</td>
                  <td style={{ textAlign: 'center' }}>
                    {h.is_confirmed ?
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>発注済</span> :
                      <span style={{ color: '#9ca3af' }}>未発注</span>
                    }
                  </td>
                  <td>{h.confirmed_by_name || '−'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function generateMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = -2; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push({
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
      label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
    });
  }
  return options;
}
