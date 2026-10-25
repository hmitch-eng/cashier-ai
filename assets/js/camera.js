import { captureVideoFrame } from './util.js';

export class CameraError extends Error {
  constructor(message, code = 'CAMERA') {
    super(message);
    this.name = 'CameraError';
    this.code = code;
  }
}

export function cameraSupportError() {
  if (!window.isSecureContext && location.protocol !== 'file:') {
    return 'الكاميرا تتطلب اتصالاً آمناً. افتح التطبيق عبر localhost أو HTTPS.';
  }
  if (location.protocol === 'file:') {
    return 'فتح الملف مباشرة لا يسمح بالكاميرا. شغّل التطبيق عبر localhost.';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'هذا المتصفح لا يوفّر وصولاً إلى الكاميرا. جرّب Chrome أو Edge، أو ارفع صورة بدلاً من ذلك.';
  }
  return '';
}

export function friendlyCameraError(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'لم يُسمح بالوصول إلى الكاميرا. اسمح بها من إعدادات المتصفح ثم أعد المحاولة.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'لم أجد كاميرا متاحة. وصّل كاميرا أو ارفع صورة من الجهاز.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'الكاميرا مستخدمة من تطبيق آخر. أغلقها ثم أعد المحاولة.';
  }
  if (name === 'AbortError') {
    return 'توقّف تشغيل الكاميرا. أعد المحاولة.';
  }
  return error?.message || 'تعذّر تشغيل الكاميرا.';
}

export async function startCamera(video, { facingMode = 'environment' } = {}) {
  const supportError = cameraSupportError();
  if (supportError) throw new CameraError(supportError, 'UNSUPPORTED');
  if (!video) throw new CameraError('عنصر الكاميرا غير جاهز.', 'ELEMENT');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1600 },
        height: { ideal: 1200 }
      },
      audio: false
    });
  } catch (error) {
    throw new CameraError(friendlyCameraError(error), error?.name || 'CAMERA');
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  try {
    await video.play();
  } catch {
    // Autoplay can require a direct click; the controls stay available.
  }
  await waitForVideo(video, 5000);
  return stream;
}

export function waitForVideo(video, timeout = 5000) {
  return new Promise((resolve) => {
    if (video.readyState >= 2 && video.videoWidth) {
      resolve();
      return;
    }
    let timer;
    const done = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', done);
      video.removeEventListener('canplay', done);
    };
    video.addEventListener('loadeddata', done, { once: true });
    video.addEventListener('canplay', done, { once: true });
    timer = setTimeout(done, timeout);
  });
}

export function stopCamera(streamOrVideo) {
  const stream = streamOrVideo?.srcObject || streamOrVideo;
  if (stream?.getTracks) {
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // Ignore tracks that were already stopped.
      }
    }
  }
  if (streamOrVideo?.srcObject !== undefined) {
    try {
      streamOrVideo.srcObject = null;
    } catch {
      // Ignore detached media elements.
    }
  }
}

export function capturePhoto(video, maxSize = 1280) {
  if (!video?.videoWidth) {
    throw new CameraError('انتظر لحظة حتى تجهز الكاميرا ثم التقط الصورة.', 'NOT_READY');
  }
  const canvas = captureVideoFrame(video, maxSize);
  return canvas.toDataURL('image/jpeg', 0.86);
}
