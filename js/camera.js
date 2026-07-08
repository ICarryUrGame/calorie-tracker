// ============================================
// CALORIE TRACKER — Camera Module
// WebRTC camera & file upload handling
// ============================================

const Camera = (() => {
  let _stream = null;
  let _videoEl = null;

  async function startCamera(videoElement) {
    _videoEl = videoElement;

    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Rear camera
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      videoElement.srcObject = _stream;
      await videoElement.play();
      return true;
    } catch (error) {
      console.error('Camera error:', error);
      if (error.name === 'NotAllowedError') {
        throw new Error('Brak dostępu do kamery. Zezwól na dostęp w ustawieniach przeglądarki.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('Nie znaleziono kamery. Użyj opcji uploadu zdjęcia.');
      }
      throw new Error('Nie udało się uruchomić kamery: ' + error.message);
    }
  }

  function capturePhoto() {
    if (!_videoEl || !_stream) {
      throw new Error('Kamera nie jest uruchomiona.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = _videoEl.videoWidth;
    canvas.height = _videoEl.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(_videoEl, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function stopCamera() {
    if (_stream) {
      _stream.getTracks().forEach(track => track.stop());
      _stream = null;
    }
    if (_videoEl) {
      _videoEl.srcObject = null;
      _videoEl = null;
    }
  }

  function processFileUpload(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('Nie wybrano pliku.'));
        return;
      }

      if (!file.type.startsWith('image/')) {
        reject(new Error('Wybrany plik nie jest zdjęciem.'));
        return;
      }

      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('Zdjęcie jest zbyt duże (max 10MB).'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        // Resize if needed for API limits
        _resizeImage(e.target.result, 1280).then(resolve).catch(reject);
      };

      reader.onerror = () => {
        reject(new Error('Nie udało się wczytać zdjęcia.'));
      };

      reader.readAsDataURL(file);
    });
  }

  function _resizeImage(dataUrl, maxDimension) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width <= maxDimension && height <= maxDimension) {
          resolve(dataUrl);
          return;
        }

        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = dataUrl;
    });
  }

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // --- Public API ---
  return {
    startCamera,
    capturePhoto,
    stopCamera,
    processFileUpload,
    isSupported,
  };
})();
