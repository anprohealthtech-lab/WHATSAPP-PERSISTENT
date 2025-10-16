import { pgTable, serial, varchar, timestamp, text, boolean, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  patientName: varchar('patient_name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  testName: varchar('test_name', { length: 255 }).notNull(),
  reportDate: timestamp('report_date').notNull(),
  doctorName: varchar('doctor_name', { length: 255 }).notNull(),
  labName: varchar('lab_name', { length: 255 }).notNull(),
  messageContent: text('message_content'),
  filePath: varchar('file_path', { length: 500 }),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: integer('file_size'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  whatsappMessageId: varchar('whatsapp_message_id', { length: 255 }),
  deliveredAt: timestamp('delivered_at'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('user'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const systemLogs = pgTable('system_logs', {
  id: serial('id').primaryKey(),
  level: varchar('level', { length: 50 }).notNull(),
  message: text('message').notNull(),
  component: varchar('component', { length: 100 }),
  metadata: text('metadata').nullable(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const whatsappSessions = pgTable('whatsapp_sessions', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 255 }).notNull().unique(),
  isConnected: boolean('is_connected').default(false),
  phoneNumber: varchar('phone_number', { length: 20 }),
  lastConnected: timestamp('last_connected'),
  sessionData: text('session_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Zod schemas for validation
export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const sendMessageSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  patientName: z.string().min(1, "Patient name is required"),
  testName: z.string().min(1, "Test name is required"),
  reportDate: z.string().min(1, "Report date is required"),
  doctorName: z.string().min(1, "Doctor name is required"),
  labName: z.string().min(1, "Lab name is required"),
  messageContent: z.string().optional(),
});

export const sendReportSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  patientName: z.string().min(1, "Patient name is required"),
  testName: z.string().min(1, "Test name is required"),
  reportDate: z.string().min(1, "Report date is required"),
  doctorName: z.string().min(1, "Doctor name is required"),
  labName: z.string().min(1, "Lab name is required"),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SystemLog = typeof systemLogs.$inferSelect;
export type WhatsAppSession = typeof whatsappSessions.$inferSelect;
export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
export type SendReportRequest = z.infer<typeof sendReportSchema>;