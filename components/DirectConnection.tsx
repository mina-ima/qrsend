import React, { useState, useEffect, useRef } from 'react';
import { Peer, DataConnection } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Wifi, Send, Paperclip, Download, Check, Loader2, Smartphone, ScanLine, File as FileIcon } from 'lucide-react';
import Scanner from './Scanner';

interface DirectConnectionProps {
  onClose: () => void;
}

type P2PMode = 'select' | 'host' | 'scan' | 'connected';

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
  
  const peerRef = useRef<Peer | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connection) connection.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializePeer = () => {
    // Create a random ID for this peer
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setStatus('接続待機中...');
    });

    peer.on('connection', (conn) => {
      handleConnection(conn);
    });

    peer.on('error', (err) => {
      console.error(err);
      setStatus(`エラーが発生しました: ${err.type}`);
    });
  };

  const handleConnection = (conn: DataConnection) => {
    setConnection(conn);
    setMode('connected');
    setStatus('接続確立！');

    conn.on('data', (data: any) => {
      if (data.type === 'text') {
        addMessage('peer', 'text', data.content);
      } else if (data.type === 'file') {
        // Reconstruct blob
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
      // Optionally keep messages visible but disable input
    });
  };

  const startHosting = () => {
    initializePeer();
    setMode('host');
  };

  const startScanning = () => {
    initializePeer(); // We need a peer instance to connect
    setMode('scan');
  };

  const handleScan = (scannedId: string) => {
    if (!peerRef.current || !scannedId) return;
    
    setStatus('接続中...');
    const conn = peerRef.current.connect(scannedId);
    
    conn.on('open', () => {
      handleConnection(conn);
    });
    
    // If connection fails immediately
    conn.on('error', (err) => {
        console.error("Connection Error", err);
        setStatus("接続に失敗しました");
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

    // Send metadata and file content (PeerJS handles arraybuffer/blobs automatically)
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

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // --- UI Renders ---

  if (mode === 'select') {
    return (
      <div className="flex flex-col h-full p-6 max-w-md mx-auto animate-fade-in">
        <div className="flex items-center mb-8">
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-purple-600 ml-2">P2P 直接接続</h2>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-sm text-purple-800 mb-4">
            <p className="font-bold mb-2 flex items-center gap-2">
              <Wifi className="w-4 h-4" /> サーバーを経由しません
            </p>
            <p>端末同士を直接接続してデータを転送します。アップロード制限がなく、プライバシーも安全です。</p>
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

  if (mode === 'host') {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 animate-fade-in">
        <button onClick={onClose} className="absolute top-4 left-4 p-2 hover:bg-slate-200 rounded-full text-slate-500">
            <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 animate-scale-up border border-slate-100">
          {peerId ? (
            <QRCodeSVG value={peerId} size={200} level="L" />
          ) : (
            <div className="w-[200px] h-[200px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">接続待機中...</h3>
        <p className="text-slate-500 text-center text-sm max-w-xs">
          相手の端末で「参加する」を選び、<br/>このQRコードをスキャンしてください。
        </p>
      </div>
    );
  }

  if (mode === 'scan') {
    return (
      <div className="relative h-full w-full">
        <button onClick={() => setMode('select')} className="absolute top-4 left-4 z-20 p-3 bg-white/50 rounded-full text-slate-800 backdrop-blur-md">
            <ArrowLeft className="w-5 h-5" />
        </button>
        <Scanner 
          isActive={true} 
          onScan={handleScan} 
        />
        {status !== '接続中...' && (
             <div className="absolute bottom-24 left-0 w-full text-center pointer-events-none">
                <span className="bg-black/60 text-white px-4 py-2 rounded-full text-sm backdrop-blur-md shadow-lg">
                   相手のQRコードをスキャン
                </span>
             </div>
        )}
        {status === '接続中...' && (
            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-30 backdrop-blur-sm">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
                <p className="text-slate-800 font-bold">接続中...</p>
            </div>
        )}
      </div>
    );
  }

  // Chat / Connected Mode
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            接続中
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">P2P Encrypted</span>
        </div>
        <div className="w-9"></div> {/* Spacer */}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                <Wifi className="w-12 h-12 mb-2" />
                <p className="text-sm">接続されました。<br/>メッセージやファイルを送信できます。</p>
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

      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex items-end gap-2">
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