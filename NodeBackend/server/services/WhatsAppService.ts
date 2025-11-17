import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export interface WhatsAppStatus {
  isConnected: boolean;
  isAuthenticated: boolean;
  lastSeen: Date | null;
  sessionInfo: any;
}

export class WhatsAppService extends EventEmitter {
  private socket: WASocket | null = null;
  private status: WhatsAppStatus = {
    isConnected: false,
    isAuthenticated: false,
    lastSeen: null,
    sessionInfo: null,
  };
  private authPath: string;
  private currentQR: string | null = null;

  constructor() {
    super();
    this.authPath = path.join(process.cwd(), 'server/sessions/baileys_auth');
    if (!fs.existsSync(this.authPath)) {
      fs.mkdirSync(this.authPath, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Starting Baileys WhatsApp - no Chrome needed!');
      
      // Clean up any existing socket first
      if (this.socket) {
        this.socket.end(undefined);
        this.socket = null;
      }
      
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
      const { version } = await fetchLatestBaileysVersion();

      this.socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: ['LIMS System', 'Chrome', '1.0.0'],
        connectTimeoutMs: 30000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        // Add retry configuration
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('📱 Baileys QR received!');
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`;
          this.currentQR = qrUrl;
          this.emit('qr-code', { qr: qrUrl, rawQR: qr });
          console.log('🎯 Baileys QR emitted to frontend');
        }

        if (connection === 'open') {
          console.log('✅ Connected via Baileys!');
          this.status.isConnected = true;
          this.status.isAuthenticated = true;
          this.status.lastSeen = new Date();
          this.currentQR = null;
          this.emit('whatsapp-authenticated', { status: this.status });
        } else if (connection === 'close') {
          console.log('❌ Baileys connection closed');
          this.status.isConnected = false;
          this.status.isAuthenticated = false;
          
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          console.log(`🔍 Disconnect reason: ${statusCode} (${DisconnectReason[statusCode] || 'unknown'})`);
          
          if (shouldReconnect && statusCode !== DisconnectReason.connectionClosed) {
            console.log('🔄 Reconnecting in 5 seconds...');
            setTimeout(() => this.initialize(), 5000);
          } else {
            console.log('🚪 Logged out or connection closed - clearing auth and need new QR scan');
            // Clear current QR and auth state
            this.currentQR = null;
            this.emit('whatsapp-auth-failure', { error: 'Logged out' });
          }
        } else if (connection === 'connecting') {
          console.log('🔄 Baileys connecting...');
        }
      });

    } catch (error: any) {
      console.error('❌ Baileys init failed:', error);
      this.emit('whatsapp-auth-failure', { error: error?.message });
    }
  }

  async sendTextMessage(phoneNumber: string, message: string): Promise<any> {
    if (!this.socket || !this.status.isConnected) {
      throw new Error('WhatsApp not connected');
    }

    const jid = `${this.formatPhoneNumber(phoneNumber)}@s.whatsapp.net`;
    const result = await this.socket.sendMessage(jid, { text: message });
    
    this.status.lastSeen = new Date();
    this.emit('message-sent', {
      messageId: result?.key?.id,
      to: jid,
      timestamp: Date.now(),
    });
    
    return {
      id: result?.key?.id,
      to: jid,
      body: message,
      timestamp: Date.now(),
    };
  }

  async sendMessageWithButtons(
    phoneNumber: string, 
    message: string, 
    buttons: Array<{ text: string; url?: string; phoneNumber?: string }>
  ): Promise<any> {
    if (!this.socket || !this.status.isConnected) {
      throw new Error('WhatsApp not connected');
    }

    // Append buttons as clickable links at the end of message
    let fullMessage = message + '\n\n';
    
    for (const btn of buttons) {
      if (btn.url) {
        fullMessage += `🔗 ${btn.text}: ${btn.url}\n`;
      } else if (btn.phoneNumber) {
        fullMessage += `📞 ${btn.text}: ${btn.phoneNumber}\n`;
      } else {
        fullMessage += `✅ ${btn.text}\n`;
      }
    }

    // Use regular text message - URLs are auto-clickable in WhatsApp
    return this.sendTextMessage(phoneNumber, fullMessage.trim());
  }

  async sendMediaMessage(phoneNumber: string, filePath: string, caption?: string): Promise<any> {
    if (!this.socket || !this.status.isConnected) {
      throw new Error('WhatsApp not connected');
    }

    const jid = `${this.formatPhoneNumber(phoneNumber)}@s.whatsapp.net`;
    const fileBuffer = fs.readFileSync(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    
    let messageContent: any = {};
    
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(fileExtension)) {
      messageContent = { image: fileBuffer, caption: caption };
    } else if (['.pdf', '.doc', '.docx', '.txt'].includes(fileExtension)) {
      messageContent = { document: fileBuffer, fileName: path.basename(filePath), caption: caption };
    } else {
      messageContent = { document: fileBuffer, fileName: path.basename(filePath), caption: caption };
    }
    
    const result = await this.socket.sendMessage(jid, messageContent);
    
    this.status.lastSeen = new Date();
    this.emit('message-sent', {
      messageId: result?.key?.id,
      to: jid,
      timestamp: Date.now(),
    });
    
    return {
      id: result?.key?.id,
      to: jid,
      hasMedia: true,
      caption: caption,
      timestamp: Date.now(),
    };
  }

  async generateQRCode(): Promise<void> {
    console.log('🔄 QR generation requested');
    
    if (this.status.isConnected) {
      throw new Error('WhatsApp is already connected');
    }
    
    if (this.currentQR) {
      console.log('✅ QR already available, emitting existing QR');
      this.emit('qr-code', { qr: this.currentQR, rawQR: this.currentQR });
      return;
    }
    
    // Clean up any existing connection first
    await this.cleanup();
    
    console.log('🔄 No current QR, initializing fresh connection...');
    await this.initialize();
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting WhatsApp...');
    
    if (this.socket) {
      try {
        // Logout properly to clear auth state
        await this.socket.logout();
      } catch (error) {
        console.log('⚠️ Error during logout:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    await this.cleanup();
    
    // Clear auth files to force fresh QR generation
    try {
      const fsPromises = fs.promises;
      if (fs.existsSync(this.authPath)) {
        await fsPromises.rm(this.authPath, { recursive: true, force: true });
        fs.mkdirSync(this.authPath, { recursive: true });
        console.log('🧹 Authentication files cleared');
      }
    } catch (error) {
      console.log('⚠️ Error clearing auth files:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    this.emit('whatsapp-auth-failure', { error: 'Disconnected' });
  }

  getCurrentQR(): string | null {
    return this.currentQR;
  }

  getStatus(): WhatsAppStatus {
    return { ...this.status };
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // If number doesn't start with country code and is 10 digits, assume India (+91)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned;
  }

  async cleanup(): Promise<void> {
    if (this.socket) {
      console.log('🧹 Cleaning up Baileys connection...');
      this.socket.end(undefined);
      this.socket = null;
    }
    
    this.status = {
      isConnected: false,
      isAuthenticated: false,
      lastSeen: null,
      sessionInfo: null,
    };
    
    this.currentQR = null;
  }
}

export const whatsAppService = new WhatsAppService();