import { SessionInteractionPayload } from '../types';

const API_URL = 'https://kaushik-dev.online/api/recommend/';
const STORAGE_KEY = 'polya_pending_recommendation';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export interface RecommendationResponse {
  student_id: string;
  chapter_id: string;
  performance_score: number;
  confidence_score: number;
  learning_state: string;
  diagnosis: {
    accuracy: number;
    hint_dependency: string;
    retry_behavior: string;
    time_efficiency: string;
    history: {
      past_attempts: number;
      avg_performance?: number;
      trend: string;
    };
  };
  recommendation: {
    type: string;
    reason: string;
    next_steps: string[];
    prerequisite_url?: string;
  };
}

const CHAPTER_ID_MAP: Record<string, string> = {
  comparing_quantities: 'grade8_comparing_qty_and_proportions',
  direct_inverse_proportion: 'grade8_comparing_qty_and_proportions',
};

function buildPayload(raw: SessionInteractionPayload): Record<string, unknown> {
  const int = (v: number | undefined | null): number | null => (v == null || v === 0) ? null : Math.round(v);
  return {
    student_id: raw.student_id,
    session_id: raw.session_id,
    chapter_id: CHAPTER_ID_MAP[raw.chapter_id] ?? raw.chapter_id,
    timestamp: raw.timestamp,
    session_status: raw.session_status,
    correct_answers: int(raw.correct_answers),
    wrong_answers: int(raw.wrong_answers),
    questions_attempted: int(raw.questions_attempted),
    total_questions: Math.round(raw.total_questions ?? 0),
    retry_count: int(raw.retry_count),
    hints_used: int(raw.hints_used),
    total_hints_embedded: Math.round(raw.total_hints_embedded ?? 0),
    time_spent_seconds: int(raw.time_spent_seconds),
    topic_completion_ratio: raw.topic_completion_ratio ?? 0,
  };
}

async function postWithRetry(
  payload: Record<string, unknown>,
  token: string,
  attempt = 1
): Promise<RecommendationResponse> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    localStorage.removeItem(STORAGE_KEY);
    return res.json();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      return postWithRetry(payload, token, attempt + 1);
    }
    throw err;
  }
}

export async function sendRecommendation(
  raw: SessionInteractionPayload,
  token: string
): Promise<RecommendationResponse> {
  const payload = buildPayload(raw);
  // Only persist for retry if we have a real token
  if (token && token !== 'default_token') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ payload, token }));
  }
  return postWithRetry(payload, token);
}

export async function retrySavedRecommendation(): Promise<RecommendationResponse | null> {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    const { payload, token } = JSON.parse(saved);
    return await postWithRetry(payload, token);
  } catch {
    return null;
  }
}
