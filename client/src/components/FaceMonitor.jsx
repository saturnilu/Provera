import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const MATCH_THRESHOLD = 0.55; 
const DETECT_INTERVAL_MS = 800;
const OBSCURED_CONFIDENCE = 0.5;

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

export default function FaceMonitor({ referenceEmbedding, onViolation, onOk }) {
  const videoRef = useRef(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      if (!cancelled) setModelsReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          onViolation({ type: 'camera_disconnected' });
          setBlocked(true);
          setMessage('Camera access was lost. Please reconnect your camera to continue.');
        });
      } catch (err) {
        onViolation({ type: 'camera_disconnected' });
        setBlocked(true);
        setMessage('Camera/microphone permission is required to take this exam.');
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) onViolation({ type: 'tab_switch' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!modelsReady || !referenceEmbedding) return;
    const interval = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setBlocked(true);
        setWarning('');
        setMessage('Face not detected. Please face the camera.');
        onViolation({ type: 'face_not_detected' });
        return;
      }

      if (detections.length > 1) {
        setBlocked(true);
        setWarning('');
        setMessage('Multiple faces detected.');
        onViolation({ type: 'multiple_faces' });
        return;
      }

      const [detection] = detections;

      if (detection.detection.score < OBSCURED_CONFIDENCE) {
        setBlocked(false);
        setWarning('Please make sure your face is fully visible and well lit.');
        onViolation({ type: 'face_obscured' });
        return;
      }

      const distance = euclideanDistance(detection.descriptor, referenceEmbedding);
      if (distance > MATCH_THRESHOLD) {
        setBlocked(true);
        setWarning('');
        setMessage('Face not recognized.');
        onViolation({ type: 'face_not_recognized' });
        return;
      }

      setBlocked(false);
      setWarning('');
      setMessage('');
      onOk?.();
    }, DETECT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [modelsReady, referenceEmbedding]);

  return (
    <div className="relative w-full max-w-xs rounded-lg overflow-hidden border border-border bg-card">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full aspect-video object-cover transition ${blocked ? 'blur-lg' : ''}`}
      />
      {!modelsReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 text-sm text-body">
          Loading proctoring models…
        </div>
      )}
      {blocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy/60 text-white text-sm font-medium text-center px-4">
          {message}
        </div>
      )}
      {!blocked && warning && (
        <div className="absolute bottom-0 inset-x-0 bg-warning/90 text-white text-xs font-medium text-center px-3 py-1.5">
          {warning}
        </div>
      )}
    </div>
  );
}

export async function loadModels() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
}

export async function captureDescriptor(videoEl) {
  const detection = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection ? Array.from(detection.descriptor) : null;
}