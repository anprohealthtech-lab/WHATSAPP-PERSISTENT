import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { WhatsAppService } from './services/WhatsAppService';
import { MessageService } from './services/MessageService';
import { FileService } from './services/FileService';
import { PersistentFileService } from './services/PersistentFileService';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const whatsAppService = new WhatsAppService();
const messageService = new MessageService();
const fileService = new FileService();
const persistentFileService = new PersistentFileService();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use('/sessions', express.static('sessions'));

// Initialize WhatsApp service
whatsAppService.initialize().catch(error => {
  console.error('Failed to initialize WhatsApp service:', error);
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });

  // Additional socket event handlers can be added here
});

// Define API routes
app.post('/api/send-message', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await messageService.sendMessage(message);
    res.json({ success: true, data: result, message: "Message sent successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error sending message", error: error.message });
  }
});

app.post('/api/send-report', async (req, res) => {
  try {
    const file = req.file; // Assuming file is uploaded using multer
    const result = await fileService.handleFileUpload(file);
    res.json({ success: true, data: result, message: "Report sent successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error sending report", error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});