import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import EnrollFace from './pages/EnrollFace';
import LecturerRooms from './pages/LecturerRooms';
import LecturerRoomDetail from './pages/LecturerRoomDetail';
import Recap from './pages/Recap';
import StudentJoin from './pages/StudentJoin';
import StudentExam from './pages/StudentExam';
import AdminDashboard from './pages/AdminDashboard';
import QuestionBank from './pages/QuestionBank';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';

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
      <Link to="/" className="font-semibold text-navy">Provera</Link>
      {auth && (
        <div className="flex items-center gap-4 text-sm text-body">
          <Link to={dashboardPath} className="text-primary font-medium">Dashboard</Link>
          {auth.user.role === 'lecturer' && (
            <>
              <Link to="/lecturer/bank" className="text-primary font-medium">Bank Soal</Link>
              <Link to="/lecturer/courses" className="text-primary font-medium">Mata Kuliah</Link>
            </>
          )}
          <span>{auth.user.name} · {auth.user.role}</span>
          <Link to="/profile" className="text-body hover:text-primary">Profil</Link>
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

export default function App() {
  return (
    <AuthProvider>
      <ModalProvider>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/profile" element={<RequireRole><Profile /></RequireRole>} />

          <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
          <Route path="/admin/rooms/:roomId/recap" element={<RequireRole role="admin"><Recap /></RequireRole>} />

          <Route path="/lecturer" element={<RequireRole role="lecturer"><LecturerRooms /></RequireRole>} />
          <Route path="/lecturer/rooms/:roomId" element={<RequireRole role="lecturer"><LecturerRoomDetail /></RequireRole>} />
          <Route path="/lecturer/rooms/:roomId/recap" element={<RequireRole role="lecturer"><Recap /></RequireRole>} />
          <Route path="/lecturer/bank" element={<RequireRole role="lecturer"><QuestionBank /></RequireRole>} />
          <Route path="/lecturer/courses" element={<RequireRole role="lecturer"><Courses /></RequireRole>} />
          <Route path="/lecturer/courses/:courseId" element={<RequireRole role="lecturer"><CourseDetail /></RequireRole>} />

          <Route path="/student" element={<RequireRole role="student"><StudentJoin /></RequireRole>} />
          <Route path="/student/enroll-face" element={<RequireRole role="student"><EnrollFace /></RequireRole>} />
          <Route path="/student/rooms/:roomId" element={<RequireRole role="student"><StudentExam /></RequireRole>} />
        </Routes>
      </BrowserRouter>
      </ModalProvider>
    </AuthProvider>
  );
}