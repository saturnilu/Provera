import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { api } from '../api';
import { SkeletonBlock } from '../components/Skeleton';

function fmtDate(sqliteDate) {
  return new Date(sqliteDate + 'Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Courses() {
  const { auth } = useAuth();
  const { confirmDialog } = useModal();

  const [courses, setCourses] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    setCourses(await api.listCourses(auth.token));
  }
  useEffect(() => { refresh(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createCourse({ name: name.trim(), code: code.trim() || undefined }, auth.token);
      setName('');
      setCode('');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(course) {
    const ok = await confirmDialog({
      title: `Hapus mata kuliah "${course.name}"?`,
      message: 'Room/quiz yang sudah ada di mata kuliah ini tidak akan ikut terhapus — cuma dilepas dari pengelompokan.',
      variant: 'danger',
      confirmLabel: 'Hapus',
    });
    if (!ok) return;
    setBusyId(course.id);
    try {
      await api.deleteCourse(course.id, auth.token);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy mb-1">Mata Kuliah</h1>
        <p className="text-sm text-body">
          Kelompokkan room/quiz per mata kuliah supaya riwayatnya kelihatan dari semester ke semester.
        </p>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-5 flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm text-body mb-1">Nama mata kuliah</label>
          <input className="w-full border border-border rounded-md px-3 py-2" value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Bahasa Mandarin Dasar" required />
        </div>
        <div className="w-40">
          <label className="block text-sm text-body mb-1">Kode (opsional)</label>
          <input className="w-full border border-border rounded-md px-3 py-2" value={code}
            onChange={(e) => setCode(e.target.value)} placeholder="MAND101" />
        </div>
        <button className="bg-primary text-white rounded-md px-4 py-2 font-medium">Tambah</button>
      </form>

      {courses === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <SkeletonBlock key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-center gap-4">
              <Link to={`/lecturer/courses/${c.id}`} className="min-w-0 flex-1 hover:opacity-80">
                <p className="font-medium text-navy">
                  {c.name} {c.code && <span className="text-body font-normal">({c.code})</span>}
                </p>
                <p className="text-sm text-body">
                  {c.roomCount} room · {c.endedCount} selesai
                  {c.lastActivityAt && <> · terakhir {fmtDate(c.lastActivityAt)}</>}
                </p>
              </Link>
              <button
                onClick={() => handleDelete(c)}
                disabled={busyId === c.id}
                className="text-danger font-medium text-sm disabled:opacity-40 shrink-0"
              >
                Hapus
              </button>
            </div>
          ))}
          {courses.length === 0 && (
            <p className="text-body text-sm py-6 text-center">
              Belum ada mata kuliah. Tambah satu di atas, lalu pilih mata kuliah ini saat bikin room baru.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
