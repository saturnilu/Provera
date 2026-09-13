import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok');
      return;
    }
    setStatus('saving');
    try {
      await api.resetPassword({ token, newPassword });
      setStatus('done');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.message || 'Gagal reset password');
      setStatus('idle');
    }
  }

  if (!token) {
    return (
      <div className="max-w-sm mx-auto py-16 px-4 text-center">
        <p className="text-danger text-sm mb-4">Link reset tidak valid — token tidak ditemukan.</p>
        <Link to="/forgot-password" className="text-primary text-sm font-medium">Minta link reset baru</Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-16 px-4">
      <h1 className="text-2xl font-semibold text-navy mb-6">Reset Password</h1>

      {status === 'done' ? (
        <p className="text-sm text-success">Password berhasil diganti. Mengarahkan ke halaman login…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-body mb-1">Password baru</label>
            <input type="password" minLength={6} className="w-full border border-border rounded-md px-3 py-2"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-body mb-1">Konfirmasi password baru</label>
            <input type="password" className="w-full border border-border rounded-md px-3 py-2"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button disabled={status === 'saving'} className="w-full bg-primary text-white rounded-md py-2 font-medium disabled:opacity-40">
            {status === 'saving' ? 'Menyimpan…' : 'Reset Password'}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      )}
    </div>
  );
}