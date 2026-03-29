import { useState, useEffect } from 'react';
import { api } from '../api';

export default function MonthlySummary() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await api.getMonthlySummary(year, String(month));
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const blob = await api.downloadCsv(year, String(month));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `弁当集計_${year}年${month}月.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('CSVダウンロードに失敗しました: ' + err.message);
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

  return (
    <div>
      <h2 className="page-title">月次集計</h2>

      {/* 月選択 */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div className="calendar-nav">
            <button className="btn btn-outline btn-sm" onClick={prevMonth}>◀</button>
            <div className="calendar-month">{year}年 {month}月</div>
            <button className="btn btn-outline btn-sm" onClick={nextMonth}>▶</button>
          </div>
          <button className="btn btn-primary" onClick={handleDownloadCsv} disabled={loading}>
            📥 CSV ダウンロード
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" />集計中...</div>
      ) : data && (
        <>
          {/* サマリー */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-value">{data.employees.length}<span style={{ fontSize: '16px', color: '#6b7280' }}>名</span></div>
              <div className="stat-label">対象従業員数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.workday_count}<span style={{ fontSize: '16px', color: '#6b7280' }}>日</span></div>
              <div className="stat-label">営業日数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#dc2626' }}>
                {data.employees.reduce((sum, e) => sum + e.deduction, 0).toLocaleString()}<span style={{ fontSize: '14px' }}>円</span>
              </div>
              <div className="stat-label">控除合計額</div>
            </div>
          </div>

          {/* 集計テーブル */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '12px' }}>給与控除データ</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>社員番号</th>
                    <th>氏名</th>
                    <th style={{ textAlign: 'center' }}>注文日数</th>
                    <th style={{ textAlign: 'right' }}>控除額</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map(emp => (
                    <tr key={emp.employee_number}>
                      <td>{emp.employee_number}</td>
                      <td>{emp.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <strong>{emp.order_days}</strong> / {data.workday_count}日
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ¥{emp.deduction.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                    <td colSpan="2">合計</td>
                    <td style={{ textAlign: 'center' }}>
                      {data.employees.reduce((sum, e) => sum + e.order_days, 0)}日
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      ¥{data.employees.reduce((sum, e) => sum + e.deduction, 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 日別詳細 */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '12px' }}>日別詳細</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, background: '#f9fafb', zIndex: 1 }}>氏名</th>
                    {(data.all_days || []).map(d => {
                      const date = new Date(d.date + 'T00:00:00');
                      return (
                        <th key={d.date} style={{ textAlign: 'center', minWidth: '36px', fontSize: '11px' }}>
                          {date.getDate()}<br />
                          <span style={{ color: '#9ca3af' }}>
                            {['日','月','火','水','木','金','土'][date.getDay()]}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map(emp => (
                    <tr key={emp.employee_number}>
                      <td style={{ position: 'sticky', left: 0, background: 'white', zIndex: 1, whiteSpace: 'nowrap' }}>
                        {emp.name}
                      </td>
                      {emp.daily_detail.map(dd => (
                        <td key={dd.date} style={{ textAlign: 'center', fontSize: '14px' }}>
                          {dd.ordered ? '●' : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
