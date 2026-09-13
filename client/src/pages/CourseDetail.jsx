import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { SkeletonBlock, SkeletonLine } from '../components/Skeleton';

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

export default function CourseDetail() {
  const { courseId } = useParams();
  const { auth } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getCourse(courseId, auth.token).then(setData);
  }, [courseId]);

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-4">
        <SkeletonLine width="w-32" className="h-3" />
        <SkeletonLine width="w-64" className="h-6" />
        <div className="space-y-2 pt-4">
          {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  const { course, rooms } = data;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      <Link to="/lecturer/courses" className="text-sm text-primary font-medium">&larr; Semua Mata Kuliah</Link>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-navy">
            {course.name} {course.code && <span className="text-body font-normal text-lg">({course.code})</span>}
          </h1>
          <p className="text-sm text-body">Riwayat {rooms.length} room/quiz di mata kuliah ini.</p>
        </div>
        <Link
          to="/lecturer"
          className="bg-primary text-white rounded-md px-4 py-2 text-sm font-medium shrink-0"
        >
          + Room Baru
        </Link>
      </div>

      <div className="space-y-2">
        {rooms.map((r) => (
          <Link
            key={r.id}
            to={r.status === 'ended' ? `/lecturer/rooms/${r.id}/recap` : `/lecturer/rooms/${r.id}`}
            className="block bg-card border border-border rounded-xl p-4 hover:border-primary transition"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-navy">{r.title}</p>
                <p className="text-sm text-body">
                  {fmtDate(r.created_at)} · {r.duration_minutes} menit · {r.completed_count}/{r.participant_count} selesai
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded shrink-0 ${STATUS_BADGE[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
            </div>
          </Link>
        ))}
        {rooms.length === 0 && (
          <p className="text-body text-sm py-6 text-center">
            Belum ada room di mata kuliah ini. Buat room baru dan pilih mata kuliah ini saat membuatnya.
          </p>
        )}
      </div>
    </div>
  );
}
