import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Camera, XCircle, Zap } from 'lucide-react';

interface ScannerProps {
  onScan: (data: string) => void;
  isActive: boolean;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

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
        setScanning(false);
        onScan(code.data);
        return; // Stop the loop
      }
    }

    if (scanning) {
      requestAnimationFrame(scanFrame);
    }
  }, [scanning, onScan]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (!isActive) return;
      
      try {
        setError(null);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true"); // required to tell iOS safari we don't want fullscreen
          await videoRef.current.play();
          setScanning(true);
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setError("カメラにアクセスできません。権限が付与されているか確認してください。");
      }
    };

    if (isActive) {
      startCamera();
    } else {
      setScanning(false);
    }

    return () => {
      setScanning(false);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

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
        <div className="text-red-400 flex flex-col items-center p-6 text-center">
          <XCircle className="w-12 h-12 mb-4" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center">
           {/* Hidden video element, we draw to canvas */}
          <video 
            ref={videoRef} 
            className="hidden"
          />
          <canvas 
            ref={canvasRef} 
            className="w-full h-full object-cover"
          />
          
          {/* Overlay UI */}
          <div className="absolute inset-0 border-2 border-slate-800/50 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-blue-500 rounded-lg opacity-50">
              <div className="scan-line"></div>
            </div>
          </div>

          <div className="absolute bottom-6 bg-slate-900/80 px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-sm border border-slate-700">
            <Camera className="w-4 h-4 text-blue-400 animate-pulse" />
            <span className="text-sm font-medium text-slate-200">QRコードをスキャン中...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;