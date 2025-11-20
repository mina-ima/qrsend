import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates creative content to send via QR code.
 */
export const generateMessage = async (prompt: string): Promise<string> => {
  try {
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
    throw new Error("Geminiへの接続に失敗しました。");
  }
};

/**
 * Analyzes scanned content using Gemini.
 */
export const analyzeScannedContent = async (content: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `以下のQRコードからスキャンされたテキストを分析してください: "${content}"。
      非常に短く、役立つ要約やコンテキストを日本語で提供してください。
      URLの場合は、どのようなサイトか説明してください。
      コードの場合は、どの言語か説明してください。
      ランダムなテキストの場合は、翻訳または要約してください。
      50文字以内で回答してください。`,
    });
    return response.text || "分析結果がありません。";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI分析を利用できません。";
  }
};