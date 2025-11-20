import React, { useState, useEffect, useRef } from 'react';
import { Peer, DataConnection } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Wifi, Send, Paperclip, Download, Check, Loader2, Smartphone, ScanLine, File as FileIcon, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
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

    // Create a random short ID for easier debugging/logging if needed, though PeerJS does this.
    // We use multiple STUN servers to increase connection success rate.
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
      // Host side: received a connection attempt
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
      // Don't reset mode immediately to let user read error
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
        // Reconstruct file from Blob or ArrayBuffer
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
    // First, switch to initializing state. 
    // The useEffect will switch to 'scan' once peerId is obtained.
    setMode('initializing_client'); 
    setError(null);
    initializePeer(); 
  };

  const handleScan = (scannedId: string) => {
    if (!peerRef.current || !peerId || !scannedId) return;
    
    setMode('connecting');
    setStatus('接続を確立しています...');

    // Connect
    const conn = peerRef.current.connect(scannedId, {
        reliable: true // Ensure file chunks arrive in order
    });
    
    // Set a timeout for connection
    connectionTimeoutRef.current = window.setTimeout(() => {
      if (mode !== 'connected') {
        setError('接続がタイムアウトしました。双方が同じWi-Fiに接続しているか確認してください。');
        setStatus('タイムアウト');
        // Close connection attempt
        conn.close();
      }
    }, 10000); // 10 seconds timeout
    
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
      <div className="flex flex-col h-full p-6 max-w-md mx-auto animate-fade-in overflow-y-auto">
        <div className="flex items-center mb-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-purple-600 ml-2">P2P 直接接続</h2>
        </div>

        <div className="flex flex-col gap-4">
           {error && (
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-sm text-red-600 mb-2 flex items-start gap-2">
               <XCircle className="w-5 h-5 shrink-0" />
               <p>{error}</p>
            </div>
          )}

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-sm text-amber-800 mb-2">
            <p className="font-bold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> 重要: ネットワーク設定
            </p>
            <p className="text-xs leading-relaxed">
              接続を安定させるため、<strong>PCとスマホは同じWi-Fiネットワーク</strong>に接続してください。異なる回線（例: Wi-Fiと4G）では接続できない場合があります。
            </p>
          </div>

          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-sm text-purple-800 mb-4">
            <p className="font-bold mb-2 flex items-center gap-2">
              <Wifi className="w-4 h-4" /> サーバーを経由しません
            </p>
            <p>端末同士を直接接続してデータを転送します。</p>
          </div>

          <button 
            onClick={startHosting}
            className="group relative flex items-center p-6 bg-white border border-slate-200 rounded-2xl hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/10 transition-all shadow-sm"
          >
             <div className="bg-purple-100 p-4 rounded-full mr-5">
               <Smartphone className="w-8 h-8 text-purple-600" />
             </div>
             <div className="text-left">
               <h3 className="text-lg font-bold text-slate-800">待機する (ホスト)</h3>
               <p className="text-slate-500 text-xs">QRコードを表示して接続を待つ</p>
             </div>
          </button>

          <button 
            onClick={startScanning}
            className="group relative flex items-center p-6 bg-white border border-slate-200 rounded-2xl hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/10 transition-all shadow-sm"
          >
             <div className="bg-purple-100 p-4 rounded-full mr-5">
               <ScanLine className="w-8 h-8 text-purple-600" />
             </div>
             <div className="text-left">
               <h3 className="text-lg font-bold text-slate-800">参加する (クライアント)</h3>
               <p className="text-slate-500 text-xs">相手のQRコードを読み取る</p>
             </div>
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'initializing_client') {
     return (
        <div className="flex flex-col h-full items-center justify-center p-6 bg-slate-50 animate-fade-in">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-6" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">準備中...</h3>
            <p className="text-slate-500 text-center text-sm mb-8">
                P2PネットワークのIDを取得しています。<br/>
                数秒お待ちください。
            </p>
            <button onClick={resetConnection} className="text-slate-400 text-sm hover:text-slate-600 underline">
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
        <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 animate-scale-up border border-slate-100 relative">
          {peerId ? (
            <>
              <QRCodeSVG value={peerId} size={200} level="L" includeMargin />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {status === '接続要求を受信中...' && (
                      <div className="bg-white/90 p-4 rounded-full shadow-lg backdrop-blur-sm">
                         <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                      </div>
                  )}
              </div>
            </>
          ) : (
            <div className="w-[200px] h-[200px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">
            {status === '接続要求を受信中...' ? '接続処理中...' : '接続待機中...'}
        </h3>
        <p className="text-slate-500 text-center text-sm max-w-xs leading-relaxed">
          相手の端末で「参加する」を選び、<br/>このQRコードをスキャンしてください。
        </p>
        <p className="mt-4 text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
            同じWi-Fiに接続してください
        </p>
        
        {status !== '初期化中...' && (
             <button 
                onClick={() => {
                    initializePeer(); // Reset peer
                }}
                className="mt-8 flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm transition-colors"
             >
                <RefreshCw className="w-4 h-4" /> IDを再生成
             </button>
        )}
      </div>
    );
  }

  if (mode === 'scan') {
    return (
      <div className="relative h-full w-full">
        <button onClick={resetConnection} className="absolute top-4 left-4 z-20 p-3 bg-white/50 rounded-full text-slate-800 backdrop-blur-md">
            <ArrowLeft className="w-5 h-5" />
        </button>
        <Scanner 
          isActive={true} 
          onScan={handleScan} 
        />
        <div className="absolute bottom-24 left-0 w-full text-center pointer-events-none">
            <span className="bg-black/60 text-white px-4 py-2 rounded-full text-sm backdrop-blur-md shadow-lg">
                相手のQRコードをスキャン
            </span>
        </div>
      </div>
    );
  }

  if (mode === 'connecting') {
      return (
        <div className="flex flex-col h-full items-center justify-center p-6 bg-slate-50 animate-fade-in">
             <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-6" />
             <h3 className="text-xl font-bold text-slate-800 mb-2">接続中...</h3>
             <p className="text-slate-500 text-center text-sm mb-8">
                 相手との通信経路を確立しています。<br/>これには数秒〜20秒ほどかかる場合があります。
             </p>

             {error && (
                 <p className="text-red-500 text-sm font-bold mb-4 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
             )}

             <button 
                onClick={resetConnection}
                className="px-6 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-sm"
             >
                キャンセル / 戻る
             </button>
        </div>
      )
  }

  // Chat / Connected Mode
  return (
    <div className="flex flex-col h-full bg-slate-50 w-full">
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
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
        <div className="w-9"></div> {/* Spacer */}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 min-h-0 w-full">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                <Wifi className="w-12 h-12 mb-2" />
                <p className="text-sm text-center">接続されました。<br/>メッセージやファイルを送信できます。</p>
            </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
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

      <div className="p-4 bg-white border-t border-slate-200 shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-end gap-2 mb-[env(safe-area-inset-bottom)]">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={sendFile} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 hover:text-purple-600 transition-colors"
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
            className="flex-1 bg-slate-100 text-slate-900 p-3 rounded-xl border-none focus:ring-2 focus:ring-purple-500 resize-none max-h-24 min-h-[44px]"
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