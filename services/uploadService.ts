
/**
 * Service to handle temporary file uploads.
 * Uses file.io for ephemeral storage (files are deleted after download or expiration).
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const uploadFile = async (file: File): Promise<string> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`ファイルサイズが大きすぎます (上限 50MB)。現在のサイズ: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
  }

  const formData = new FormData();
  formData.append('file', file);
  
  // Set expiration to 1 day for convenience, though file.io auto-deletes after 1 download by default on free tier
  try {
    const response = await fetch('https://file.io/?expires=1d', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`アップロードに失敗しました。Status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error('アップロード処理が完了しませんでした。');
    }

    return data.link;
  } catch (error) {
    console.error("Upload error:", error);
    throw new Error("ファイルのアップロード中にエラーが発生しました。ネットワーク接続を確認してください。");
  }
};
