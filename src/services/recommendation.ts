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
  return {
    student_id: raw.student_id,
    session_id: raw.session_id,
    chapter_id: CHAPTER_ID_MAP[raw.chapter_id] ?? raw.chapter_id,
    timestamp: raw.timestamp,
    session_status: raw.session_status,
    total_questions: raw.total_questions,
    total_hints_embedded: raw.total_hints_embedded,
    time_spent_seconds: raw.time_spent_seconds || null,
    topic_completion_ratio: raw.topic_completion_ratio,
    correct_answers: raw.correct_answers || null,
    wrong_answers: raw.wrong_answers || null,
    questions_attempted: raw.questions_attempted || null,
    retry_count: raw.retry_count || null,
    hints_used: raw.hints_used || null,
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
