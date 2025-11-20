import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QrCode, ScanLine, History, ChevronRight, Copy, Check, Sparkles, ArrowLeft, X } from 'lucide-react';
import { AppMode, HistoryItem } from './types';
import Scanner from './components/Scanner';
import Generator from './components/Generator';
import { analyzeScannedContent } from './services/geminiService';

const App = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('gemini-qr-history');
    return saved ? JSON.parse(saved) : [];
  });
  
  // State for displaying scan results
  const [scannedResult, setScannedResult] = useState<HistoryItem | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    localStorage.setItem('gemini-qr-history', JSON.stringify(history));
  }, [history]);

  const addToHistory = (content: string, type: 'sent' | 'received', analysis?: string) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      content,
      type,
      timestamp: Date.now(),
      aiAnalysis: analysis
    };
    setHistory(prev => [newItem, ...prev]);
    return newItem;
  };

  const handleScan = async (data: string) => {
    // Pause scanning UI logic is handled by mounting/unmounting or overlay
    setIsAnalyzing(true);
    
    // Create temporary item for immediate feedback
    const tempItem: HistoryItem = {
      id: 'temp',
      content: data,
      type: 'received',
      timestamp: Date.now()
    };
    setScannedResult(tempItem);

    // Analyze with Gemini
    const analysis = await analyzeScannedContent(data);
    
    // Save officially
    const savedItem = addToHistory(data, 'received', analysis);
    
    setScannedResult(savedItem);
    setIsAnalyzing(false);
  };

  const handleSendSave = (content: string) => {
    addToHistory(content, 'sent');
  };

  // -- Render Methods --

  const renderHome = () => (
    <div className="flex flex-col h-full p-6 max-w-md mx-auto justify-center gap-6 animate-fade-in">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Gemini QR リンク
        </h1>
        <p className="text-slate-400 text-sm">QRコードで簡単データ送受信</p>
      </div>

      <button 
        onClick={() => setMode(AppMode.SEND)}
        className="group relative flex items-center p-6 bg-slate-800 border border-slate-700 rounded-2xl hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="bg-blue-500/20 p-4 rounded-full mr-5 group-hover:scale-110 transition-transform">
          <QrCode className="w-8 h-8 text-blue-400" />
        </div>
        <div className="text-left">
          <h3 className="text-lg font-bold text-white">データを送信</h3>
          <p className="text-slate-400 text-xs">AIでメッセージ作成・QR生成</p>
        </div>
        <ChevronRight className="ml-auto w-5 h-5 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
      </button>

      <button 
        onClick={() => setMode(AppMode.RECEIVE)}
        className="group relative flex items-center p-6 bg-slate-800 border border-slate-700 rounded-2xl hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="bg-emerald-500/20 p-4 rounded-full mr-5 group-hover:scale-110 transition-transform">
          <ScanLine className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="text-left">
          <h3 className="text-lg font-bold text-white">データを受信</h3>
          <p className="text-slate-400 text-xs">QRスキャン・Gemini解析</p>
        </div>
        <ChevronRight className="ml-auto w-5 h-5 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
      </button>

      <button 
        onClick={() => setMode(AppMode.HISTORY)}
        className="mt-4 flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm font-medium py-3"
      >
        <History className="w-4 h-4" />
        履歴を表示
      </button>
    </div>
  );

  const renderResultModal = () => {
    if (!scannedResult) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              受信データ
            </h3>
            <button onClick={() => {
              setScannedResult(null);
              setMode(AppMode.HOME);
            }} className="p-1 hover:bg-slate-800 rounded-full">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6">
            {/* Raw Content */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">スキャン内容</label>
              <div className="bg-black/40 p-4 rounded-lg border border-slate-800 font-mono text-sm text-slate-200 break-all">
                {scannedResult.content}
              </div>
            </div>

            {/* AI Analysis */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> Gemini分析
              </label>
              <div className="bg-indigo-900/20 p-4 rounded-lg border border-indigo-500/30 text-sm text-indigo-200 leading-relaxed relative overflow-hidden">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-indigo-400">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    解析中...
                  </div>
                ) : (
                  scannedResult.aiAnalysis || "分析結果がありません。"
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 border-t border-slate-800 flex gap-3">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(scannedResult.content);
              }}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> コピー
            </button>
            <button 
              onClick={() => {
                setScannedResult(null);
                setMode(AppMode.RECEIVE); // Scan another
              }}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium text-white transition-colors"
            >
              次をスキャン
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="flex flex-col h-full max-w-md mx-auto p-4">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => setMode(AppMode.HOME)}
          className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-white ml-2">履歴</h2>
        <div className="ml-auto text-xs text-slate-500 font-mono">
          {history.length} 件
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <History className="w-12 h-12 mb-4 opacity-20" />
            <p>履歴はありません</p>
          </div>
        ) : (
          history.map(item => (
            <div key={item.id} className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${
                  item.type === 'sent' ? 'bg-blue-900/30 text-blue-400' : 'bg-emerald-900/30 text-emerald-400'
                }`}>
                  {item.type === 'sent' ? '送信' : '受信'}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(item.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-white font-medium line-clamp-2 mb-2 break-all">
                {item.content}
              </p>
              {item.aiAnalysis && (
                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-700/50">
                  <Sparkles className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-indigo-200 line-clamp-2">{item.aiAnalysis}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans selection:bg-blue-500/30">
      {mode === AppMode.HOME && renderHome()}
      
      {mode === AppMode.SEND && (
        <Generator 
          onClose={() => setMode(AppMode.HOME)}
          onSave={handleSendSave}
        />
      )}
      
      {mode === AppMode.RECEIVE && (
        <div className="relative h-full w-full">
          <button 
            onClick={() => setMode(AppMode.HOME)}
            className="absolute top-4 left-4 z-20 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {/* We stop the scanner if we are displaying a result to save resources */}
          <Scanner 
            isActive={!scannedResult} 
            onScan={handleScan} 
          />
          {renderResultModal()}
        </div>
      )}
      
      {mode === AppMode.HISTORY && renderHistory()}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);