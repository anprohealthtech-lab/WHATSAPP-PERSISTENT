import fs from 'fs';
import path from 'path';

class PersistentFileService {
    private storagePath: string;

    constructor() {
        this.storagePath = path.join(__dirname, '../../uploads');
        this.ensureStoragePath();
    }

    private ensureStoragePath() {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
    }

    public saveFile(fileName: string, data: Buffer): string {
        const filePath = path.join(this.storagePath, fileName);
        fs.writeFileSync(filePath, data);
        return filePath;
    }

    public getFile(fileName: string): Buffer | null {
        const filePath = path.join(this.storagePath, fileName);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath);
        }
        return null;
    }

    public deleteFile(fileName: string): boolean {
        const filePath = path.join(this.storagePath, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    }

    public listFiles(): string[] {
        return fs.readdirSync(this.storagePath);
    }
}

export default PersistentFileService;