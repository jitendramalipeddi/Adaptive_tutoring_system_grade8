export enum SessionStatus {
  COMPLETED = 'completed',
  EXITED_MIDWAY = 'exited_midway'
}

export interface Subtopic {
  subtopic_id: string;
  name: string;
  difficulty: number; // 0-1
}

export interface ChapterMetadata {
  grade: number;
  chapter_name: string;
  chapter_id: string;
  chapter_url: string;
  chapter_difficulty: number;
  expected_completion_time_seconds: number;
  subtopics: Subtopic[];
  prerequisites: string[];
}

export interface QuestionMetric {
  problem_id: string;
  time_spent_seconds: number;
  hints_used: number;
  is_correct: boolean;
  attempts: number;
}

export interface SubtopicPerformance {
  subtopic_id: string;
  chapter_id: string;
  reading_time_seconds: number;
  questions: QuestionMetric[];
  last_attempt_timestamp: string;
  expertise_level: 'novice' | 'intermediate' | 'expert';
}

export interface SessionInteractionPayload {
  student_id: string;
  session_id: string;
  chapter_id: string;
  timestamp: string; // ISO 8601
  session_status: SessionStatus;
  correct_answers: number;
  wrong_answers: number;
  questions_attempted: number;
  total_questions: number;
  retry_count: number;
  hints_used: number;
  total_hints_embedded: number;
  time_spent_seconds: number;
  topic_completion_ratio: number; // 0-1 (completed_subtopics / total_subtopics)
}

export type PolyaStep = 'QUESTION_ATTEMPT' | 'UNDERSTAND' | 'PLAN' | 'SOLVE' | 'REVIEW';

export interface Problem {
  problem_id: string;
  question: string;
  hints: string[];
  polya_steps?: {
    understand: string;
    plan: string;
    solve: string;
    review: string;
  };
  correct_answer: string;
  difficulty: number;
  options?: string[]; // For MCQ if word-based
  mcq_options?: string[]; // From content.json
  correct_answer_index?: number; // From content.json
}

export interface SubtopicContent {
  subtopic_id: string;
  learning_material?: string;
  story_hook?: string;
  problems: Problem[];
}

export interface ChapterContent {
  chapter_id: string;
  subtopics: SubtopicContent[];
}

export interface TutoringState {
  currentChapter: ChapterMetadata | null;
  currentSubtopic: Subtopic | null;
  currentProblem: Problem | null;
  currentStep: PolyaStep;
  messages: { role: 'user' | 'model'; text: string }[];
  sessionId: string;
  totalChapterQuestions: number;
  isAnswered: boolean;
  hintIndex: number;
  metrics: {
    correct: number;
    wrong: number;
    hints: number;
    attempts: number;
    retries: number;
    startTime: number;
  };
}
