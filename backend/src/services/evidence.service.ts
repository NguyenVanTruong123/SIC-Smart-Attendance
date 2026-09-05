import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const evidenceDirectory = process.env.EVIDENCE_STORAGE_DIR || path.join(process.cwd(), 'storage', 'evidence');

export class EvidenceService {
  async saveBase64Jpeg(base64: string) {
    const filename = `${randomUUID()}.jpg`;
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(path.join(evidenceDirectory, filename), Buffer.from(base64, 'base64'));
    return filename;
  }

  async saveBuffer(buffer: Buffer, extension: string) {
    const filename = `${randomUUID()}.${extension.replace(/[^a-z0-9]/gi, '') || 'bin'}`;
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(path.join(evidenceDirectory, filename), buffer);
    return filename;
  }

  getPath(filename: string) {
    return path.join(evidenceDirectory, path.basename(filename));
  }

  async read(filename: string) {
    return readFile(this.getPath(filename));
  }

  async readDataUrl(filename: string, mimeType = 'image/jpeg') {
    const buffer = await this.read(filename);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  async delete(filename: string) {
    try {
      await unlink(this.getPath(filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export const evidenceService = new EvidenceService();
