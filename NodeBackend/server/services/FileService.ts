import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

class FileService {
    private uploadPath: string;
    private uploadLimit: number;

    constructor() {
        this.uploadPath = path.join(__dirname, '../../uploads');
        this.uploadLimit = 10 * 1024 * 1024; // 10 MB limit
        this.ensureUploadPathExists();
    }

    private ensureUploadPathExists() {
        if (!fs.existsSync(this.uploadPath)) {
            fs.mkdirSync(this.uploadPath, { recursive: true });
        }
    }

    public getMulterMiddleware() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, this.uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
                cb(null, uniqueName);
            }
        });

        return multer({
            storage,
            limits: { fileSize: this.uploadLimit },
            fileFilter: (req, file, cb) => {
                const filetypes = /jpeg|jpg|png|pdf/;
                const mimetype = filetypes.test(file.mimetype);
                const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

                if (mimetype && extname) {
                    return cb(null, true);
                }
                cb(new Error('Error: File type not supported'));
            }
        });
    }

    public async cleanupOldFiles() {
        const files = fs.readdirSync(this.uploadPath);
        const now = Date.now();

        files.forEach(file => {
            const filePath = path.join(this.uploadPath, file);
            const stats = fs.statSync(filePath);
            const fileAge = now - stats.mtimeMs;

            if (fileAge > 24 * 60 * 60 * 1000) { // 24 hours
                fs.unlinkSync(filePath);
            }
        });
    }
}

export default new FileService();