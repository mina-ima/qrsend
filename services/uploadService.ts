
/**
 * Service to handle temporary file uploads.
 * Implements a fallback strategy:
 * 1. file.io (Primary): Auto-deletes after download, good privacy.
 * 2. tmpfiles.org (Fallback): Keeps files for 60 mins, good CORS support.
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

const uploadToTmpFiles = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  
  // tmpfiles.org API
  const response = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`TmpFiles Error: ${response.status}`);
  }

  const json = await response.json();
  if (json.status !== 'success') {
    throw new Error('TmpFiles reported failure');
  }

  let url = json.data.url;
  // Convert to direct download link for better UX
  // Default: https://tmpfiles.org/12345/file.jpg
  // Direct: https://tmpfiles.org/dl/12345/file.jpg
  if (url && url.includes('tmpfiles.org/')) {
      url = url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  }
  
  return url;
};

export const uploadFile = async (file: File, onStatusUpdate?: StatusCallback): Promise<string> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`ファイルサイズが大きすぎます (上限 50MB)。現在のサイズ: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
  }

  const errors: string[] = [];

  // 1. Try Primary Service (file.io)
  try {
    if (onStatusUpdate) onStatusUpdate("サーバー1 (file.io) へアップロード中...");
    return await uploadToFileIo(file);
  } catch (error: any) {
    console.warn("Primary upload (file.io) failed, switching to fallback...", error);
    errors.push(`file.io: ${error.message}`);
  }

  // 2. Try Fallback Service (tmpfiles.org)
  try {
    if (onStatusUpdate) onStatusUpdate("予備サーバー (tmpfiles.org) へ再試行中...");
    return await uploadToTmpFiles(file);
  } catch (fallbackError: any) {
    console.error("Fallback upload (tmpfiles.org) failed:", fallbackError);
    errors.push(`tmpfiles.org: ${fallbackError.message}`);
  }

  throw new Error(`アップロードに失敗しました。\nネットワーク環境を確認するか、別のファイルをお試しください。\n(詳細: ${errors.join(', ')})`);
};
