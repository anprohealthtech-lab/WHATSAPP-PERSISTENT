import { type User, type InsertUser, type Message, type InsertMessage, type SystemLog, type InsertSystemLog, type BlockedNumber, type AutoResponse } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Message methods
  getMessage(id: string): Promise<Message | undefined>;
  getMessages(filters?: { status?: string; phoneNumber?: string; type?: string; limit?: number; offset?: number }): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined>;
  getMessagesCount(filters?: { status?: string; phoneNumber?: string; type?: string }): Promise<number>;
  getMessagesByDateRange(startDate: Date, endDate: Date): Promise<Message[]>;

  // System log methods
  getSystemLogs(limit?: number, offset?: number): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;

  // Blocklist methods
  addToBlocklist(phoneNumber: string, reason?: string): Promise<BlockedNumber>;
  removeFromBlocklist(phoneNumber: string): Promise<void>;
  isNumberBlocked(phoneNumber: string): Promise<boolean>;
  getBlockedNumbers(): Promise<BlockedNumber[]>;
  getBlockedNumber(phoneNumber: string): Promise<BlockedNumber | undefined>;

  // Auto-response methods
  getAutoResponses(): Promise<AutoResponse[]>;
  getAllAutoResponses(): Promise<AutoResponse[]>;
  createAutoResponse(data: { keyword: string; response: string; isActive?: boolean }): Promise<AutoResponse>;
  updateAutoResponse(id: string, data: { keyword?: string; response?: string; isActive?: boolean }): Promise<AutoResponse | undefined>;
  deleteAutoResponse(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private messages: Map<string, Message>;
  private systemLogs: Map<string, SystemLog>;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.systemLogs = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessages(filters?: { status?: string; phoneNumber?: string; type?: string; limit?: number; offset?: number }): Promise<Message[]> {
    let messages = Array.from(this.messages.values());

    if (filters?.status) {
      messages = messages.filter(msg => msg.status === filters.status);
    }
    if (filters?.phoneNumber) {
      messages = messages.filter(msg => msg.phoneNumber === filters.phoneNumber);
    }
    if (filters?.type) {
      messages = messages.filter(msg => msg.type === filters.type);
    }

    // Sort by creation date (newest first)
    messages.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    const offset = filters?.offset || 0;
    const limit = filters?.limit || messages.length;
    
    return messages.slice(offset, offset + limit);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      metadata: insertMessage.metadata || null,
      createdAt: new Date(),
      sentAt: null,
      deliveredAt: null,
    };
    this.messages.set(id, message);
    return message;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const existing = this.messages.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates };
    this.messages.set(id, updated);
    return updated;
  }

  async getMessagesCount(filters?: { status?: string; phoneNumber?: string; type?: string }): Promise<number> {
    const messages = await this.getMessages(filters);
    return messages.length;
  }

  async getMessagesByDateRange(startDate: Date, endDate: Date): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(msg => {
      if (!msg.createdAt) return false;
      const msgDate = new Date(msg.createdAt);
      return msgDate >= startDate && msgDate <= endDate;
    });
  }

  async getSystemLogs(limit = 50, offset = 0): Promise<SystemLog[]> {
    const logs = Array.from(this.systemLogs.values());
    logs.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    
    return logs.slice(offset, offset + limit);
  }

  async createSystemLog(insertLog: InsertSystemLog): Promise<SystemLog> {
    const id = randomUUID();
    const log: SystemLog = {
      ...insertLog,
      id,
      metadata: insertLog.metadata || null,
      createdAt: new Date(),
    };
    this.systemLogs.set(id, log);
    return log;
  }

  // Blocklist methods (MemStorage implementation)
  private blockedNumbers: Map<string, BlockedNumber> = new Map();

  async addToBlocklist(phoneNumber: string, reason: string = 'user_requested'): Promise<BlockedNumber> {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    const blocked: BlockedNumber = {
      id: randomUUID(),
      phoneNumber: cleanedNumber,
      reason,
      blockedAt: new Date(),
    };
    this.blockedNumbers.set(cleanedNumber, blocked);
    return blocked;
  }

  async removeFromBlocklist(phoneNumber: string): Promise<void> {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    this.blockedNumbers.delete(cleanedNumber);
  }

  async isNumberBlocked(phoneNumber: string): Promise<boolean> {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    return this.blockedNumbers.has(cleanedNumber);
  }

  async getBlockedNumbers(): Promise<BlockedNumber[]> {
    return Array.from(this.blockedNumbers.values());
  }

  async getBlockedNumber(phoneNumber: string): Promise<BlockedNumber | undefined> {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    return this.blockedNumbers.get(cleanedNumber);
  }

  // Auto-response methods (MemStorage implementation)
  private autoResponses: Map<string, AutoResponse> = new Map();

  async getAutoResponses(): Promise<AutoResponse[]> {
    return Array.from(this.autoResponses.values()).filter(ar => ar.isActive === 'true');
  }

  async getAllAutoResponses(): Promise<AutoResponse[]> {
    return Array.from(this.autoResponses.values());
  }

  async createAutoResponse(data: { keyword: string; response: string; isActive?: boolean }): Promise<AutoResponse> {
    const id = randomUUID();
    const autoResponse: AutoResponse = {
      id,
      keyword: data.keyword,
      response: data.response,
      isActive: data.isActive === false ? 'false' : 'true',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.autoResponses.set(id, autoResponse);
    return autoResponse;
  }

  async updateAutoResponse(
    id: string,
    data: { keyword?: string; response?: string; isActive?: boolean }
  ): Promise<AutoResponse | undefined> {
    const existing = this.autoResponses.get(id);
    if (!existing) return undefined;

    const updated: AutoResponse = {
      ...existing,
      keyword: data.keyword !== undefined ? data.keyword : existing.keyword,
      response: data.response !== undefined ? data.response : existing.response,
      isActive: data.isActive !== undefined ? (data.isActive ? 'true' : 'false') : existing.isActive,
      updatedAt: new Date(),
    };
    
    this.autoResponses.set(id, updated);
    return updated;
  }

  async deleteAutoResponse(id: string): Promise<void> {
    this.autoResponses.delete(id);
  }
}

// Use database storage when DATABASE_URL is available
import { DatabaseStorage } from './storage/DatabaseStorage';

export const storage = process.env.DATABASE_URL 
  ? new DatabaseStorage()
  : new MemStorage();
