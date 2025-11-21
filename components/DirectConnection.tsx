import React, { useState, useEffect, useRef } from 'react';
import { Peer, DataConnection } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Wifi, Send, Paperclip, Download, Check, Loader2, Smartphone, ScanLine, File as FileIcon, RefreshCw, XCircle, AlertTriangle, Globe, CloudUpload } from 'lucide-react';
import Scanner from './Scanner';

interface DirectConnectionProps {
  onClose: () => void;
}

type P2PMode = 'select' | 'host' | 'initializing_client' | 'scan' | 'connecting' | 'connected';

interface Message {
  id: string;
  sender: 'me' | 'peer';
  type: 'text' | 'file';
  content?: string;
  fileData?: {
    name: string;
    size: number;
    type: string;
    blobUrl: string;
  };
  timestamp: number;
}

const DirectConnection: React.FC<DirectConnectionProps> = ({ onClose }) => {
  const [mode, setMode] = useState<P2PMode>('select');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('初期化中...');
  const [error, setError] = useState<string | null>(null);
  
  const peerRef = useRef<Peer | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectionTimeoutRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) {
        window.clearTimeout(connectionTimeoutRef.current);
      }
      if (connection) connection.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Transition from initializing_client to scan once peerId is ready
  useEffect(() => {
    if (mode === 'initializing_client' && peerId) {
      setMode('scan');
    }
  }, [mode, peerId]);

  const initializePeer = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
    }

    const peer = new Peer({
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ]
      }
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My Peer ID is: ' + id);
      setPeerId(id);
      if (mode === 'host') {
        setStatus('接続待機中...');
      }
    });

    peer.on('connection', (conn) => {
      setStatus('接続要求を受信中...');
      
      conn.on('open', () => {
        handleConnection(conn);
      });

      conn.on('error', (err) => {
        console.error("Connection error on host:", err);
        setError('接続エラーが発生しました。もう一度試してください。');
        setStatus('エラー');
      });
      
      conn.on('close', () => {
         if (mode !== 'connected') {
             setStatus('接続待機中...'); 
         }
      });
    });

    peer.on('error', (err) => {
      console.error("Peer error:", err);
      let errorMsg = `エラー: ${err.type}`;
      if (err.type === 'peer-unavailable') {
        errorMsg = '相手が見つかりませんでした。IDを確認してください。';
      } else if (err.type === 'disconnected') {
        errorMsg = 'サーバーとの接続が切れました。';
      } else if (err.type === 'network') {
        errorMsg = 'ネットワークエラーが発生しました。Wi-Fi環境を確認してください。';
      } else if (err.type === 'browser-incompatible') {
        errorMsg = 'お使いのブラウザは対応していない可能性があります。';
      } else if (err.type === 'server-error') {
        errorMsg = '接続サーバー(PeerJS)に到達できません。';
      }
      setError(errorMsg);
    });
  };

  const handleConnection = (conn: DataConnection) => {
    if (connectionTimeoutRef.current) {
      window.clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    setConnection(conn);
    setMode('connected');
    setStatus('接続確立！');
    setError(null);

    conn.on('data', (data: any) => {
      if (data.type === 'text') {
        addMessage('peer', 'text', data.content);
      } else if (data.type === 'file') {
        const blob = new Blob([data.file], { type: data.fileType });
        const url = URL.createObjectURL(blob);
        addMessage('peer', 'file', undefined, {
          name: data.fileName,
          size: data.fileSize,
          type: data.fileType,
          blobUrl: url
        });
      }
    });

    conn.on('close', () => {
      setStatus('相手との接続が切れました');
      setConnection(null);
      setMode('select');
      alert('相手との接続が切断されました');
    });

    conn.on('error', (err) => {
      console.error("Data connection error:", err);
      setStatus('通信エラーが発生しました');
    });
  };

  const startHosting = () => {
    setMode('host');
    setStatus('ID取得中...');
    setError(null);
    initializePeer();
  };

  const startScanning = () => {
    setMode('initializing_client'); 
    setError(null);
    initializePeer(); 
  };

  const handleScan = (scannedId: string) => {
    if (!peerRef.current || !peerId || !scannedId) return;
    
    setMode('connecting');
    setStatus('接続を確立しています...');

    const conn = peerRef.current.connect(scannedId, {
        reliable: true 
    });
    
    connectionTimeoutRef.current = window.setTimeout(() => {
      if (mode !== 'connected') {
        setError('接続がタイムアウトしました。');
        setStatus('タイムアウト');
        conn.close();
      }
    }, 10000); 
    
    conn.on('open', () => {
      handleConnection(conn);
    });
    
    conn.on('error', (err) => {
        console.error("Connection Error during connect:", err);
        setError("接続に失敗しました。ネットワーク環境を確認してください。");
        setMode('select');
    });
  };

  const addMessage = (
    sender: 'me' | 'peer', 
    type: 'text' | 'file', 
    content?: string,
    fileData?: Message['fileData']
  ) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      sender,
      type,
      content,
      fileData,
      timestamp: Date.now()
    }]);
  };

  const sendMessage = () => {
    if (!inputText.trim() || !connection) return;
    
    connection.send({
      type: 'text',
      content: inputText
    });
    
    addMessage('me', 'text', inputText);
    setInputText('');
  };

  const sendFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !connection) return;

    connection.send({
      type: 'file',
      file: file,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    });

    const url = URL.createObjectURL(file);
    addMessage('me', 'file', undefined, {
      name: file.name,
      size: file.size,
      type: file.type,
      blobUrl: url
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetConnection = () => {
    if (peerRef.current) peerRef.current.destroy();
    setMode('select');
    setPeerId(null);
    setConnection(null);
    setError(null);
  };

  // --- UI Renders ---

  if (mode === 'select') {
    return (
      <div className="flex flex-col h-full p-6 justify-center animate-fade-in overflow-y-auto">
        <div className="flex items-center mb-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-purple-600 ml-2">P2P 直接接続</h2>
        </div>

        <div className="flex flex-col gap-3">
           {error && (
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-sm text-red-600 mb-2 flex items-start gap-2">
               <XCircle className="w-5 h-5 shrink-0" />
               <p>{error}</p>
            </div>
          )}

          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-sm text-amber-800 mb-2">
            <p className="font-bold mb-1 flex items-center gap-2 text-xs">
              <AlertTriangle className="w-3 h-3" /> 注意: 同一Wi-Fiのみ
            </p>
            <p className="text-[11px] leading-relaxed">
              直接接続は、お互いが同じWi-Fiネットワークにいる必要があります。
            </p>
            
            {/* Remote Transfer Recommendation */}
            <div className="mt-3 pt-2 border-t border-amber-200/50">
              <p className="font-bold text-xs flex items-center gap-1 text-blue-700 mb-1">
                <Globe className="w-3 h-3" /> 遠隔地（異なるWi-Fi）の場合
              </p>
              <p className="text-[11px] mb-2">
                接続できない場合は、ホーム画面の「データを送信」をご利用ください。
              </p>
              <button 
                onClick={onClose} // Going back to Home lets them choose Send Data
                className="w-full py-2 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
              >
                <CloudUpload className="w-3 h-3" />
                ホームに戻って「データを送信」を選択
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button 
                onClick={startHosting}
                className="group relative flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-purple-400 transition-all shadow-sm"
            >
                <div className="bg-purple-100 p-3 rounded-full mr-4">
                <Smartphone className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-left">
                <h3 className="text-base font-bold text-slate-800">待機 (ホスト)</h3>
                <p className="text-slate-500 text-[10px]">自分のQRを表示</p>
                </div>
            </button>

            <button 
                onClick={startScanning}
                className="group relative flex items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-purple-400 transition-all shadow-sm"
            >
                <div className="bg-purple-100 p-3 rounded-full mr-4">
                <ScanLine className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-left">
                <h3 className="text-base font-bold text-slate-800">参加 (ゲスト)</h3>
                <p className="text-slate-500 text-[10px]">相手のQRをスキャン</p>
                </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'initializing_client') {
     return (
        <div className="flex flex-col h-full items-center justify-center p-6 bg-slate-50 animate-fade-in">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">準備中...</h3>
            <p className="text-slate-500 text-center text-xs mb-8">
                P2PネットワークID取得中
            </p>
            <button onClick={resetConnection} className="text-slate-400 text-xs hover:text-slate-600 underline">
                キャンセル
            </button>
        </div>
     )
  }

  if (mode === 'host') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 animate-fade-in">
        <button onClick={resetConnection} className="absolute top-4 left-4 p-2 hover:bg-slate-200 rounded-full text-slate-500">
            <ArrowLeft className="w-6 h-6" />
        </button>
        
        {/* Reduced size of QR container and QR code itself */}
        <div className="bg-white p-4 rounded-xl shadow-lg mb-6 animate-scale-up border border-slate-100 relative">
          {peerId ? (
            <>
              <QRCodeSVG value={peerId} size={160} level="L" includeMargin />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {status === '接続要求を受信中...' && (
                      <div className="bg-white/90 p-4 rounded-full shadow-lg backdrop-blur-sm">
                         <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                      </div>
                  )}
              </div>
            </>
          ) : (
            <div className="w-[160px] h-[160px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-2">
            {status === '接続要求を受信中...' ? '接続処理中...' : '接続待機中...'}
        </h3>
        <p className="text-slate-500 text-center text-xs max-w-[200px] leading-relaxed">
          相手の「参加」でこのQRをスキャン
        </p>
        <p className="mt-4 text-[10px] text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
            同じWi-Fiに接続必須
        </p>
        
        {status !== '初期化中...' && (
             <button 
                onClick={() => {
                    initializePeer(); 
                }}
                className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs transition-colors"
             >
                <RefreshCw className="w-3 h-3" /> ID再生成
             </button>
        )}
      </div>
    );
  }

  if (mode === 'scan') {
    return (
      <div className="relative h-full w-full flex flex-col">
        <div className="absolute top-4 left-4 z-20">
           <button onClick={resetConnection} className="p-3 bg-white/50 rounded-full text-slate-800 backdrop-blur-md">
                <ArrowLeft className="w-5 h-5" />
            </button>
        </div>
        <div className="flex-1 bg-black">
           <Scanner 
             isActive={true} 
             onScan={handleScan} 
           />
        </div>
        <div className="absolute bottom-8 left-0 w-full text-center pointer-events-none">
            <span className="bg-black/60 text-white px-4 py-2 rounded-full text-xs backdrop-blur-md shadow-lg">
                QRコードをスキャン
            </span>
        </div>
      </div>
    );
  }

  if (mode === 'connecting') {
      return (
        <div className="flex flex-col h-full items-center justify-center p-6 bg-slate-50 animate-fade-in">
             <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-6" />
             <h3 className="text-lg font-bold text-slate-800 mb-2">接続中...</h3>
             <p className="text-slate-500 text-center text-xs mb-4">
                 通信経路を確立しています
             </p>

             {error && (
                 <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-xs text-red-600 mb-4 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <p>{error}<br/>同一Wi-Fiか確認してください。</p>
                 </div>
             )}

             <button 
                onClick={resetConnection}
                className="px-6 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-xs"
             >
                キャンセル
             </button>
        </div>
      )
  }

  // Chat / Connected Mode
  return (
    <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <button onClick={() => {
            if (confirm("接続を切断して戻りますか？")) {
                onClose();
            }
        }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            接続中
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">P2P Direct Link</span>
        </div>
        <div className="w-9"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 min-h-0 w-full">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                <Wifi className="w-12 h-12 mb-2" />
                <p className="text-xs text-center">接続されました。<br/>メッセージやファイルを送信できます。</p>
            </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
              msg.sender === 'me' 
                ? 'bg-purple-600 text-white rounded-tr-none' 
                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
            }`}>
              {msg.type === 'text' ? (
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              ) : (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono opacity-90">
                        <FileIcon className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{msg.fileData?.name}</span>
                    </div>
                    <div className="text-[10px] opacity-70">{formatSize(msg.fileData?.size || 0)}</div>
                    
                    {msg.fileData?.type.startsWith('image/') && (
                        <img src={msg.fileData.blobUrl} alt="preview" className="rounded-lg max-h-40 object-cover border border-black/10" />
                    )}
                    
                    <a 
                        href={msg.fileData?.blobUrl} 
                        download={msg.fileData?.name}
                        className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition-colors ${
                            msg.sender === 'me' 
                            ? 'bg-purple-700 hover:bg-purple-800 text-white' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                        <Download className="w-3 h-3" /> 保存
                    </a>
                </div>
              )}
              <div className={`text-[10px] mt-1 text-right ${msg.sender === 'me' ? 'text-purple-200' : 'text-slate-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-slate-200 shrink-0 pb-[env(safe-area-inset-bottom,20px)]">
        <div className="flex items-end gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={sendFile}
            // Removed 'accept' attribute to allow all files on Android/iOS
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 hover:text-purple-600 transition-colors"
            title="ファイルを添付"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            }}
            placeholder="メッセージを入力..."
            className="flex-1 bg-slate-100 text-slate-900 p-3 rounded-xl border-none focus:ring-2 focus:ring-purple-500 resize-none max-h-24 min-h-[44px] text-sm"
            rows={1}
          />
          <button 
            onClick={sendMessage}
            disabled={!inputText.trim()}
            className="p-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 rounded-xl text-white transition-colors shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DirectConnection;