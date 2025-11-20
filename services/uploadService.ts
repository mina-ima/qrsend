
/**
 * Service to handle temporary file uploads.
 * Implements a fallback strategy:
 * 1. file.io (Primary): Auto-deletes after download, good privacy.
 * 2. transfer.sh (Fallback): Reliable, keeps files for 14 days.
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

type StatusCallback = (status: string) => void;

const uploadToFileIo = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  
  // file.io: Free tier, auto delete after 1 download or 1 day
  const response = await fetch('https://file.io/?expires=1d', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`File.io Error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error('File.io reported failure');
  }

  return data.link;
};

const uploadToTransferSh = async (file: File): Promise<string> => {
  // transfer.sh: Reliable, PUT method
  const filename = encodeURIComponent(file.name);
  const response = await fetch(`https://transfer.sh/${filename}`, {
    method: 'PUT',
    body: file
  });

  if (!response.ok) {
    throw new Error(`Transfer.sh Error: ${response.status}`);
  }

  const text = await response.text();
  return text.trim();
};

export const uploadFile = async (file: File, onStatusUpdate?: StatusCallback): Promise<string> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`ファイルサイズが大きすぎます (上限 50MB)。現在のサイズ: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
  }

  // 1. Try Primary Service (file.io)
  try {
    if (onStatusUpdate) onStatusUpdate("メインサーバーへアップロード中...");
    return await uploadToFileIo(file);
  } catch (error) {
    console.warn("Primary upload failed, switching to fallback...", error);
    
    // 2. Try Fallback Service (transfer.sh)
    try {
      if (onStatusUpdate) onStatusUpdate("予備サーバーへ再試行中...");
      return await uploadToTransferSh(file);
    } catch (fallbackError) {
      console.error("Fallback upload failed:", fallbackError);
      throw new Error("アップロードに失敗しました。ネットワーク環境を確認するか、別のファイルをお試しください。");
    }
  }
};
