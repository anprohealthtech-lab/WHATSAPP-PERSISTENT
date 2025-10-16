import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import QRCode from 'qrcode-terminal';
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
  private client: Client | null = null;
  private status: WhatsAppStatus = {
    isConnected: false,
    isAuthenticated: false,
    lastSeen: null,
    sessionInfo: null,
  };
  private sessionPath: string;

  constructor() {
    super();
    
    // Ensure session directory exists
    this.sessionPath = path.join(process.cwd(), 'server/sessions');
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    try {
      // Force real WhatsApp mode - no demo mode
      console.log('Initializing real WhatsApp Web integration...');

      // Check for Chrome executable
      const fs = await import('fs');
      const chromePaths = [
        '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable', 
        '/usr/bin/chromium',
        '/snap/bin/chromium'
      ];
      
      const availableChrome = chromePaths.find(path => fs.existsSync(path));
      if (!availableChrome) {
        console.log('Chrome not found, running in demo mode');
        process.env.DEMO_MODE = 'true';
        this.emit('whatsapp-status', { status: 'demo-mode' });
        return;
      }
      
      console.log(`Using Chrome at: ${availableChrome}`);

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: process.env.WHATSAPP_CLIENT_ID || 'default-client',
          dataPath: this.sessionPath,
        }),
        puppeteer: {
          headless: true,
          executablePath: availableChrome,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--remote-debugging-port=9222'
          ],
        },
      });

      this.setupEventHandlers();
      await this.client.initialize();
      
      this.emit('whatsapp-status', { status: 'initializing' });
    } catch (error: any) {
      console.error('Failed to initialize WhatsApp client:', error);
      console.log('Attempting to force real WhatsApp connection...');
      
      // Clean up any existing Chrome processes and sessions
      await this.cleanup();
      
      // Try alternative Chrome configuration for real WhatsApp
      try {
        console.log('Attempting alternative Chrome configuration...');
        
        // Find Chrome executable again
        const fs = await import('fs');
        const chromePaths = [
          '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/snap/bin/chromium'
        ];

        let chromeExecutable = '';
        for (const path of chromePaths) {
          if (fs.existsSync(path)) {
            chromeExecutable = path;
            break;
          }
        }

        if (!chromeExecutable) {
          throw new Error('No Chrome executable found');
        }

        console.log('Using Chrome at:', chromeExecutable);
        
        this.client = new Client({
          authStrategy: new LocalAuth({
            clientId: `whatsapp-${Date.now()}`, // Use unique client ID
            dataPath: this.sessionPath,
          }),
          puppeteer: {
            headless: 'new',
            executablePath: chromeExecutable,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--disable-extensions',
              '--no-first-run',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              '--user-data-dir=' + this.sessionPath + '/chrome-data'
            ],
          },
        });
        
        this.setupEventHandlers();
        await this.client.initialize();
        console.log('WhatsApp client initialized successfully with alternative config');
      } catch (retryError: any) {
        console.error('Alternative WhatsApp initialization also failed:', retryError);
        console.log('Switching to demo mode due to initialization failure');
        process.env.DEMO_MODE = 'true';
        this.emit('whatsapp-auth-failure', { error: retryError?.message || 'WhatsApp unavailable - running in demo mode' });
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('qr', (qr) => {
      console.log('QR Code received, scan please!');
      const qrcode = require('qrcode-terminal');
      qrcode.generate(qr, { small: true });
      
      // Create simple QR code URL for frontend using existing service
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`;
      
      console.log('QR Code URL generated for frontend:', qrCodeUrl.substring(0, 100) + '...');
      console.log('🚀 EMITTING QR-CODE EVENT TO WEBSOCKET!');
      
      // Emit the QR code event
      const qrData = { qr: qrCodeUrl, rawQR: qr };
      this.emit('qr-code', qrData);
      console.log('✅ QR-CODE EVENT EMITTED with data:', qrData);
      
      // Also emit internal event for generateQRCode promise
      this.emit('qr-received', qr);
    });

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.status.isConnected = true;
      this.status.isAuthenticated = true;
      this.status.lastSeen = new Date();
      this.emit('whatsapp-authenticated', { status: this.status });
    });

    this.client.on('authenticated', (session) => {
      console.log('WhatsApp authenticated');
      this.status.sessionInfo = session;
      this.emit('whatsapp-status', { status: 'authenticated', session });
    });

    this.client.on('auth_failure', (msg) => {
      console.error('Authentication failed:', msg);
      this.status.isAuthenticated = false;
      this.emit('whatsapp-auth-failure', { error: msg });
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp client disconnected:', reason);
      this.status.isConnected = false;
      this.status.isAuthenticated = false;
      this.emit('disconnected', { reason });
    });

    this.client.on('message_create', (message) => {
      if (message.fromMe) {
        this.emit('message-sent', { 
          messageId: message.id._serialized,
          to: message.to,
          timestamp: message.timestamp,
        });
      }
    });

    this.client.on('message_ack', (message, ack) => {
      this.emit('message-update', {
        messageId: message.id._serialized,
        ack,
        timestamp: new Date(),
      });
    });
  }

  async sendTextMessage(phoneNumber: string, message: string): Promise<any> {
    // Demo mode simulation
    if (process.env.DEMO_MODE === 'true') {
      console.log(`Demo mode: Would send text message to ${phoneNumber}: ${message}`);
      return {
        id: `demo_${Date.now()}`,
        to: `${phoneNumber}@c.us`,
        body: message,
        timestamp: Date.now(),
      };
    }

    if (!this.client || !this.status.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      // Format phone number (ensure it has country code)
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;
      
      const sentMessage = await this.client.sendMessage(chatId, message);
      
      this.status.lastSeen = new Date();
      
      return {
        id: sentMessage.id._serialized,
        to: sentMessage.to,
        body: sentMessage.body,
        timestamp: sentMessage.timestamp,
      };
    } catch (error: any) {
      console.error('Failed to send text message:', error);
      throw error;
    }
  }

  async sendMediaMessage(phoneNumber: string, filePath: string, caption?: string): Promise<any> {
    // Demo mode simulation
    if (process.env.DEMO_MODE === 'true') {
      console.log(`Demo mode: Would send media message to ${phoneNumber}: ${filePath} with caption: ${caption || 'No caption'}`);
      return {
        id: `demo_media_${Date.now()}`,
        to: `${phoneNumber}@c.us`,
        hasMedia: true,
        timestamp: Date.now(),
      };
    }

    if (!this.client || !this.status.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;
      
      const media = MessageMedia.fromFilePath(filePath);
      const sentMessage = await this.client.sendMessage(chatId, media, { caption });
      
      this.status.lastSeen = new Date();
      
      return {
        id: sentMessage.id._serialized,
        to: sentMessage.to,
        hasMedia: sentMessage.hasMedia,
        timestamp: sentMessage.timestamp,
      };
    } catch (error: any) {
      console.error('Failed to send media message:', error);
      throw error;
    }
  }

  async generateQRCode(): Promise<void> {
    if (this.client && this.status.isConnected) {
      throw new Error('WhatsApp is already connected');
    }

    console.log('Generating fresh WhatsApp QR code...');
    
    // Create a promise that resolves when QR code is received
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('QR code generation timeout'));
      }, 30000); // 30 second timeout

      // Set up one-time QR code listener
      const qrHandler = (qr: string) => {
        clearTimeout(timeout);
        console.log('QR Code received, scan please!');
        const qrcode = require('qrcode-terminal');
        qrcode.generate(qr, { small: true });
        
        // Create QR code URL for frontend
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`;
        
        console.log('QR Code URL generated for frontend:', qrCodeUrl.substring(0, 100) + '...');
        console.log('🚀 EMITTING QR-CODE EVENT TO WEBSOCKET!');
        
        // Emit the QR code event
        const qrData = { qr: qrCodeUrl, rawQR: qr };
        this.emit('qr-code', qrData);
        console.log('✅ QR-CODE EVENT EMITTED with data:', qrData);
        
        resolve();
      };

      // Set up temporary event handler before initialization
      this.once('qr-received', qrHandler);
      
      // Reinitialize client to get new QR code
      this.initialize().then(() => {
        console.log('✅ QR Code generation process completed');
      }).catch((error) => {
        clearTimeout(timeout);
        this.removeListener('qr-received', qrHandler);
        reject(error);
      });
    });
  }

  getStatus(): WhatsAppStatus {
    return { ...this.status };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.status.isConnected = false;
      this.status.isAuthenticated = false;
    }
  }

  private async cleanup(): Promise<void> {
    console.log('Cleaning up Chrome processes and sessions...');
    
    // Destroy existing client
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (error) {
        console.log('Error destroying client:', error);
      }
      this.client = null;
    }

    // Clean up singleton lock files and Chrome data
    const fs = await import('fs');
    const path = await import('path');
    const { spawn } = await import('child_process');
    
    try {
      // Kill any existing Chrome processes
      spawn('pkill', ['-9', '-f', 'chromium'], { stdio: 'ignore' });
      spawn('pkill', ['-9', '-f', 'chrome'], { stdio: 'ignore' });
      
      // Remove lock files and Chrome data
      const lockPaths = [
        path.join(this.sessionPath, 'session-default-client', 'SingletonLock'),
        path.join(this.sessionPath, 'chrome-data'),
        '/tmp/.org.chromium.Chromium'
      ];
      
      for (const lockPath of lockPaths) {
        if (fs.existsSync(lockPath)) {
          if (fs.statSync(lockPath).isDirectory()) {
            fs.rmSync(lockPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(lockPath);
          }
          console.log('Removed:', lockPath);
        }
      }
    } catch (error) {
      console.log('Could not clean up Chrome files:', error);
    }

    // Reset status
    this.status = {
      isConnected: false,
      isAuthenticated: false,
      lastSeen: null,
      sessionInfo: null,
    };
    
    // Wait a moment for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming US +1 as default)
    if (!cleaned.startsWith('1') && cleaned.length === 10) {
      cleaned = '1' + cleaned;
    }
    
    return cleaned;
  }
}

export const whatsAppService = new WhatsAppService();
