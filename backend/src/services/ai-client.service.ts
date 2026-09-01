export class AIServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 503,
  ) {
    super(message);
  }
}

type AIEnrollment = {
  studentId: string;
  embeddingDimension: number;
  acceptedFrames: number;
  preview: string;
};

type PoseDetection = {
  pose: 'front' | 'left' | 'right' | 'unknown';
  confidence: number;
  faceCount: number;
  bbox?: { x: number; y: number; width: number; height: number };
};

type RecognitionFace = {
  bbox: { x: number; y: number; width: number; height: number };
  quality: number;
  pose?: string;
  result: 'MATCHED' | 'UNKNOWN_PERSON' | 'AMBIGUOUS';
  studentId?: string;
  score: number;
  runnerUpScore: number;
  evidenceCrop: string;
};

export type RecognitionFrame = {
  faces: RecognitionFace[];
  framePreview?: string;
  frameWidth?: number;
  frameHeight?: number;
};

export class AIClientService {
  private readonly baseUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
  private readonly serviceKey = process.env.AI_SERVICE_KEY || '';

  private headers() {
    return { 'x-ai-service-key': this.serviceKey };
  }

  private async parse(response: Response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof body.detail === 'string' ? body.detail : body?.error?.message;
      throw new AIServiceError(detail || 'AI service request failed.', response.status >= 500 ? 503 : response.status);
    }
    return body;
  }

  async health() {
    const response = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(5_000) });
    return this.parse(response) as Promise<{ status: string; device: string }>;
  }

  async enroll(studentId: string, frames: Express.Multer.File[]): Promise<AIEnrollment> {
    const form = new FormData();
    form.append('student_id', studentId);
    for (const frame of frames) {
      form.append('frames', new Blob([new Uint8Array(frame.buffer)], { type: frame.mimetype }), frame.originalname);
    }
    const response = await fetch(`${this.baseUrl}/internal/v1/enrollments`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
    return this.parse(response) as Promise<AIEnrollment>;
  }

  async detectPose(image: Express.Multer.File): Promise<PoseDetection> {
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }), image.originalname);
    const response = await fetch(`${this.baseUrl}/internal/v1/pose`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    return this.parse(response) as Promise<PoseDetection>;
  }

  async resetEnrollment(studentId: string) {
    const response = await fetch(`${this.baseUrl}/internal/v1/enrollments/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    });
    return this.parse(response);
  }

  async loadRoster(sessionId: string, rosterVersion: string, studentIds: string[]) {
    const response = await fetch(`${this.baseUrl}/internal/v1/attendance-sessions/${encodeURIComponent(sessionId)}/roster`, {
      method: 'PUT',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ rosterVersion, members: studentIds.map((studentId) => ({ studentId })) }),
      signal: AbortSignal.timeout(15_000),
    });
    return this.parse(response);
  }

  async recognize(sessionId: string, image: Express.Multer.File): Promise<RecognitionFrame> {
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }), image.originalname);
    const response = await fetch(`${this.baseUrl}/internal/v1/attendance-sessions/${encodeURIComponent(sessionId)}/recognitions`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    return this.parse(response) as Promise<RecognitionFrame>;
  }

  async captureRtsp(sessionId: string, rtspUrl: string): Promise<RecognitionFrame> {
    const response = await fetch(`${this.baseUrl}/internal/v1/attendance-sessions/${encodeURIComponent(sessionId)}/capture`, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ rtspUrl }),
      signal: AbortSignal.timeout(35_000),
    });
    return this.parse(response) as Promise<RecognitionFrame>;
  }

  async unloadRoster(sessionId: string) {
    const response = await fetch(`${this.baseUrl}/internal/v1/attendance-sessions/${encodeURIComponent(sessionId)}/roster`, {
      method: 'DELETE',
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    });
    return this.parse(response);
  }
}

export const aiClientService = new AIClientService();
