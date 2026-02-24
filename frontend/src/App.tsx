import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PropertiesPage from './pages/PropertiesPage';
import ContractorsPage from './pages/ContractorsPage';
import JobsPage from './pages/JobsPage';

const navItems = [
  { path: '/',             label: '🛡️ Dashboard' },
  { path: '/properties',  label: '🏢 Properties' },
  { path: '/contractors', label: '🔧 Contractors' },
  { path: '/jobs',        label: '📋 Jobs' },
];

export default function App() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center gap-8">
        <div className="text-xl font-bold text-blue-400">🏗️ PropTracker</div>
        <div className="flex gap-6">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'text-blue-400 border-b-2 border-blue-400 pb-1'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto text-xs text-slate-500">APIM Security POC — GitHub Actions Demo</div>
      </nav>
      <main className="p-6">
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/properties"   element={<PropertiesPage />} />
          <Route path="/contractors"  element={<ContractorsPage />} />
          <Route path="/jobs"         element={<JobsPage />} />
        </Routes>
      </main>
    </div>
  );
}