import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      <header className="app-header">
        <h1>
          <span className="logo-icon">🍱</span>
          お弁当注文管理
        </h1>
        <div className="header-right">
          <span className="user-name">{user?.name}</span>
          <span className={`badge ${user?.role === 'admin' ? 'badge-admin' : 'badge-employee'}`}>
            {user?.role === 'admin' ? '管理者' : '一般'}
          </span>
          <button className="btn btn-logout" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </header>
      <nav className="app-nav">
        <NavLink to="/" end>注文カレンダー</NavLink>
        {user?.role === 'admin' && (
          <>
            <NavLink to="/admin/orders">発注確認</NavLink>
            <NavLink to="/admin/monthly">月次集計</NavLink>
            <NavLink to="/admin/employees">従業員管理</NavLink>
          </>
        )}
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
