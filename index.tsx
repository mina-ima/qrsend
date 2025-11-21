import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QrCode, ScanLine, History, ChevronRight, Copy, Check, Sparkles, ArrowLeft, X, Download, FileText, AlertTriangle, ExternalLink, Wifi } from 'lucide-react';
import { AppMode, HistoryItem } from './types';
import Scanner from './components/Scanner';
import Generator from './components/Generator';
import DirectConnection from './components/DirectConnection';
import { analyzeScannedContent, hasApiKey } from './services/geminiService';

const App = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('gemini-qr-history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load history", e);
      return [];
    }
  });
  
  // State for displaying scan results
  const [scannedResult, setScannedResult] = useState<HistoryItem | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiKeyExists, setApiKeyExists] = useState(true);

  useEffect(() => {
    setApiKeyExists(hasApiKey());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('gemini-qr-history', JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history", e);
    }
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
    setIsAnalyzing(true);
    
    const tempItem: HistoryItem = {
      id: 'temp',
      content: data,
      type: 'received',
      timestamp: Date.now()
    };
    setScannedResult(tempItem);

    const analysis = await analyzeScannedContent(data);
    
    const savedItem = addToHistory(data, 'received', analysis);
    setScannedResult(savedItem);
    setIsAnalyzing(false);
  };

  const handleSendSave = (content: string) => {
    addToHistory(content, 'sent');
  };

  // Determine if content is a file (data URL)
  const isDataUrl = (str: string) => str.startsWith('data:');
  // Determine if content is a URL
  const isUrl = (str: string) => /^https?:\/\//i.test(str);

  const renderHome = () => (
    <div className="flex flex-col h-full p-6 justify-center gap-4 animate-fade-in overflow-y-auto">
      <div className="text-center space-y-2 mb-4">
        <h1 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
          Gemini QR リンク
        </h1>
        <p className="text-slate-500 text-xs">QRコードで簡単データ送受信</p>
      </div>

      {!apiKeyExists && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 mb-2 text-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold mb-1">API設定が必要です</p>
            <p>AI機能を利用するには、Vercelの環境変数に <code>API_KEY</code> を設定して再デプロイしてください。</p>
          </div>
        </div>
      )}

      <button 
        onClick={() => setMode(AppMode.P2P)}
        className="group relative flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 overflow-hidden shadow-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="bg-purple-100 p-3 rounded-full mr-4 group-hover:scale-110 transition-transform">
          <Wifi className="w-6 h-6 text-purple-600" />
        </div>
        <div className="text-left">
          <h3 className="text-base font-bold text-slate-800">P2P 直接接続</h3>
          <p className="text-slate-500 text-[10px]">近くの端末へ送信 (同一Wi-Fi)</p>
        </div>
        <ChevronRight className="ml-auto w-5 h-5 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
      </button>

      <button 
        onClick={() => setMode(AppMode.SEND)}
        className="group relative flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden shadow-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="bg-blue-100 p-3 rounded-full mr-4 group-hover:scale-110 transition-transform">
          <QrCode className="w-6 h-6 text-blue-600" />
        </div>
        <div className="text-left">
          <h3 className="text-base font-bold text-slate-800">データを送信</h3>
          <p className="text-slate-500 text-[10px]">遠隔地へ送信 (クラウド経由)</p>
        </div>
        <ChevronRight className="ml-auto w-5 h-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
      </button>

      <button 
        onClick={() => setMode(AppMode.RECEIVE)}
        className="group relative flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 overflow-hidden shadow-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="bg-emerald-100 p-3 rounded-full mr-4 group-hover:scale-110 transition-transform">
          <ScanLine className="w-6 h-6 text-emerald-600" />
        </div>
        <div className="text-left">
          <h3 className="text-base font-bold text-slate-800">データを受信</h3>
          <p className="text-slate-500 text-[10px]">QRスキャン・Gemini解析</p>
        </div>
        <ChevronRight className="ml-auto w-5 h-5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
      </button>

      <button 
        onClick={() => setMode(AppMode.HISTORY)}
        className="mt-2 flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 transition-colors text-sm font-medium py-3"
      >
        <History className="w-4 h-4" />
        履歴を表示
      </button>
    </div>
  );

  const renderResultModal = () => {
    if (!scannedResult) return null;
    const isFile = isDataUrl(scannedResult.content);
    const isLink = isUrl(scannedResult.content);

    return (
      <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-white/90 backdrop-blur-sm p-4 animate-fade-in h-full">
        <div className="w-full h-full sm:h-auto sm:max-h-[90%] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              受信データ
            </h3>
            <button onClick={() => {
              setScannedResult(null);
              setMode(AppMode.HOME);
            }} className="p-1 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6 bg-white flex-1">
            {/* Content Display */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isFile ? '受信ファイル' : isLink ? '受信リンク' : 'スキャン内容'}
              </label>
              
              {isFile ? (
                <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {scannedResult.content.startsWith('data:image') ? (
                    <img src={scannedResult.content} alt="Received" className="w-full rounded border border-slate-200" />
                  ) : (
                     <div className="flex items-center gap-2 text-slate-700">
                       <FileText className="w-8 h-8 text-blue-500" />
                       <span className="text-sm font-mono truncate">Binary Data</span>
                     </div>
                  )}
                  <a 
                    href={scannedResult.content} 
                    download="received_data"
                    className="flex items-center justify-center gap-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-bold transition-colors"
                  >
                    <Download className="w-4 h-4" /> ダウンロード
                  </a>
                </div>
              ) : isLink ? (
                <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                   <div className="font-mono text-sm text-blue-600 break-all">
                      {scannedResult.content}
                   </div>
                   <a 
                    href={scannedResult.content} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-500/20"
                  >
                    <ExternalLink className="w-4 h-4" /> リンクを開く
                  </a>
                   <p className="text-xs text-slate-500 text-center">
                     ※外部サイトへ移動します。ファイルのダウンロードリンクの場合は、リンク先でダウンロードが開始されます。
                   </p>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-sm text-slate-700 break-all">
                  {scannedResult.content}
                </div>
              )}
            </div>

            {/* AI Analysis */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> Gemini分析
              </label>
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-sm text-indigo-800 leading-relaxed relative overflow-hidden">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-indigo-500">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    解析中...
                  </div>
                ) : (
                  scannedResult.aiAnalysis || "分析結果がありません。"
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
            {!isFile && (
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(scannedResult.content);
                }}
                className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl font-medium text-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" /> コピー
              </button>
            )}
            <button 
              onClick={() => {
                setScannedResult(null);
                setMode(AppMode.RECEIVE); 
              }}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium text-white transition-colors shadow-lg shadow-emerald-500/20"
            >
              次をスキャン
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center mb-6 shrink-0">
        <button 
          onClick={() => setMode(AppMode.HOME)}
          className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-slate-800 ml-2">履歴</h2>
        <div className="ml-auto text-xs text-slate-400 font-mono">
          {history.length} 件
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <History className="w-12 h-12 mb-4 opacity-20" />
            <p>履歴はありません</p>
          </div>
        ) : (
          history.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 p-4 rounded-xl hover:border-blue-300 transition-colors shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${
                  item.type === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {item.type === 'sent' ? '送信' : '受信'}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(item.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-slate-800 font-medium line-clamp-2 mb-2 break-all font-mono text-xs">
                {item.content.startsWith('data:') ? '(ファイルデータ)' : item.content}
              </p>
              {item.aiAnalysis && (
                <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100">
                  <Sparkles className="w-3 h-3 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-indigo-600 line-clamp-2">{item.aiAnalysis}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-2 sm:p-4 font-sans overflow-hidden">
      {/* Main App Container - Reduced height from 92dvh to 85dvh/800px max to avoid full screen feeling on mobile */}
      <div className="w-full max-w-md bg-slate-50 h-[85dvh] sm:h-[85vh] sm:max-h-[800px] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-slate-900/5 my-auto">
        
        <div className="flex-1 relative w-full h-full overflow-hidden flex flex-col">
          {mode === AppMode.HOME && renderHome()}
          
          {mode === AppMode.SEND && (
            <Generator 
              onClose={() => setMode(AppMode.HOME)}
              onSave={handleSendSave}
            />
          )}
          
          {mode === AppMode.RECEIVE && (
            <div className="relative h-full w-full flex flex-col">
              <div className="absolute top-4 left-4 z-20">
                <button 
                  onClick={() => setMode(AppMode.HOME)}
                  className="p-3 bg-white/50 backdrop-blur-md rounded-full text-slate-800 hover:bg-white transition-colors shadow-sm"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 relative bg-black">
                <Scanner 
                  isActive={!scannedResult} 
                  onScan={handleScan} 
                />
              </div>
              {renderResultModal()}
            </div>
          )}
          
          {mode === AppMode.P2P && (
            <DirectConnection onClose={() => setMode(AppMode.HOME)} />
          )}

          {mode === AppMode.HISTORY && renderHistory()}
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);