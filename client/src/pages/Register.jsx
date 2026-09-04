import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token, user } = await api.register(form);
      login(token, user);
      navigate(user.role === 'lecturer' ? '/lecturer' : '/student');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-navy mb-1">Daftar</h1>
        <p className="text-sm text-body mb-6">Akun admin dibuat lewat seed script, bukan lewat form ini.</p>
        {error && <p className="text-sm text-danger mb-4">{error}</p>}

        <label className="block text-sm text-body mb-1">Nama</label>
        <input className="w-full border border-border rounded-md px-3 py-2 mb-4"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

        <label className="block text-sm text-body mb-1">Email</label>
        <input className="w-full border border-border rounded-md px-3 py-2 mb-4" type="email"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />

        <label className="block text-sm text-body mb-1">Password</label>
        <input className="w-full border border-border rounded-md px-3 py-2 mb-4" type="password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />

        <label className="block text-sm text-body mb-1">Daftar sebagai</label>
        <select className="w-full border border-border rounded-md px-3 py-2 mb-6"
          value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="student">Student</option>
          <option value="lecturer">Lecturer</option>
        </select>

        <button className="w-full bg-primary text-white rounded-md py-2 font-medium hover:opacity-90" type="submit">
          Daftar
        </button>
        <p className="text-sm text-body mt-4 text-center">
          Sudah punya akun? <Link to="/login" className="text-primary font-medium">Masuk</Link>
        </p>
      </form>
    </div>
  );
}