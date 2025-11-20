import { GoogleGenAI } from "@google/genai";

// Safely retrieve API key supporting multiple environment variable patterns
const getApiKey = () => {
  // 1. Try Vite standard (import.meta.env)
  try {
    // @ts-ignore - import.meta might not be typed in all setups but is standard for Vite
    if (typeof import.meta !== 'undefined' && import.meta.env) {
       // @ts-ignore
       if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
       // @ts-ignore
       if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
    }
  } catch (e) {
    // Ignore errors accessing import.meta
  }

  // 2. Try process.env (Webpack/Node/Next.js/CRA)
  try {
    if (typeof process !== 'undefined' && process.env) {
      // Support VITE_ prefix in process.env
      if (process.env.VITE_API_KEY) return process.env.VITE_API_KEY;
      // Support standard API_KEY
      if (process.env.API_KEY) return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore errors accessing process
  }

  return "";
};

export const hasApiKey = (): boolean => {
  return !!getApiKey();
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

/**
 * Generates creative content to send via QR code.
 */
export const generateMessage = async (prompt: string): Promise<string> => {
  try {
    if (!hasApiKey()) {
       throw new Error("APIキーが設定されていません。");
    }
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `この入力に基づき、短く創造的で簡潔なメッセージを生成してください: "${prompt}"。
      出力はプレーンテキストで、QRコードに適した長さ（できれば300文字以内）にしてください。
      入力がトピックの場合は、豆知識や俳句を書いてください。
      入力が下書きの場合は、日本語で推敲してください。`,
    });
    return response.text || "メッセージを生成できませんでした。";
  } catch (error) {
    console.error("Gemini Generate Error:", error);
    throw new Error("Geminiへの接続に失敗しました。APIキーが設定されているか確認してください。");
  }
};

/**
 * Analyzes scanned content using Gemini.
 * Supports both text and base64 images.
 */
export const analyzeScannedContent = async (content: string): Promise<string> => {
  try {
    if (!hasApiKey()) {
       return "APIキー未設定のため、分析機能は利用できません。";
    }

    // Check if content is a data URL (image)
    if (content.startsWith('data:image')) {
      const [mimeMetadata, base64Data] = content.split(',');
      const mimeType = mimeMetadata.match(/:(.*?);/)?.[1] || 'image/png';
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            {
              text: "この画像は何ですか？日本語で50文字以内で簡潔に説明してください。"
            }
          ]
        }
      });
      return response.text || "画像の解析結果がありません。";
    }

    // Text content analysis
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `以下のQRコードからスキャンされたテキストを分析してください: "${content}"。
      非常に短く、役立つ要約やコンテキストを日本語で提供してください。
      URLの場合は、どのようなサイトか説明してください。
      コードの場合は、どの言語か説明してください。
      ランダムなテキストの場合は、翻訳または要約してください。
      ファイルデータ（Base64など）のように見える場合は、ファイル形式を推測してください。
      50文字以内で回答してください。`,
    });
    return response.text || "分析結果がありません。";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI分析を利用できません。";
  }
};