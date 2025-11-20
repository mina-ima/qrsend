import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sparkles, Send, RefreshCw, ArrowLeft, Paperclip, FileWarning, FileCheck } from 'lucide-react';
import { generateMessage } from '../services/geminiService';

interface GeneratorProps {
  onClose: () => void;
  onSave: (content: string) => void;
}

const MAX_QR_LENGTH = 2000; // Safe limit for QR codes

const Generator: React.FC<GeneratorProps> = ({ onClose, onSave }) => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGeminiGenerate = async () => {
    if (!input.trim()) return;
    setIsGenerating(true);
    try {
      const enhanced = await generateMessage(input);
      setInput(enhanced);
      setFileError(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateQR = () => {
    if (!input.trim()) return;
    
    if (input.length > MAX_QR_LENGTH) {
      setFileError(`データサイズが大きすぎます (${input.length}文字)。QRコードの上限は約2000文字です。`);
      return;
    }

    setGeneratedQR(input);
    onSave(input);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset states
    setGeneratedQR(null);
    setFileError(null);

    if (file.size > 3000) { // Rough check before base64 (approx 2KB limit for QR safely)
      setFileError("ファイルサイズが大きすぎます。QRコードには非常に小さなファイル（1-2KB程度）のみ適しています。");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result.length > MAX_QR_LENGTH) {
        setFileError(`変換後のデータが大きすぎます (${result.length}文字)。より小さなファイルを選択してください。`);
      } else {
        setInput(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const isDataUrl = input.startsWith('data:');

  return (
    <div className="flex flex-col h-full max-w-md mx-auto p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-blue-400 ml-2">データを送信</h2>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
        
        {/* Input Section */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              メッセージ / データ
            </label>
            <span className={`text-[10px] font-mono ${input.length > MAX_QR_LENGTH ? 'text-red-400' : 'text-slate-500'}`}>
              {input.length} / {MAX_QR_LENGTH}
            </span>
          </div>
          
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setGeneratedQR(null);
              setFileError(null);
            }}
            placeholder="メッセージ入力、またはファイルを添付..."
            className="w-full bg-slate-900 text-white p-3 rounded-lg border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[100px] resize-none font-mono text-sm"
          />

          {fileError && (
            <div className="mt-2 flex items-start gap-2 text-red-400 text-xs bg-red-900/20 p-2 rounded">
              <FileWarning className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{fileError}</span>
            </div>
          )}

          {isDataUrl && !fileError && (
            <div className="mt-2 flex items-center gap-2 text-emerald-400 text-xs bg-emerald-900/20 p-2 rounded">
              <FileCheck className="w-4 h-4 shrink-0" />
              <span>ファイルデータがセットされました</span>
            </div>
          )}
          
          <div className="flex gap-2 mt-3">
             <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
              title="ファイルを添付"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              onClick={handleGeminiGenerate}
              disabled={!input.trim() || isGenerating || isDataUrl}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-lg text-sm font-medium transition-all"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? '生成中...' : 'AI作成'}
            </button>
            
            <button
              onClick={handleCreateQR}
              disabled={!input.trim() || (input.length > MAX_QR_LENGTH)}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg text-sm font-medium transition-all"
            >
              <Send className="w-4 h-4" />
              QR作成
            </button>
          </div>
        </div>

        {/* QR Display */}
        {generatedQR && (
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-lg animate-scale-up">
            <div className="p-2 border-2 border-slate-100 rounded-lg">
              <QRCodeSVG
                value={generatedQR}
                size={200}
                level="L" 
                includeMargin={true}
              />
            </div>
            <p className="mt-4 text-slate-500 text-xs text-center max-w-[250px] truncate font-mono">
              {generatedQR.substring(0, 50)}...
            </p>
            <p className="text-slate-400 text-[10px] mt-1 font-medium uppercase tracking-widest">
              別のデバイスでスキャンしてください
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;