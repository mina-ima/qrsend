import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sparkles, Send, RefreshCw, ArrowLeft, Paperclip, FileWarning, FileCheck, UploadCloud, Link as LinkIcon } from 'lucide-react';
import { generateMessage } from '../services/geminiService';
import { uploadFile } from '../services/uploadService';

interface GeneratorProps {
  onClose: () => void;
  onSave: (content: string) => void;
}

const MAX_QR_LENGTH = 2000; // Safe limit for QR codes

const Generator: React.FC<GeneratorProps> = ({ onClose, onSave }) => {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGeminiGenerate = async () => {
    if (!input.trim()) return;
    setIsGenerating(true);
    try {
      const enhanced = await generateMessage(input);
      setInput(enhanced);
      setFileError(null);
      setUploadStatus(null);
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
    setUploadStatus(null);
    setInput('');

    // Check size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setFileError("ファイルサイズが50MBを超えています。より小さなファイルを選択してください。");
      return;
    }

    setIsUploading(true);
    setUploadStatus(`${file.name} を準備中...`);

    try {
      // Upload with callback for status updates
      const link = await uploadFile(file, (status) => {
        setUploadStatus(status);
      });
      
      setInput(link);
      setUploadStatus("アップロード完了！リンクを発行しました。");
      setGeneratedQR(link);
      onSave(link); // Automatically save to history
    } catch (err: any) {
      console.error(err);
      setFileError(err.message || "アップロードに失敗しました。");
      setUploadStatus(null);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isDataUrl = input.startsWith('data:');
  const isUrl = input.startsWith('http://') || input.startsWith('https://');

  return (
    <div className="flex flex-col h-full p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-blue-600 ml-2">データを送信</h2>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
        
        {/* Input Section */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              メッセージ / ファイル (Max 50MB)
            </label>
            <span className={`text-[10px] font-mono ${input.length > MAX_QR_LENGTH ? 'text-red-500' : 'text-slate-400'}`}>
              {input.length} / {MAX_QR_LENGTH}
            </span>
          </div>
          
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setGeneratedQR(null);
              setFileError(null);
              setUploadStatus(null);
            }}
            placeholder="メッセージを入力、またはクリップアイコンからファイルをアップロード..."
            className="w-full bg-slate-50 text-slate-900 p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all min-h-[100px] resize-none font-mono text-sm"
            readOnly={isUploading}
          />

          {fileError && (
            <div className="mt-2 flex items-start gap-2 text-red-600 text-xs bg-red-50 p-2 rounded animate-fade-in border border-red-100">
              <FileWarning className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{fileError}</span>
            </div>
          )}

          {uploadStatus && (
            <div className={`mt-2 flex items-center gap-2 text-xs p-2 rounded animate-fade-in border ${isUploading ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
              <span>{uploadStatus}</span>
            </div>
          )}

          {isUrl && !isUploading && (
             <div className="mt-2 flex items-center gap-2 text-indigo-600 text-xs bg-indigo-50 p-2 rounded border border-indigo-100">
              <LinkIcon className="w-4 h-4 shrink-0" />
              <span>ファイルリンクが生成されました</span>
            </div>
          )}
          
          <div className="flex gap-2 mt-3">
             <input 
              type="file" 
              accept="*/*"
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-slate-600 transition-colors relative group border border-slate-200"
              title="ファイルを添付 (最大50MB)"
            >
              <Paperclip className="w-4 h-4" />
              {isUploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
                   <UploadCloud className="w-4 h-4 animate-pulse text-blue-500" />
                </span>
              )}
            </button>

            <button
              onClick={handleGeminiGenerate}
              disabled={!input.trim() || isGenerating || isDataUrl || isUploading || isUrl}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-lg text-sm font-medium text-white transition-all shadow-sm"
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
              disabled={!input.trim() || (input.length > MAX_QR_LENGTH) || isUploading}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg text-sm font-medium text-white transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
              QR表示
            </button>
          </div>
        </div>

        {/* QR Display */}
        {generatedQR && (
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-lg animate-scale-up border border-slate-200">
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
              {isUrl ? 'リンクをスキャンしてダウンロード' : '別のデバイスでスキャンしてください'}
            </p>
            {isUrl && (
              <p className="text-amber-600 text-[10px] mt-1 font-bold">
                ※ファイルは一度ダウンロードすると削除されます
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;