import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sparkles, Copy, Send, RefreshCw, ArrowLeft } from 'lucide-react';
import { generateMessage } from '../services/geminiService';

interface GeneratorProps {
  onClose: () => void;
  onSave: (content: string) => void;
}

const Generator: React.FC<GeneratorProps> = ({ onClose, onSave }) => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);

  const handleGeminiGenerate = async () => {
    if (!input.trim()) return;
    setIsGenerating(true);
    try {
      const enhanced = await generateMessage(input);
      setInput(enhanced);
    } catch (e) {
      console.error(e);
      // Fallback or error notification could go here
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateQR = () => {
    if (!input.trim()) return;
    setGeneratedQR(input);
    onSave(input);
  };

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
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            メッセージ内容
          </label>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setGeneratedQR(null); // Reset QR if text changes
            }}
            placeholder="メッセージ、URL、またはトピックを入力してください..."
            className="w-full bg-slate-900 text-white p-3 rounded-lg border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[100px] resize-none"
          />
          
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleGeminiGenerate}
              disabled={!input.trim() || isGenerating}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-lg text-sm font-medium transition-all"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? '生成中...' : 'AIマジック'}
            </button>
            
            <button
              onClick={handleCreateQR}
              disabled={!input.trim()}
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
                level="M"
                includeMargin={true}
              />
            </div>
            <p className="mt-4 text-slate-500 text-xs text-center max-w-[250px] truncate">
              {generatedQR}
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