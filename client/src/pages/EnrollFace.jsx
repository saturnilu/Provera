import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { loadModels, captureDescriptor } from '../components/FaceMonitor';

export default function EnrollFace() {
  const { auth } = useAuth();
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    let stream;
    (async () => {
      await loadModels();
      setReady(true);
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function handleCapture() {
    setStatus('capturing');
    const descriptor = await captureDescriptor(videoRef.current);
    if (!descriptor) {
      setStatus('no-face');
      return;
    }
    await api.enrollFace({ embedding: descriptor }, auth.token);
    setStatus('done');
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <Link to="/student" className="text-sm text-primary font-medium block mb-6">&larr; Kembali ke Dashboard</Link>
      <h1 className="text-xl font-semibold text-navy mb-2">Daftarkan Wajah</h1>
      <p className="text-sm text-body mb-6">
        Ini cuma perlu dilakukan sekali. Pastikan wajah kamu terlihat jelas dan pencahayaan cukup.
      </p>
      <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-lg border border-border mb-4" />
      <button
        onClick={handleCapture}
        disabled={!ready || status === 'capturing'}
        className="w-full bg-primary text-white rounded-md py-2 font-medium disabled:opacity-50"
      >
        {status === 'capturing' ? 'Memproses…' : 'Ambil Foto & Daftarkan'}
      </button>
      {status === 'no-face' && <p className="text-danger text-sm mt-3">Wajah tidak terdeteksi, coba lagi.</p>}
      {status === 'done' && <p className="text-success text-sm mt-3">Wajah berhasil didaftarkan.</p>}
    </div>
  );
}