import type { AlienResult } from "./scoring";

export type DraftScreen = "briefing" | "quiz" | "game" | "photo";

export type ScanDraft = {
  updatedAt: string;
  screen: DraftScreen;
  questionIndex: number;
  answers: Record<string, number>;
  gameChoice: number | null;
};

export type ScanRecord = {
  id: string;
  createdAt: string;
  result: AlienResult;
};

export interface ScanRepository {
  save(record: ScanRecord): Promise<void>;
  latest(): Promise<ScanRecord | null>;
  saveDraft(draft: ScanDraft): Promise<void>;
  getDraft(): Promise<ScanDraft | null>;
  clearDraft(): Promise<void>;
}

class LocalScanRepository implements ScanRepository {
  private readonly resultKey = "alien-index:last-scan";
  private readonly draftKey = "alien-index:scan-draft";

  async save(record: ScanRecord) {
    window.localStorage.setItem(this.resultKey, JSON.stringify(record));
  }

  async latest() {
    const value = window.localStorage.getItem(this.resultKey);
    return value ? (JSON.parse(value) as ScanRecord) : null;
  }

  async saveDraft(draft: ScanDraft) {
    window.localStorage.setItem(this.draftKey, JSON.stringify(draft));
  }

  async getDraft() {
    const value = window.localStorage.getItem(this.draftKey);
    if (!value) return null;
    try {
      return JSON.parse(value) as ScanDraft;
    } catch {
      window.localStorage.removeItem(this.draftKey);
      return null;
    }
  }

  async clearDraft() {
    window.localStorage.removeItem(this.draftKey);
  }
}

// Firebase 연동 시 이 구현체만 Firestore 기반 저장소로 교체하면 됩니다.
export const scanRepository: ScanRepository = new LocalScanRepository();
