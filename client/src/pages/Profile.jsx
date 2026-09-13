import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function Profile() {
  const { auth, updateSession } = useAuth();
  const [name, setName] = useState(auth.user.name);
  const [nameStatus, setNameStatus] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwStatus, setPwStatus] = useState(null);

  async function handleSaveName(e) {
    e.preventDefault();
    setNameStatus('saving');
    try {
      const { token, user } = await api.updateProfile({ name: name.trim() }, auth.token);
      updateSession(token, user);
      setNameStatus('saved');
      setTimeout(() => setNameStatus(null), 2000);
    } catch (err) {
      setNameStatus(err.message || 'Gagal menyimpan');
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pw.newPassword !== pw.confirmPassword) {
      setPwStatus('Konfirmasi password baru tidak cocok');
      return;
    }
    setPwStatus('saving');
    try {
      await api.changePassword(
        { currentPassword: pw.currentPassword, newPassword: pw.newPassword },
        auth.token
      );
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwStatus('saved');
      setTimeout(() => setPwStatus(null), 2000);
    } catch (err) {
      setPwStatus(err.message || 'Gagal mengganti password');
    }
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4 space-y-8">
      <h1 className="text-2xl font-semibold text-navy">Profil Akun</h1>

      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-medium text-navy mb-4">Info Akun</h2>
        <form onSubmit={handleSaveName} className="space-y-3">
          <div>
            <label className="block text-sm text-body mb-1">Nama</label>
            <input className="w-full border border-border rounded-md px-3 py-2"
              value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-body mb-1">Email</label>
            <input className="w-full border border-border rounded-md px-3 py-2 bg-background text-body"
              value={auth.user.email} disabled />
            <p className="text-xs text-body mt-1">Email belum bisa diganti sendiri di MVP ini.</p>
          </div>
          <div>
            <label className="block text-sm text-body mb-1">Role</label>
            <input className="w-full border border-border rounded-md px-3 py-2 bg-background text-body capitalize"
              value={auth.user.role} disabled />
          </div>
          <button
            disabled={nameStatus === 'saving' || !name.trim()}
            className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {nameStatus === 'saving' ? 'Menyimpan…' : 'Simpan Nama'}
          </button>
          {nameStatus === 'saved' && <span className="text-sm text-success ml-3">Tersimpan.</span>}
          {nameStatus && nameStatus !== 'saving' && nameStatus !== 'saved' && (
            <p className="text-sm text-danger mt-2">{nameStatus}</p>
          )}
        </form>
      </section>

      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-medium text-navy mb-4">Ganti Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-sm text-body mb-1">Password saat ini</label>
            <input type="password" className="w-full border border-border rounded-md px-3 py-2"
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm text-body mb-1">Password baru</label>
            <input type="password" minLength={6} className="w-full border border-border rounded-md px-3 py-2"
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
            <p className="text-xs text-body mt-1">Minimal 6 karakter.</p>
          </div>
          <div>
            <label className="block text-sm text-body mb-1">Konfirmasi password baru</label>
            <input type="password" className="w-full border border-border rounded-md px-3 py-2"
              value={pw.confirmPassword}
              onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} required />
          </div>
          <button
            disabled={pwStatus === 'saving'}
            className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {pwStatus === 'saving' ? 'Menyimpan…' : 'Ganti Password'}
          </button>
          {pwStatus === 'saved' && <span className="text-sm text-success ml-3">Password diganti.</span>}
          {pwStatus && pwStatus !== 'saving' && pwStatus !== 'saved' && (
            <p className="text-sm text-danger mt-2">{pwStatus}</p>
          )}
        </form>
      </section>
    </div>
  );
}