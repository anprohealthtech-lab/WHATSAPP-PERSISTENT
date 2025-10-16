import { Client, LocalAuth } from 'whatsapp-web.js';
import { createSystemLog } from '../utils/systemLogger'; // Assuming a utility for logging
import { MessageService } from './MessageService';

export class WhatsAppService {
    private client: Client;
    private messageService: MessageService;

    constructor() {
        this.messageService = new MessageService();
        this.client = new Client({
            authStrategy: new LocalAuth(),
        });

        this.client.on('qr', (qr) => {
            console.log('QR RECEIVED', qr);
            // Optionally, you can implement a way to display the QR code to the user
        });

        this.client.on('ready', () => {
            console.log('WhatsApp client is ready!');
            createSystemLog({
                level: 'info',
                message: 'WhatsApp client is ready',
            });
        });

        this.client.on('authenticated', () => {
            console.log('WhatsApp client authenticated');
            createSystemLog({
                level: 'info',
                message: 'WhatsApp client authenticated',
            });
        });

        this.client.on('disconnected', (reason) => {
            console.log('WhatsApp client disconnected', reason);
            createSystemLog({
                level: 'warn',
                message: 'WhatsApp client disconnected',
                metadata: { reason },
            });
        });
    }

    async initialize() {
        await this.client.initialize();
    }

    async sendMessage(to: string, message: string) {
        try {
            const response = await this.client.sendMessage(to, message);
            this.messageService.trackMessage(response);
            return response;
        } catch (error) {
            createSystemLog({
                level: 'error',
                message: 'Failed to send message',
                metadata: { error: error.message },
            });
            throw error;
        }
    }
}