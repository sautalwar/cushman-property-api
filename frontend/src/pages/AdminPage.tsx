export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">⚙️ Admin Panel</h1>
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
        <p className="text-slate-400">This panel requires a valid JWT with <code className="bg-slate-700 px-1 rounded">role: "admin"</code>.</p>
        <p className="text-slate-500 text-sm mt-4">
          💡 Demo: Use VULN-3 (Mass Assignment) to elevate a contractor role to "admin" — then try accessing this page.
        </p>
      </div>
    </div>
  );
}