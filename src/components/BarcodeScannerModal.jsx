import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, ScanLine, Volume2 } from 'lucide-react';

export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);
  const readerElementId = 'barcode-scanner-viewport';

  // Sonido de feedback "BEEP" de escaneo de caja registradora usando Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime); // 1.2 kHz beep
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
      if (navigator.vibrate) {
        navigator.vibrate(80);
      }
    } catch {
      // Ignorar si el navegador bloquea audio antes de interacción
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setErrorMsg('');

    const startScanner = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          setErrorMsg('No se detectó ninguna cámara en este dispositivo.');
          return;
        }

        setCameras(devices);
        // Preferir cámara trasera (environment / back)
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('trasera') ||
          d.label.toLowerCase().includes('environment')
        );
        const camId = backCamera ? backCamera.id : devices[0].id;
        setSelectedCameraId(camId);

        const html5QrCode = new Html5Qrcode(readerElementId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          camId,
          {
            fps: 10,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.3333
          },
          (decodedText) => {
            playBeep();
            if (scannerRef.current && scannerRef.current.isScanning) {
              scannerRef.current.stop().catch(() => {}).finally(() => {
                onScanSuccess(decodedText.trim());
                onClose();
              });
            } else {
              onScanSuccess(decodedText.trim());
              onClose();
            }
          },
          () => {
            // Error por fotograma sin código: normal durante el escaneo
          }
        );

        if (isMounted) setIsScanning(true);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error al iniciar cámara:', err);
        setErrorMsg('Permiso de cámara denegado o dispositivo en uso. Verifique los permisos del navegador.');
      }
    };

    // Pequeño retardo para asegurar que el DOM del modal esté montado
    const timer = setTimeout(() => {
      startScanner();
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {}).finally(() => {
            try { scannerRef.current.clear(); } catch {}
          });
        }
      }
    };
  }, [isOpen]);

  const switchCamera = async (newCamId) => {
    setSelectedCameraId(newCamId);
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.start(
          newCamId,
          {
            fps: 10,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.3333
          },
          (decodedText) => {
            playBeep();
            scannerRef.current.stop().catch(() => {}).finally(() => {
              onScanSuccess(decodedText.trim());
              onClose();
            });
          },
          () => {}
        );
      } catch (e) {
        console.error('Error al cambiar cámara:', e);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Camera className="text-blue-300" size={20} />
            <div>
              <h3 className="font-bold text-sm">Escáner de Código de Barras</h3>
              <p className="text-[11px] text-blue-200">Apunta la cámara al código del producto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Viewport del Escáner */}
        <div className="p-4 bg-gray-900 relative flex flex-col items-center justify-center min-h-[300px]">
          {errorMsg ? (
            <div className="text-center p-6 text-red-400 space-y-2">
              <AlertCircle className="mx-auto text-red-500" size={36} />
              <p className="font-bold text-sm text-white">Error de Cámara</p>
              <p className="text-xs text-gray-300">{errorMsg}</p>
            </div>
          ) : (
            <>
              <div 
                id={readerElementId} 
                className="w-full overflow-hidden rounded-2xl border-2 border-blue-500/30"
              />
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] pointer-events-none animate-pulse" />
            </>
          )}
        </div>

        {/* Controles de Cámara y Ayuda */}
        <div className="p-4 bg-gray-50 flex flex-col gap-3 border-t border-gray-100">
          {cameras.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-gray-600 flex items-center gap-1">
                <RefreshCw size={13} className="text-blue-600" /> Cambiar Cámara:
              </label>
              <select
                value={selectedCameraId}
                onChange={(e) => switchCamera(e.target.value)}
                className="border p-1.5 rounded-lg text-xs bg-white text-gray-700 outline-none max-w-[200px] truncate"
              >
                {cameras.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Cámara ${c.id.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
            <span className="flex items-center gap-1">
              <ScanLine size={13} className="text-emerald-600" /> Compatible con EAN-13, CODE-128, QR
            </span>
            <span className="flex items-center gap-1">
              <Volume2 size={13} className="text-purple-600" /> Beep automático
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
