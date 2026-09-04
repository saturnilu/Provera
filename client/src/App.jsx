import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import EnrollFace from './pages/EnrollFace';
import LecturerRooms from './pages/LecturerRooms';
import LecturerRoomDetail from './pages/LecturerRoomDetail';
import Recap from './pages/Recap';
import StudentJoin from './pages/StudentJoin';
import StudentExam from './pages/StudentExam';

function RequireRole({ role, children }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" />;
  if (role && auth.user.role !== role) return <Navigate to="/" />;
  return children;
}

function Nav() {
  const { auth, logout } = useAuth();
  const dashboardPath = auth ? (auth.user.role === 'lecturer' ? '/lecturer' : auth.user.role === 'student' ? '/student' : '/admin') : '/';
  return (
    <nav className="border-b border-border bg-card px-6 py-3 flex justify-between items-center">
      <Link to="/" className="font-semibold text-navy">Quiz Platform</Link>
      {auth && (
        <div className="flex items-center gap-4 text-sm text-body">
          <Link to={dashboardPath} className="text-primary font-medium">Dashboard</Link>
          <span>{auth.user.name} · {auth.user.role}</span>
          <button onClick={logout} className="text-danger">Keluar</button>
        </div>
      )}
    </nav>
  );
}

function Home() {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" />;
  if (auth.user.role === 'lecturer') return <Navigate to="/lecturer" />;
  if (auth.user.role === 'student') return <Navigate to="/student" />;
  return <Navigate to="/admin" />;
}

function AdminHome() {
  return (
    <div className="max-w-xl mx-auto py-16 px-4 text-center">
      <h1 className="text-xl font-semibold text-navy mb-2">Admin</h1>
      <p className="text-body text-sm">
        Panel admin masih minimal di MVP ini, perluas sesuai kebutuhan (kelola akun lecturer,
        lihat semua room, dsb). Lihat README bagian "Extension points".
      </p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/admin" element={<RequireRole role="admin"><AdminHome /></RequireRole>} />

          <Route path="/lecturer" element={<RequireRole role="lecturer"><LecturerRooms /></RequireRole>} />
          <Route path="/lecturer/rooms/:roomId" element={<RequireRole role="lecturer"><LecturerRoomDetail /></RequireRole>} />
          <Route path="/lecturer/rooms/:roomId/recap" element={<RequireRole role="lecturer"><Recap /></RequireRole>} />

          <Route path="/student" element={<RequireRole role="student"><StudentJoin /></RequireRole>} />
          <Route path="/student/enroll-face" element={<RequireRole role="student"><EnrollFace /></RequireRole>} />
          <Route path="/student/rooms/:roomId" element={<RequireRole role="student"><StudentExam /></RequireRole>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}