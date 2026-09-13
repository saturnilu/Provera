import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { api } from '../api';
import { AdminSkeleton } from '../components/Skeleton';

const ROLE_LABEL = { admin: 'Admin', lecturer: 'Lecturer', student: 'Siswa' };
const ROLE_BADGE = {
  admin: 'bg-navy/10 text-navy',
  lecturer: 'bg-primary-light text-primary',
  student: 'bg-success/10 text-success',
};
const STATUS_LABEL = { draft: 'Draft', waiting: 'Menunggu', in_progress: 'Berlangsung', ended: 'Selesai' };
const STATUS_BADGE = {
  draft: 'bg-border text-body',
  waiting: 'bg-warning/10 text-warning',
  in_progress: 'bg-primary-light text-primary',
  ended: 'bg-success/10 text-success',
};

function fmtDate(sqliteDate) {
  return new Date(sqliteDate + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatCard({ label, value }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-sm text-body mb-1">{label}</p>
      <p className="text-2xl font-semibold text-navy">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { auth } = useAuth();
  const { confirmDialog } = useModal();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    const [s, u, r] = await Promise.all([
      api.adminStats(auth.token),
      api.adminListUsers(auth.token),
      api.adminListRooms(auth.token),
    ]);
    setStats(s);
    setUsers(u);
    setRooms(r);
  }
  useEffect(() => {
    refresh();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (search && !`${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [users, roleFilter, search]);

  async function handleToggleUser(user) {
    const deactivating = user.is_active !== 0;
    const ok = await confirmDialog({
      title: deactivating ? `Nonaktifkan akun ${user.name}?` : `Aktifkan lagi akun ${user.name}?`,
      message: deactivating
        ? `Akun ${ROLE_LABEL[user.role].toLowerCase()} (${user.email}) tidak akan bisa login. Data & histori tetap tersimpan, dan ini bisa dibatalkan kapan saja.`
        : `Akun ${user.email} akan bisa login lagi seperti biasa.`,
      variant: deactivating ? 'danger' : 'primary',
      confirmLabel: deactivating ? 'Nonaktifkan' : 'Aktifkan',
    });
    if (!ok) return;
    setError('');
    setBusyId(user.id);
    try {
      if (deactivating) await api.adminDeactivateUser(user.id, auth.token);
      else await api.adminReactivateUser(user.id, auth.token);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteRoom(room) {
    const ok = await confirmDialog({
      title: `Hapus room "${room.title}"?`,
      message: 'Kode undangan akan hilang. Nilai & log peserta tetap tersimpan.',
      variant: 'danger',
      confirmLabel: 'Hapus',
    });
    if (!ok) return;
    setError('');
    setBusyId(room.id);
    try {
      await api.adminDeleteRoom(room.id, auth.token);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!stats || !users || !rooms) return <AdminSkeleton />;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy mb-1">Admin</h1>
        <p className="text-sm text-body">Kelola akun & pantau semua room lintas lecturer.</p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Lecturer" value={stats.lecturers} />
        <StatCard label="Siswa" value={stats.students} />
        <StatCard label="Total Room" value={stats.totalRooms} />
        <StatCard label="Ujian Berlangsung" value={stats.roomsByStatus.in_progress || 0} />
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-medium text-navy">Akun ({filteredUsers.length})</h2>
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-sm text-navy bg-card"
            >
              <option value="all">Semua role</option>
              <option value="lecturer">Lecturer</option>
              <option value="student">Siswa</option>
              <option value="admin">Admin</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama/email…"
              className="border border-border rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background text-body text-left">
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Aktivitas</th>
                <th className="px-4 py-2 font-medium">Terdaftar</th>
                <th className="px-4 py-2 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2 text-navy font-medium whitespace-nowrap">{u.name}</td>
                  <td className="px-4 py-2 text-body">{u.email}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                  </td>
                  <td className="px-4 py-2">
                    {u.is_active === 0 ? (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-danger/10 text-danger">Nonaktif</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-success/10 text-success">Aktif</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-body whitespace-nowrap">
                    {u.role === 'lecturer' && `${u.roomCount} room`}
                    {u.role === 'student' && `${u.sessionCount} ujian diikuti`}
                    {u.role === 'admin' && '—'}
                  </td>
                  <td className="px-4 py-2 text-body whitespace-nowrap">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-2 text-right">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => handleToggleUser(u)}
                        disabled={busyId === u.id}
                        className={`font-medium text-sm disabled:opacity-40 ${u.is_active === 0 ? 'text-primary' : 'text-danger'}`}
                      >
                        {u.is_active === 0 ? 'Aktifkan' : 'Nonaktifkan'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-body">
                    Tidak ada akun yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-medium text-navy mb-3">Semua Room ({rooms.length})</h2>
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background text-body text-left">
                <th className="px-4 py-2 font-medium">Judul</th>
                <th className="px-4 py-2 font-medium">Lecturer</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Peserta</th>
                <th className="px-4 py-2 font-medium">Dibuat</th>
                <th className="px-4 py-2 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 text-navy font-medium whitespace-nowrap">{r.title}</td>
                  <td className="px-4 py-2 text-body whitespace-nowrap">{r.lecturer_name}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="px-4 py-2 text-body whitespace-nowrap">{r.participant_count}/{r.max_participants}</td>
                  <td className="px-4 py-2 text-body whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap space-x-3">
                    {r.status === 'ended' && (
                      <Link to={`/admin/rooms/${r.id}/recap`} className="text-primary font-medium text-sm">
                        Rekap
                      </Link>
                    )}
                    <button
                      onClick={() => handleDeleteRoom(r)}
                      disabled={busyId === r.id}
                      className="text-danger font-medium text-sm disabled:opacity-40"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-body">
                    Belum ada room.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}