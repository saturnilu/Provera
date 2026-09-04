import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token, user } = await api.login({ email, password });
      login(token, user);
      if (user.role === 'lecturer') navigate('/lecturer');
      else if (user.role === 'student') navigate('/student');
      else navigate('/admin');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-navy mb-1">Masuk</h1>
        <p className="text-sm text-body mb-6">Masuk ke akun lecturer atau student kamu.</p>
        {error && <p className="text-sm text-danger mb-4">{error}</p>}
        <label className="block text-sm text-body mb-1">Email</label>
        <input className="w-full border border-border rounded-md px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-primary-light"
          value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label className="block text-sm text-body mb-1">Password</label>
        <input className="w-full border border-border rounded-md px-3 py-2 mb-6 outline-none focus:ring-2 focus:ring-primary-light"
          value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        <button className="w-full bg-primary text-white rounded-md py-2 font-medium hover:opacity-90" type="submit">
          Masuk
        </button>
        <p className="text-sm text-body mt-4 text-center">
          Belum punya akun? <Link to="/register" className="text-primary font-medium">Daftar</Link>
        </p>
      </form>
    </div>
  );
}