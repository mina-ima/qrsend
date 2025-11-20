import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Camera, XCircle, RefreshCw } from 'lucide-react';

interface ScannerProps {
  onScan: (data: string) => void;
  isActive: boolean;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const cleanup = useCallback(() => {
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        // Draw box around code
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#10b981";
        ctx.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        ctx.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
        ctx.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
        ctx.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
        ctx.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        ctx.stroke();
        
        // Stop scanning and return data
        cleanup();
        onScan(code.data);
        return; // Stop the loop
      }
    }

    if (scanning) {
      requestAnimationFrame(scanFrame);
    }
  }, [scanning, onScan, cleanup]);

  const startCamera = async () => {
    cleanup();
    setError(null);
    
    try {
      let stream: MediaStream;
      
      try {
        // Try environment camera first
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
      } catch (envErr) {
        console.warn("Environment camera not found, trying fallback.", envErr);
        // Fallback to any available video source
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // required for iOS
        await videoRef.current.play();
        setScanning(true);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let msg = "カメラの起動に失敗しました。";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "カメラへのアクセスが拒否されました。ブラウザの設定を確認して許可してください。";
      } else if (err.name === 'NotFoundError') {
        msg = "カメラが見つかりませんでした。";
      } else if (err.name === 'NotReadableError') {
        msg = "カメラにアクセスできません。他のアプリが使用している可能性があります。";
      }
      setError(msg);
    }
  };

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [isActive]); // Remove startCamera and cleanup from dependencies to avoid loops, logic handles updates via isActive

  // Trigger the scan loop when scanning state changes to true
  useEffect(() => {
    if (scanning) {
      requestAnimationFrame(scanFrame);
    }
  }, [scanning, scanFrame]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-black relative rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
      {error ? (
        <div className="text-red-400 flex flex-col items-center p-6 text-center max-w-xs">
          <XCircle className="w-12 h-12 mb-4" />
          <p className="mb-6 text-sm font-medium">{error}</p>
          <button 
            onClick={startCamera}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
            カメラを再起動
          </button>
        </div>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
           {/* Use opacity-0 instead of hidden to ensure video is rendered for canvas to read */}
          <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
            playsInline
            muted
          />
          <canvas 
            ref={canvasRef} 
            className="w-full h-full object-cover"
          />
          
          {/* Overlay UI */}
          <div className="absolute inset-0 border-2 border-slate-800/50 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-blue-500 rounded-lg opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <div className="scan-line"></div>
              
              {/* Corner Markers */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 -mt-1 -ml-1"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 -mt-1 -mr-1"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 -mb-1 -ml-1"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 -mb-1 -mr-1"></div>
            </div>
          </div>

          <div className="absolute bottom-8 bg-black/60 px-6 py-3 rounded-full flex items-center gap-3 backdrop-blur-md border border-white/10 shadow-lg">
            <div className="relative">
              <Camera className="w-5 h-5 text-blue-400" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </div>
            <span className="text-sm font-medium text-white tracking-wide">QRコードをスキャン中...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;