import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('sending');
    try {
      const res = await api.forgotPassword(email.trim());
      setResult(res);
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Gagal memproses permintaan');
      setStatus('idle');
    }
  }

  return (
    <div className="max-w-sm mx-auto py-16 px-4">
      <h1 className="text-2xl font-semibold text-navy mb-1">Lupa Password</h1>
      <p className="text-sm text-body mb-6">Masukkan email akun kamu, kami buatkan link untuk reset password.</p>

      {status !== 'done' && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" className="w-full border border-border rounded-md px-3 py-2"
            placeholder="email@kampus.ac.id" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button disabled={status === 'sending'} className="w-full bg-primary text-white rounded-md py-2 font-medium disabled:opacity-40">
            {status === 'sending' ? 'Memproses…' : 'Kirim Link Reset'}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      )}

      {status === 'done' && (
        <div className="space-y-3">
          <p className="text-sm text-body">{result.message}</p>
          {result.resetUrl && (
            <div className="bg-warning/10 border border-warning rounded-md p-3">
              <p className="text-xs text-body mb-2">
                {result.devNote}
              </p>
              <Link to={result.resetUrl} className="text-primary text-sm font-medium underline break-all">
                Lanjut ke halaman reset password &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      <Link to="/login" className="text-sm text-primary font-medium block mt-6">&larr; Kembali ke login</Link>
    </div>
  );
}