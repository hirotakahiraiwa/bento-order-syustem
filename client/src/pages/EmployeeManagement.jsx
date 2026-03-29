import { useState, useEffect } from 'react';
import { api } from '../api';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [tab, setTab] = useState('employees');

  const now = new Date();
  const [holidayYear, setHolidayYear] = useState(now.getFullYear());

  // フォーム
  const [form, setForm] = useState({
    employee_number: '',
    name: '',
    password: '',
    role: 'employee',
    is_bento_target: true,
    default_order: true,
  });

  const [holidayForm, setHolidayForm] = useState({ date: '', name: '' });

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (tab === 'holidays') loadHolidays();
  }, [tab, holidayYear]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const result = await api.getEmployees();
      setEmployees(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHolidays = async () => {
    try {
      const result = await api.getHolidays(holidayYear);
      setHolidays(result);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    setForm({
      employee_number: '',
      name: '',
      password: '',
      role: 'employee',
      is_bento_target: true,
      default_order: true,
    });
    setShowModal(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setForm({
      employee_number: emp.employee_number,
      name: emp.name,
      password: '',
      role: emp.role,
      is_bento_target: !!emp.is_bento_target,
      default_order: !!emp.default_order,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        const updateData = {
          name: form.name,
          role: form.role,
          is_bento_target: form.is_bento_target,
          default_order: form.default_order,
        };
        if (form.password) updateData.password = form.password;
        await api.updateEmployee(editingEmployee.id, updateData);
      } else {
        await api.addEmployee(form);
      }
      setShowModal(false);
      loadEmployees();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (emp) => {
    const action = emp.is_active ? '無効化' : '有効化';
    if (!confirm(`${emp.name} を${action}しますか？`)) return;

    try {
      await api.toggleEmployeeActive(emp.id);
      loadEmployees();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.date) return;
    try {
      await api.addHoliday(holidayForm.date, holidayForm.name || '休業日');
      setHolidayForm({ date: '', name: '' });
      loadHolidays();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!confirm('この休業日を削除しますか？')) return;
    try {
      await api.deleteHoliday(id);
      loadHolidays();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <h2 className="page-title">従業員管理</h2>

      {/* タブ */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        <button
          className={`btn ${tab === 'employees' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('employees')}
        >
          従業員一覧
        </button>
        <button
          className={`btn ${tab === 'holidays' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('holidays')}
        >
          休業日管理
        </button>
      </div>

      {tab === 'employees' && (
        <>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">従業員一覧（{employees.length}名）</h3>
              <button className="btn btn-primary" onClick={openAddModal}>+ 追加</button>
            </div>
            {loading ? (
              <div className="loading"><div className="spinner" />読み込み中...</div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>社員番号</th>
                      <th>氏名</th>
                      <th style={{ textAlign: 'center' }}>権限</th>
                      <th style={{ textAlign: 'center' }}>弁当対象</th>
                      <th style={{ textAlign: 'center' }}>デフォルト</th>
                      <th style={{ textAlign: 'center' }}>状態</th>
                      <th style={{ textAlign: 'center' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} style={emp.is_active ? {} : { opacity: 0.5 }}>
                        <td>{emp.employee_number}</td>
                        <td>{emp.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${emp.role === 'admin' ? 'badge-admin' : 'badge-employee'}`}>
                            {emp.role === 'admin' ? '管理者' : '一般'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {emp.is_bento_target ? '✅' : '−'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '13px' }}>
                          {emp.default_order ? '毎日あり' : '毎日なし'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {emp.is_active ?
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>有効</span> :
                            <span style={{ color: '#dc2626', fontWeight: 600 }}>無効</span>
                          }
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => openEditModal(emp)}>
                              編集
                            </button>
                            <button
                              className={`btn btn-sm ${emp.is_active ? 'btn-danger' : 'btn-success'}`}
                              onClick={() => handleToggleActive(emp)}
                            >
                              {emp.is_active ? '無効化' : '有効化'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'holidays' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{holidayYear}年 休業日一覧</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setHolidayYear(y => y - 1)}>◀</button>
              <button className="btn btn-outline btn-sm" onClick={() => setHolidayYear(y => y + 1)}>▶</button>
            </div>
          </div>

          {/* 休業日追加フォーム */}
          <form onSubmit={handleAddHoliday} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto' }}
              value={holidayForm.date}
              onChange={(e) => setHolidayForm(f => ({ ...f, date: e.target.value }))}
              required
            />
            <input
              type="text"
              className="form-input"
              style={{ width: '160px' }}
              placeholder="名称（例：創立記念日）"
              value={holidayForm.name}
              onChange={(e) => setHolidayForm(f => ({ ...f, name: e.target.value }))}
            />
            <button type="submit" className="btn btn-primary btn-sm">追加</button>
          </form>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>名称</th>
                  <th style={{ textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center', color: '#9ca3af' }}>登録された休業日はありません</td></tr>
                ) : holidays.map(h => (
                  <tr key={h.id}>
                    <td>{formatHolidayDate(h.date)}</td>
                    <td>{h.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteHoliday(h.id)}>削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="alert alert-info" style={{ marginTop: '16px' }}>
            ※ 土日は自動的に休みとなります。ここでは祝日や会社独自の休業日を登録してください。
          </div>
        </div>
      )}

      {/* 従業員追加・編集モーダル */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingEmployee ? '従業員編集' : '従業員追加'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">社員番号</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.employee_number}
                    onChange={(e) => setForm(f => ({ ...f, employee_number: e.target.value }))}
                    disabled={!!editingEmployee}
                    required
                    placeholder="例: E006"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">氏名</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="例: 山田 太郎"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    パスワード{editingEmployee ? '（変更する場合のみ入力）' : ''}
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    required={!editingEmployee}
                    placeholder="4文字以上"
                    minLength={4}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">権限</label>
                  <select
                    className="form-select"
                    value={form.role}
                    onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
                  >
                    <option value="employee">一般従業員</option>
                    <option value="admin">管理者（総務課員）</option>
                  </select>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>弁当注文対象</label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={form.is_bento_target}
                        onChange={(e) => setForm(f => ({ ...f, is_bento_target: e.target.checked }))}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <label className="form-label" style={{ marginBottom: 0 }}>デフォルト注文</label>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>ONで毎日注文あり</div>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={form.default_order}
                        onChange={(e) => setForm(f => ({ ...f, default_order: e.target.checked }))}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  キャンセル
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEmployee ? '更新' : '追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatHolidayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}（${weekday}）`;
}
