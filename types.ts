
export enum AppMode {
  HOME = 'HOME',
  SEND = 'SEND',
  RECEIVE = 'RECEIVE',
  HISTORY = 'HISTORY',
  P2P = 'P2P'
}

export interface HistoryItem {
  id: string;
  type: 'sent' | 'received';
  content: string;
  timestamp: number;
  aiAnalysis?: string;
}

export interface QRCodeData {
  text: string;
  timestamp: number;
}