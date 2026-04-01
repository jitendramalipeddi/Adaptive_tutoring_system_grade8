import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  ChevronRight, 
  BrainCircuit, 
  CheckCircle2, 
  ArrowLeft, 
  ChevronLeft,
  Send, 
  Lightbulb,
  History,
  TrendingUp,
  Clock,
  Target,
  Sparkles,
  Brain
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { CHAPTERS } from './constants';
import { 
  ChapterMetadata, 
  Subtopic, 
  Problem, 
  PolyaStep, 
  TutoringState, 
  SessionStatus,
  SessionInteractionPayload,
  SubtopicContent,
  ChapterContent,
  SubtopicPerformance,
  QuestionMetric,
  PoolQuestion,
  ChapterPool,
  PoolData
} from './types';
import { generateProblem, getTutoringResponse, generateMCQOptions } from './services/gemini';
import localContent from './data/content.json';
import learningMaterial from './data/learning_material.json';
import poolOfQuestions from './data/pool_of_questions.json';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [view, setView] = useState<'home' | 'chapter' | 'learning' | 'tutoring' | 'summary' | 'history' | 'quiz'>('home');
  const [lastPayload, setLastPayload] = useState<SessionInteractionPayload | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionInteractionPayload[]>([]);
  const [currentContent, setCurrentContent] = useState<SubtopicContent | null>(null);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const [explanationShown, setExplanationShown] = useState(false);
  const [currentExplanationStep, setCurrentExplanationStep] = useState(0); // 0: none, 1: understand, 2: plan, 3: solve, 4: review
  const [learningStep, setLearningStep] = useState<'story' | 'material'>('story');
  
  // New tracking states
  const [readingStartTime, setReadingStartTime] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [currentSubtopicPerformance, setCurrentSubtopicPerformance] = useState<SubtopicPerformance | null>(null);
  const [sessionSubtopicPerformances, setSessionSubtopicPerformances] = useState<SubtopicPerformance[]>([]);
  const [globalPerformance, setGlobalPerformance] = useState<SubtopicPerformance[]>([]);
  const [completionType, setCompletionType] = useState<'subtopic' | 'chapter'>('subtopic');
  
  // Quiz states
  const [quizQuestions, setQuizQuestions] = useState<PoolQuestion[]>([]);
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState<PoolQuestion | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [currentDifficultyLevel, setCurrentDifficultyLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [showCheer, setShowCheer] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizIsCorrect, setQuizIsCorrect] = useState<boolean | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [usedQuestions, setUsedQuestions] = useState<Set<string>>(new Set());
  const [quizShowHint, setQuizShowHint] = useState(false);
  const [readSubtopics, setReadSubtopics] = useState<Set<string>>(new Set());
  
  const [state, setState] = useState<TutoringState>({
    currentChapter: null,
    currentSubtopic: null,
    currentProblem: null,
    currentStep: 'QUESTION_ATTEMPT',
    messages: [],
    sessionId: '',
    totalChapterQuestions: 0,
    isAnswered: false,
    hintIndex: -1,
    metrics: {
      correct: 0,
      wrong: 0,
      hints: 0,
      attempts: 0,
      retries: 0,
      startTime: 0,
    }
  });
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const startChapter = (chapter: ChapterMetadata) => {
    const chapterData = (localContent as unknown as ChapterContent[]).find(c => c.chapter_id === chapter.chapter_id);
    const totalQuestions = chapterData?.subtopics.reduce((acc, sub) => acc + sub.problems.length, 0) || 0;
    
    setState(prev => ({
      ...prev,
      currentChapter: chapter,
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      totalChapterQuestions: totalQuestions,
      metrics: { ...prev.metrics, startTime: Date.now() }
    }));
    setView('chapter');
  };

  const startQuiz = (chapterId: string) => {
    const chapterPool = (poolOfQuestions as PoolData).chapters.find(c => c.chapter_id === chapterId);
    console.log('Chapter Pool:', chapterPool);
    if (!chapterPool || chapterPool.questions.length === 0) return;
    
    const usedQuestions = new Set<string>();
    setQuizQuestions(chapterPool.questions);
    setUsedQuestions(usedQuestions);
    setCurrentQuizIndex(0);
    setConsecutiveCorrect(0);
    setCurrentDifficultyLevel('low');
    setShowCheer(false);
    setQuizAnswer('');
    setQuizIsCorrect(null);
    setQuizSubmitted(false);
    setQuizShowHint(false);
    
    // Get first question directly from chapterPool instead of relying on state update
    const levelRanges: Record<'low' | 'medium' | 'high', [number, number]> = {
      low: [0, 0.4],
      medium: [0.4, 0.7],
      high: [0.7, 1.1]
    };
    const [min, max] = levelRanges['low'];
    const available = chapterPool.questions.filter(q => !usedQuestions.has(q.problem_id) && q.difficulty_score >= min && q.difficulty_score < max);
    let firstQuestion: PoolQuestion | null = null;
    
    if (available.length > 0) {
      firstQuestion = available[Math.floor(Math.random() * available.length)];
    } else {
      firstQuestion = chapterPool.questions[0];
    }
    
    console.log('First Question:', firstQuestion);
    setCurrentQuizQuestion(firstQuestion);
    
    setView('quiz');
  };

  const getNextQuizQuestion = (): PoolQuestion => {
    const levelRanges: Record<'low' | 'medium' | 'high', [number, number]> = {
      low: [0, 0.4],
      medium: [0.4, 0.7],
      high: [0.7, 1.1]
    };
    const [min, max] = levelRanges[currentDifficultyLevel];
    const available = quizQuestions.filter(q => !usedQuestions.has(q.problem_id) && q.difficulty_score >= min && q.difficulty_score < max);
    console.log('Available questions for level', currentDifficultyLevel, ':', available.length);
    if (available.length === 0) {
      // If no questions in level, take any unused
      const anyAvailable = quizQuestions.filter(q => !usedQuestions.has(q.problem_id));
      if (anyAvailable.length === 0) {
        // All used, perhaps end, but for now, allow repeat or take first
        return quizQuestions[0];
      }
      return anyAvailable[Math.floor(Math.random() * anyAvailable.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  };

  const submitQuizAnswer = () => {
    if (!currentQuizQuestion) return;
    const isCorrect = quizAnswer.trim().toLowerCase() === currentQuizQuestion.correct_answer.toLowerCase();
    setQuizIsCorrect(isCorrect);
    setQuizSubmitted(true);
    
    if (isCorrect) {
      setConsecutiveCorrect(prev => {
        const newConsec = prev + 1;
        if (newConsec >= 3) {
          setShowCheer(true);
          return 0;
        }
        return newConsec;
      });
    } else {
      setConsecutiveCorrect(0);
      setCurrentDifficultyLevel('low');
    }
  };

  const nextQuizQuestion = () => {
    if (!currentQuizQuestion) return;
    setUsedQuestions(prev => new Set(prev).add(currentQuizQuestion.problem_id));
    setCurrentQuizIndex(prev => prev + 1);
    const nextQuestion = getNextQuizQuestion();
    setCurrentQuizQuestion(nextQuestion);
    setQuizAnswer('');
    setQuizIsCorrect(null);
    setQuizSubmitted(false);
    setQuizShowHint(false);
  };

  const showQuizHint = () => {
    setQuizShowHint(true);
  };

  const showLearningMaterial = (subtopic: Subtopic) => {
    const chapterData = (localContent as unknown as ChapterContent[]).find(c => c.chapter_id === state.currentChapter?.chapter_id);
    const subtopicData = chapterData?.subtopics.find(s => s.subtopic_id === subtopic.subtopic_id);
    
    // Find learning material from the new file
    const materialChapter = (learningMaterial as any).find((c: any) => c.chapter_id === state.currentChapter?.chapter_id);
    const materialSubtopic = materialChapter?.subtopics.find((s: any) => s.subtopic_id === subtopic.subtopic_id);
    
    const combinedContent = subtopicData ? {
      ...subtopicData,
      learning_material: materialSubtopic?.learning_material || subtopicData.learning_material,
      story_hook: materialSubtopic?.story_hook
    } : null;

    setCurrentContent(combinedContent || null);
    setCurrentProblemIndex(0);
    setState(prev => ({ ...prev, currentSubtopic: subtopic }));
    setLearningStep(combinedContent?.story_hook ? 'story' : 'material');
    setReadingStartTime(Date.now());
    setCurrentSubtopicPerformance({
      subtopic_id: subtopic.subtopic_id,
      chapter_id: state.currentChapter!.chapter_id,
      reading_time_seconds: 0,
      questions: [],
      last_attempt_timestamp: new Date().toISOString(),
      expertise_level: 'novice'
    });
    setReadSubtopics(prev => new Set(prev).add(subtopic.subtopic_id));
    setView('learning');
  };

  const startTutoring = async (problemIdx = 0) => {
    setIsTyping(true);
    setIsWrong(false);
    setExplanationShown(false);
    setShowHint(false);
    try {
      // If we're starting tutoring from learning material, record reading time
      if (readingStartTime && currentSubtopicPerformance) {
        const readingTime = Math.floor((Date.now() - readingStartTime) / 1000);
        setCurrentSubtopicPerformance(prev => prev ? { ...prev, reading_time_seconds: readingTime } : null);
        setReadingStartTime(null);
      }
      let problem: Problem | null = null;
      
      const chapterData = (localContent as unknown as ChapterContent[]).find(c => c.chapter_id === state.currentChapter?.chapter_id);
      const subtopicData = chapterData?.subtopics.find(s => s.subtopic_id === state.currentSubtopic?.subtopic_id);
      
      if (subtopicData && subtopicData.problems.length > problemIdx) {
        problem = { ...subtopicData.problems[problemIdx] };
        
        // Use mcq_options if present, otherwise generate if word-based
        const answerType = getAnswerType(problem);
        if (answerType === 'MCQ') {
          if (problem.mcq_options) {
            problem.options = problem.mcq_options;
          } else if (!problem.options) {
            problem.options = await generateMCQOptions(problem.question, problem.correct_answer);
          }
        }
      } else {
        // Fallback to Gemini generation
        const generated = await generateProblem(state.currentChapter!.chapter_name, state.currentSubtopic!.name);
        problem = {
          problem_id: generated.problem_id,
          question: generated.question,
          hints: generated.hints || [],
          correct_answer: generated.correct_answer,
          difficulty: generated.difficulty
        };
      }

      setState(prev => ({
        ...prev,
        currentProblem: problem,
        currentStep: 'QUESTION_ATTEMPT',
        isAnswered: false,
        hintIndex: -1,
        messages: [{ role: 'model', text: `Here is your problem:\n\n**Problem:** ${problem!.question}\n\nTry to solve it directly! What is the answer?` }],
        metrics: { ...prev.metrics, attempts: prev.metrics.attempts + 1 }
      }));
      setView('tutoring');
      setQuestionStartTime(Date.now());
    } catch (error) {
      console.error("Failed to start tutoring:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const getAnswerType = (problem: Problem) => {
    if (problem.mcq_options || problem.options) return 'MCQ';
    const lower = problem.correct_answer.toLowerCase();
    if (lower === 'yes' || lower === 'no') return 'YES_NO';
    if (/^\d+(\.\d+)?%?$/.test(problem.correct_answer) || /^₹?\d+(\.\d+)?$/.test(problem.correct_answer)) return 'NUMERICAL';
    return 'MCQ';
  };

  const nextQuestion = () => {
    const nextIdx = currentProblemIndex + 1;
    
    const chapterData = (localContent as unknown as ChapterContent[]).find(c => c.chapter_id === state.currentChapter?.chapter_id);
    const subtopicData = chapterData?.subtopics.find(s => s.subtopic_id === state.currentSubtopic?.subtopic_id);
    
    if (subtopicData && nextIdx < subtopicData.problems.length) {
      setCurrentProblemIndex(nextIdx);
      setIsWrong(false);
      setExplanationShown(false);
      setCurrentExplanationStep(0);
      setShowHint(false);
      startTutoring(nextIdx);
    } else {
      // Subtopic completed
      finishSubtopic();
    }
  };

  const continueToNextSubtopic = () => {
    if (!state.currentChapter || !state.currentSubtopic) return;
    
    const currentSubtopicIndex = state.currentChapter.subtopics.findIndex(s => s.subtopic_id === state.currentSubtopic!.subtopic_id);
    const nextSubtopicIndex = currentSubtopicIndex + 1;
    
    if (nextSubtopicIndex < state.currentChapter.subtopics.length) {
      // More subtopics to do
      const nextSubtopic = state.currentChapter.subtopics[nextSubtopicIndex];
      showLearningMaterial(nextSubtopic);
    } else {
      // All subtopics completed - finish the chapter
      finishChapter();
    }
  };

  const useHint = () => {
    setState(prev => {
      const nextHintIndex = prev.hintIndex + 1;
      const hasMoreHints = prev.currentProblem?.hints && nextHintIndex < prev.currentProblem.hints.length;
      
      return {
        ...prev,
        hintIndex: hasMoreHints ? nextHintIndex : prev.hintIndex,
        metrics: { ...prev.metrics, hints: prev.metrics.hints + 1 }
      };
    });
    setShowHint(true);
  };

  const retryQuestion = () => {
    setIsWrong(false);
    setExplanationShown(false);
    setCurrentExplanationStep(0);
    setState(prev => ({
      ...prev,
      isAnswered: false,
      messages: [...prev.messages, { role: 'model', text: "Sure, try again! What's your answer?" }],
      metrics: { ...prev.metrics, retries: prev.metrics.retries + 1 }
    }));
  };

  const showExplanation = () => {
    setExplanationShown(true);
    setCurrentExplanationStep(1);
    const polya = state.currentProblem?.polya_steps;
    const text = polya ? 
      `**Step 1: Understand the Problem**\n\n${polya.understand}` :
      "Let's break it down using Polya's method.\n\n**Step 1: Understand the Problem.** What information do we have?";
      
    setState(prev => ({
      ...prev,
      currentStep: 'UNDERSTAND',
      messages: [...prev.messages, { role: 'model', text }]
    }));
  };

  const nextExplanationStep = () => {
    const nextStep = currentExplanationStep + 1;
    if (nextStep > 4) return;

    setCurrentExplanationStep(nextStep);
    const polya = state.currentProblem?.polya_steps;
    if (!polya) return;

    let text = "";
    let stepName: PolyaStep = 'UNDERSTAND';

    switch(nextStep) {
      case 2:
        text = `**Step 2: Devise a Plan**\n\n${polya.plan}`;
        stepName = 'PLAN';
        break;
      case 3:
        text = `**Step 3: Carry Out the Plan**\n\n${polya.solve}`;
        stepName = 'SOLVE';
        break;
      case 4:
        text = `**Step 4: Look Back (Review)**\n\n${polya.review}\n\nThe correct answer is: **${state.currentProblem?.correct_answer}**`;
        stepName = 'REVIEW';
        break;
    }

    setState(prev => ({
      ...prev,
      currentStep: stepName,
      messages: [...prev.messages, { role: 'model', text }]
    }));
  };

  const handleSend = async (overrideInput?: string) => {
    const currentInput = overrideInput || userInput;
    if (!currentInput.trim() || isTyping) return;

    setUserInput('');
    
    // Add user message immediately
    setState(prev => ({ 
      ...prev, 
      messages: [...prev.messages, { role: 'user' as const, text: currentInput }],
      isAnswered: true
    }));
    
    setIsTyping(true);
    try {
      // Check if direct answer is correct in QUESTION_ATTEMPT step
      if (state.currentStep === 'QUESTION_ATTEMPT') {
        const isCorrect = currentInput.toLowerCase().trim().includes(state.currentProblem!.correct_answer.toLowerCase().trim());
        if (isCorrect) {
          // Record question metrics
          if (questionStartTime && currentSubtopicPerformance && state.currentProblem) {
            const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
            const questionMetric: QuestionMetric = {
              problem_id: state.currentProblem.problem_id,
              time_spent_seconds: timeSpent,
              hints_used: state.hintIndex + 1,
              is_correct: true,
              attempts: state.metrics.attempts + 1
            };
            setCurrentSubtopicPerformance(prev => prev ? {
              ...prev,
              questions: [...prev.questions, questionMetric]
            } : null);
            setQuestionStartTime(null);
          }

          setState(prev => ({
            ...prev,
            metrics: { ...prev.metrics, correct: prev.metrics.correct + 1 },
            messages: [...prev.messages, { role: 'model', text: "That's correct! Well done. You can move to the next question or review this one." }]
          }));
        } else {
          setIsWrong(true);
          setState(prev => ({
            ...prev,
            metrics: { ...prev.metrics, wrong: prev.metrics.wrong + 1 },
            messages: [...prev.messages, { role: 'model', text: "That's not quite right. Would you like to try again or see the step-by-step explanation?" }]
          }));
        }
        setIsTyping(false);
        return;
      }

      const response = await getTutoringResponse(
        state.currentProblem!,
        state.currentStep,
        [...state.messages, { role: 'user', text: currentInput }],
        currentInput
      );

      if (response) {
        setState(prev => {
          let nextStep = prev.currentStep;
          const lowerResponse = response.toLowerCase();
          
          if (lowerResponse.includes('step 2') || lowerResponse.includes('devise a plan')) nextStep = 'PLAN';
          else if (lowerResponse.includes('step 3') || lowerResponse.includes('carry out')) nextStep = 'SOLVE';
          else if (lowerResponse.includes('step 4') || lowerResponse.includes('look back')) nextStep = 'REVIEW';

          return {
            ...prev,
            currentStep: nextStep,
            messages: [...prev.messages, { role: 'model', text: response }]
          };
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem('polya_session_history');
    if (savedHistory) {
      try {
        setSessionHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse session history", e);
      }
    }

    // Load subtopic performance
    const savedSubtopicPerf = localStorage.getItem('polya_subtopic_performance');
    if (savedSubtopicPerf) {
      try {
        setGlobalPerformance(JSON.parse(savedSubtopicPerf));
      } catch (e) {
        console.error("Failed to parse subtopic performance", e);
      }
    }
  }, []);

  const finishSubtopic = () => {
    // Finalize current subtopic performance if it exists
    if (currentSubtopicPerformance) {
      const correctCount = currentSubtopicPerformance.questions.filter(q => q.is_correct && q.attempts === 1).length;
      const totalQuestions = currentSubtopicPerformance.questions.length;
      const ratio = totalQuestions > 0 ? correctCount / totalQuestions : 0;
      const avgHints = totalQuestions > 0 ? currentSubtopicPerformance.questions.reduce((acc, q) => acc + q.hints_used, 0) / totalQuestions : 0;

      let expertise: 'novice' | 'intermediate' | 'expert' = 'novice';
      if (ratio >= 0.8 && avgHints <= 0.5) expertise = 'expert';
      else if (ratio >= 0.5) expertise = 'intermediate';

      const finalPerformance: SubtopicPerformance = { 
        ...currentSubtopicPerformance, 
        expertise_level: expertise,
        last_attempt_timestamp: new Date().toISOString()
      };
      
      // Add to session subtopic performances
      setSessionSubtopicPerformances(prev => [...prev, finalPerformance]);
      
      // Update global performance
      const newGlobalPerformance = [...globalPerformance];
      const existingIdx = newGlobalPerformance.findIndex(p => p.subtopic_id === finalPerformance.subtopic_id);
      if (existingIdx >= 0) {
        newGlobalPerformance[existingIdx] = finalPerformance;
      } else {
        newGlobalPerformance.push(finalPerformance);
      }
      setGlobalPerformance(newGlobalPerformance);
      localStorage.setItem('polya_subtopic_performance', JSON.stringify(newGlobalPerformance));
      
      setCurrentSubtopicPerformance(null);
    }
    
    setCompletionType('subtopic');
    setView('summary');
  };

  const finishChapter = () => {
    const timeSpent = Math.floor((Date.now() - state.metrics.startTime) / 1000);
    
    // Ensure current subtopic is finalized
    let finalSubtopicPerformances = [...sessionSubtopicPerformances];
    if (currentSubtopicPerformance && !finalSubtopicPerformances.find(p => p.subtopic_id === currentSubtopicPerformance.subtopic_id)) {
      const correctCount = currentSubtopicPerformance.questions.filter(q => q.is_correct && q.attempts === 1).length;
      const totalQuestions = currentSubtopicPerformance.questions.length;
      const ratio = totalQuestions > 0 ? correctCount / totalQuestions : 0;
      const avgHints = totalQuestions > 0 ? currentSubtopicPerformance.questions.reduce((acc, q) => acc + q.hints_used, 0) / totalQuestions : 0;

      let expertise: 'novice' | 'intermediate' | 'expert' = 'novice';
      if (ratio >= 0.8 && avgHints <= 0.5) expertise = 'expert';
      else if (ratio >= 0.5) expertise = 'intermediate';

      const finalPerformance: SubtopicPerformance = { 
        ...currentSubtopicPerformance, 
        expertise_level: expertise,
        last_attempt_timestamp: new Date().toISOString()
      };
      finalSubtopicPerformances.push(finalPerformance);
      
      // Update global performance
      const newGlobalPerformance = [...globalPerformance];
      const existingIdx = newGlobalPerformance.findIndex(p => p.subtopic_id === finalPerformance.subtopic_id);
      if (existingIdx >= 0) {
        newGlobalPerformance[existingIdx] = finalPerformance;
      } else {
        newGlobalPerformance.push(finalPerformance);
      }
      setGlobalPerformance(newGlobalPerformance);
      localStorage.setItem('polya_subtopic_performance', JSON.stringify(newGlobalPerformance));
    }

    // Calculate topic_completion_ratio based on completed subtopics
    const totalSubtopics = state.currentChapter?.subtopics.length || 1;
    const completedSubtopics = finalSubtopicPerformances.length;
    const topicCompletionRatio = completedSubtopics / totalSubtopics;

    // Create session payload WITHOUT subtopic_performances field
    const payload: SessionInteractionPayload = {
      student_id: "student_123", 
      session_id: state.sessionId,
      chapter_id: state.currentChapter?.chapter_id || "",
      timestamp: new Date().toISOString(),
      session_status: SessionStatus.COMPLETED,
      correct_answers: state.metrics.correct,
      wrong_answers: state.metrics.wrong,
      questions_attempted: state.metrics.attempts,
      total_questions: state.totalChapterQuestions,
      retry_count: state.metrics.retries,
      hints_used: state.metrics.hints,
      total_hints_embedded: 10,
      time_spent_seconds: timeSpent,
      topic_completion_ratio: topicCompletionRatio
    };
    
    // Save session history
    const updatedHistory = [payload, ...sessionHistory].slice(0, 50);
    setSessionHistory(updatedHistory);
    localStorage.setItem('polya_session_history', JSON.stringify(updatedHistory));

    setLastPayload(payload);
    setCurrentSubtopicPerformance(null);
    setSessionSubtopicPerformances([]);
    setCompletionType('chapter');
    setView('summary');
  };

  const endSessionMidway = () => {
    // Only save if there's an active session (in tutoring view or during chapter learning)
    if (!state.currentChapter || view === 'home' || view === 'summary' || view === 'history' || view === 'quiz') {
      return;
    }

    const timeSpent = Math.floor((Date.now() - state.metrics.startTime) / 1000);
    
    // Calculate topic_completion_ratio based on read subtopics
    const totalSubtopics = state.currentChapter.subtopics.length || 1;
    const completedSubtopics = readSubtopics.size;
    const topicCompletionRatio = completedSubtopics / totalSubtopics;

    const payload: SessionInteractionPayload = {
      student_id: "student_123",
      session_id: state.sessionId,
      chapter_id: state.currentChapter.chapter_id,
      timestamp: new Date().toISOString(),
      session_status: SessionStatus.EXITED_MIDWAY,
      correct_answers: state.metrics.correct,
      wrong_answers: state.metrics.wrong,
      questions_attempted: state.metrics.attempts,
      total_questions: state.totalChapterQuestions,
      retry_count: state.metrics.retries,
      hints_used: state.metrics.hints,
      total_hints_embedded: 10,
      time_spent_seconds: timeSpent,
      topic_completion_ratio: topicCompletionRatio
    };

    // Save session history
    const updatedHistory = [payload, ...sessionHistory].slice(0, 50);
    localStorage.setItem('polya_session_history', JSON.stringify(updatedHistory));
    console.log('Session ended midway and saved:', payload);
  };

  const isSessionActive = () => {
    return state.currentChapter !== null && !['home', 'summary', 'history'].includes(view);
  };

  // Handle beforeunload event - show confirmation when user tries to close tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSessionActive()) return;

      // Save session first (midway exit)
      endSessionMidway();

      // Set custom message for browser confirmation
      e.returnValue = 'Save the session and close?';
      return 'Save the session and close?';
    };

    // Use the older method for better browser compatibility
    window.onbeforeunload = handleBeforeUnload;

    return () => {
      window.onbeforeunload = null;
    };
  }, [state.currentChapter, view, state.metrics, sessionHistory, readSubtopics]);

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-[#5A5A40] selection:text-white">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#1A1A1A]/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white">
              <BrainCircuit size={24} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">PolyaTutor</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('history')}
              className="text-sm font-medium text-[#5A5A40] hover:underline flex items-center gap-1"
            >
              <History size={16} />
              Session History
            </button>
            {view !== 'home' && view !== 'summary' && view !== 'history' && view !== 'quiz' && (
              <button 
                onClick={() => view === 'tutoring' ? setView('chapter') : setView('home')}
                className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <section className="space-y-4">
                <h2 className="text-4xl font-serif italic text-[#5A5A40]">Welcome back, Explorer</h2>
                <p className="text-lg text-[#1A1A1A]/60 max-w-2xl">
                  Master Grade 8 Mathematics using the legendary Polya method. 
                  Understand, Plan, Solve, and Review your way to excellence.
                </p>
              </section>

              {globalPerformance.length > 0 && globalPerformance.some(p => p.expertise_level !== 'expert') && (
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-[#5A5A40]">
                    <Sparkles size={20} />
                    <h3 className="text-xl font-serif italic">Recommended for You</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {globalPerformance
                      .filter(p => p.expertise_level !== 'expert')
                      .sort((a, b) => {
                        if (a.expertise_level === 'novice' && b.expertise_level !== 'novice') return -1;
                        if (a.expertise_level !== 'novice' && b.expertise_level === 'novice') return 1;
                        return 0;
                      })
                      .slice(0, 3)
                      .map(perf => {
                        const chapter = CHAPTERS.find(c => c.chapter_id === perf.chapter_id);
                        const subtopic = chapter?.subtopics.find(s => s.subtopic_id === perf.subtopic_id);
                        if (!chapter || !subtopic) return null;
                        
                        return (
                          <motion.div
                            key={perf.subtopic_id}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => {
                              setState(prev => ({ ...prev, currentChapter: chapter }));
                              showLearningMaterial(subtopic);
                            }}
                            className="bg-white p-6 rounded-2xl border border-[#5A5A40]/10 hover:border-[#5A5A40] transition-all cursor-pointer shadow-sm"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                                perf.expertise_level === 'novice' ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-600"
                              )}>
                                {perf.expertise_level === 'novice' ? 'Needs Focus' : 'Review Suggested'}
                              </span>
                              <span className="text-[10px] opacity-40 truncate max-w-[100px]">{chapter.chapter_name}</span>
                            </div>
                            <h4 className="font-semibold text-sm mb-2">{subtopic.name}</h4>
                            <div className="flex items-center gap-1 text-[10px] text-[#5A5A40] font-bold uppercase tracking-widest">
                              Resume <ChevronRight size={12} />
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CHAPTERS.map((chapter) => (
                  <motion.div
                    key={chapter.chapter_id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => startChapter(chapter)}
                    className="group bg-white p-8 rounded-[32px] shadow-sm border border-transparent hover:border-[#5A5A40]/20 transition-all cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-[#F5F5F0] rounded-2xl group-hover:bg-[#5A5A40] group-hover:text-white transition-colors">
                        <BookOpen size={24} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest opacity-40">Grade {chapter.grade}</span>
                    </div>
                    <h3 className="text-2xl font-semibold mb-2">{chapter.chapter_name}</h3>
                    <p className="text-[#1A1A1A]/50 text-sm mb-6">{chapter.subtopics.length} Key Subtopics</p>
                    <div className="flex items-center gap-2 text-[#5A5A40] font-medium">
                      Start Learning <ChevronRight size={18} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'chapter' && state.currentChapter && (
            <motion.div 
              key="chapter"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-end justify-between border-b border-[#1A1A1A]/10 pb-6">
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]">Chapter Overview</span>
                  <h2 className="text-3xl font-semibold">{state.currentChapter.chapter_name}</h2>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40">Difficulty</p>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className={cn("w-6 h-1 rounded-full", i <= state.currentChapter!.chapter_difficulty * 5 ? "bg-[#5A5A40]" : "bg-[#1A1A1A]/10")} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="font-serif italic text-xl text-[#5A5A40]">Select a Subtopic</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {state.currentChapter.subtopics.map((sub) => (
                      <button
                        key={sub.subtopic_id}
                        onClick={() => showLearningMaterial(sub)}
                        className="flex items-center justify-between p-5 bg-white rounded-2xl border border-[#1A1A1A]/5 hover:border-[#5A5A40] hover:shadow-md transition-all text-left group"
                      >
                        <div className="flex items-center gap-4">
                          {readSubtopics.has(sub.subtopic_id) && <CheckCircle2 size={16} className="text-green-500" />}
                          <span className="font-medium">{sub.name}</span>
                          {globalPerformance.find(p => p.subtopic_id === sub.subtopic_id) && (
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                              globalPerformance.find(p => p.subtopic_id === sub.subtopic_id)?.expertise_level === 'expert' ? "bg-green-100 text-green-600" :
                              globalPerformance.find(p => p.subtopic_id === sub.subtopic_id)?.expertise_level === 'intermediate' ? "bg-yellow-100 text-yellow-600" :
                              "bg-red-100 text-red-600"
                            )}>
                              {globalPerformance.find(p => p.subtopic_id === sub.subtopic_id)?.expertise_level}
                            </span>
                          )}
                        </div>
                        <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5A5A40]" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-[32px] border border-[#1A1A1A]/5">
                    <h4 className="font-semibold flex items-center gap-2 mb-4">
                      <Target size={20} />
                      Final Assessment
                    </h4>
                    {state.currentChapter.subtopics.every(sub => readSubtopics.has(sub.subtopic_id)) ? (
                      <button 
                        onClick={() => startQuiz(state.currentChapter.chapter_id)}
                        className="w-full p-4 bg-blue-500 text-white rounded-2xl font-semibold hover:bg-blue-600 transition-colors"
                      >
                        Take Final Quiz
                      </button>
                    ) : (
                      <div className="text-center text-gray-500">
                        <p className="text-sm mb-2">Complete all subtopics to unlock the final assessment</p>
                        <div className="text-xs">
                          {state.currentChapter.subtopics.filter(sub => readSubtopics.has(sub.subtopic_id)).length} / {state.currentChapter.subtopics.length} completed
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-[#5A5A40] text-white p-6 rounded-[32px] space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <TrendingUp size={20} />
                      Your Progress
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm opacity-80">
                        <span>Completion</span>
                        <span>0%</span>
                      </div>
                      <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                        <div className="bg-white h-full w-0" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[32px] border border-[#1A1A1A]/5 space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <History size={20} />
                      Prerequisites
                    </h4>
                    <ul className="space-y-2">
                      {state.currentChapter.prerequisites.map(pre => (
                        <li key={pre} className="text-sm flex items-center gap-2 text-[#1A1A1A]/60">
                          <CheckCircle2 size={14} className="text-green-600" />
                          {pre.replace(/_/g, ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'learning' && (
            <motion.div 
              key="learning"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="bg-white p-10 rounded-[40px] shadow-sm border border-[#1A1A1A]/5 space-y-8">
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]">
                    {learningStep === 'story' ? 'Story Introduction' : 'Learning Material'}
                  </span>
                  <h2 className="text-3xl font-semibold">{state.currentSubtopic?.name}</h2>
                </div>

                <div className="prose prose-lg max-w-none text-[#1A1A1A]/80 leading-relaxed">
                  {currentContent ? (
                    learningStep === 'story' ? (
                      currentContent.story_hook ? (
                        <div className="text-lg leading-relaxed">
                          {currentContent.story_hook}
                        </div>
                      ) : (
                        <p className="italic opacity-50">No story introduction available. Proceeding to learning material...</p>
                      )
                    ) : (
                      <Markdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          img: ({node, ...props}) => (
                            <img 
                              {...props} 
                              className="rounded-2xl shadow-md mx-auto my-8 border border-[#1A1A1A]/5" 
                              referrerPolicy="no-referrer" 
                            />
                          )
                        }}
                      >
                        {currentContent.learning_material}
                      </Markdown>
                    )
                  ) : (
                    <p className="italic opacity-50">No content available for this subtopic.</p>
                  )}
                </div>

                {globalPerformance.find(p => p.subtopic_id === state.currentSubtopic?.subtopic_id)?.expertise_level === 'novice' && (
                  <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex items-start gap-4">
                    <div className="p-2 bg-red-100 rounded-xl text-red-600">
                      <Brain size={20} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-red-900">Remedial Tip</h4>
                      <p className="text-sm text-red-700">
                        Based on your last attempt, we recommend focusing on the core concepts here. 
                        Try taking more time to read the material before starting the practice.
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-8 flex gap-4">
                  {learningStep === 'story' ? (
                    <button 
                      onClick={() => setLearningStep('material')}
                      className="flex-1 p-6 bg-[#5A5A40] text-white rounded-[32px] font-semibold hover:opacity-90 transition-opacity shadow-lg flex items-center justify-center gap-2"
                    >
                      Proceed to Learning Material <ChevronRight size={20} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => startTutoring(0)}
                      className="flex-1 p-6 bg-[#5A5A40] text-white rounded-[32px] font-semibold hover:opacity-90 transition-opacity shadow-lg flex items-center justify-center gap-2"
                    >
                      Start Practice Session <ChevronRight size={20} />
                    </button>
                  )}
                  <button 
                    onClick={() => setView('chapter')}
                    className="p-6 bg-[#F5F5F0] text-[#1A1A1A] rounded-[32px] font-semibold hover:bg-[#E4E3E0] transition-colors"
                  >
                    Back to Topics
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'tutoring' && state.currentProblem && (
            <motion.div 
              key="tutoring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]"
            >
              <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2">
                <div className="bg-white p-6 rounded-[24px] border border-[#1A1A1A]/5 space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Current Goal</span>
                    <h3 className="font-semibold text-sm leading-tight">{state.currentSubtopic?.name}</h3>
                  </div>

                  <div className="space-y-4">
                    {currentContent?.problems.map((prob, idx) => (
                      <div 
                        key={prob.problem_id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl transition-all",
                          currentProblemIndex === idx ? "bg-[#5A5A40] text-white shadow-lg" : "opacity-40"
                        )}
                      >
                        <Target size={18} />
                        <span className="text-sm font-medium">Problem {idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={nextQuestion}
                    className="w-full p-4 bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] rounded-[24px] font-semibold hover:bg-[#F5F5F0] transition-colors flex items-center justify-center gap-2"
                  >
                    Next Question <ChevronRight size={18} />
                  </button>
                  <button 
                    onClick={finishChapter}
                    className="w-full p-4 bg-[#1A1A1A] text-white rounded-[24px] font-semibold hover:opacity-90 transition-opacity"
                  >
                    Finish Session
                  </button>
                </div>
              </div>

              <div className="lg:col-span-3 bg-white rounded-[32px] border border-[#1A1A1A]/5 flex flex-col overflow-hidden shadow-sm">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {state.messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-[#5A5A40] text-white rounded-tr-none" 
                          : "bg-[#F5F5F0] text-[#1A1A1A] rounded-tl-none"
                      )}>
                        <div className="prose prose-sm max-w-none">
                          <Markdown 
                            remarkPlugins={[remarkMath]} 
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              img: ({node, ...props}) => (
                                <img 
                                  {...props} 
                                  className="rounded-xl shadow-sm mx-auto my-4 border border-[#1A1A1A]/5" 
                                  referrerPolicy="no-referrer" 
                                />
                              )
                            }}
                          >
                            {msg.text}
                          </Markdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {showHint && state.currentProblem?.hints && state.hintIndex >= 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-800 text-sm max-w-[85%]">
                        <p className="font-bold flex items-center gap-2 mb-2">
                          <Lightbulb size={16} /> Hint {state.hintIndex + 1}:
                        </p>
                        <p>{state.currentProblem.hints[state.hintIndex]}</p>
                      </div>
                    </motion.div>
                  )}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-[#F5F5F0] p-4 rounded-2xl rounded-tl-none flex gap-1">
                        <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-[#1A1A1A]/5 bg-[#F5F5F0]/30 space-y-4">
                  {isWrong && !explanationShown ? (
                    <div className="flex gap-3 max-w-4xl mx-auto">
                      <button 
                        onClick={retryQuestion}
                        className="flex-1 p-4 bg-white border border-[#1A1A1A]/10 rounded-2xl font-semibold hover:bg-[#F5F5F0] transition-colors flex items-center justify-center gap-2"
                      >
                        Retry Question
                      </button>
                      <button 
                        onClick={showExplanation}
                        className="flex-1 p-4 bg-[#5A5A40] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        Explanation
                      </button>
                    </div>
                  ) : explanationShown && currentExplanationStep > 0 && currentExplanationStep < 4 ? (
                    <div className="flex gap-3 max-w-4xl mx-auto">
                      <button 
                        onClick={nextExplanationStep}
                        className="flex-1 p-4 bg-[#5A5A40] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        {currentExplanationStep === 1 ? 'Next: Plan' : 
                         currentExplanationStep === 2 ? 'Next: Solve' : 
                         'Next: Review'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 max-w-4xl mx-auto">
                        <button 
                          onClick={useHint}
                          className="flex-1 p-3 bg-amber-100 text-amber-700 rounded-xl font-medium hover:bg-amber-200 transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <Lightbulb size={16} /> Get Hint
                        </button>
                      </div>

                      <div className="relative max-w-4xl mx-auto">
                        {!state.isAnswered ? (
                          state.currentProblem && getAnswerType(state.currentProblem) === 'YES_NO' ? (
                            <div className="flex gap-4">
                              <button 
                                onClick={() => handleSend('Yes')}
                                className="flex-1 p-4 bg-white border border-[#1A1A1A]/10 rounded-2xl font-semibold hover:bg-[#F5F5F0] transition-colors"
                              >
                                Yes
                              </button>
                              <button 
                                onClick={() => handleSend('No')}
                                className="flex-1 p-4 bg-white border border-[#1A1A1A]/10 rounded-2xl font-semibold hover:bg-[#F5F5F0] transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : state.currentProblem && getAnswerType(state.currentProblem) === 'MCQ' && state.currentProblem.options ? (
                            <div className="grid grid-cols-2 gap-3">
                              {state.currentProblem.options.map((opt, i) => (
                                <button 
                                  key={i}
                                  onClick={() => handleSend(opt)}
                                  className="p-4 bg-white border border-[#1A1A1A]/10 rounded-2xl font-semibold hover:bg-[#F5F5F0] transition-colors text-sm text-left"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Type your response or ask for a hint..."
                                className="w-full p-4 pr-12 bg-white rounded-2xl border border-[#1A1A1A]/10 focus:outline-none focus:border-[#5A5A40] transition-all text-sm"
                              />
                              <button 
                                onClick={() => handleSend()}
                                disabled={isTyping}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#5A5A40] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                              >
                                <Send size={18} />
                              </button>
                            </>
                          )
                        ) : (
                          <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center text-[#1A1A1A]/50 text-sm italic">
                            {explanationShown ? "Explanation provided. Move to the next question." : "Answer submitted. Use hints or move to the next question."}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'summary' && (
            <motion.div 
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-3xl font-semibold">
                  {completionType === 'subtopic' ? 'Subtopic Complete!' : 'Chapter Complete!'}
                </h2>
                <p className="text-[#1A1A1A]/60">
                  {completionType === 'subtopic' 
                    ? "Excellent! You've finished this subtopic and learned valuable problem-solving skills." 
                    : "Congratulations! You've successfully completed the entire chapter. Great work!"}
                </p>
              </div>

              <div className="bg-white p-8 rounded-[32px] border border-[#1A1A1A]/10 space-y-6">
                <div className="flex items-center justify-between border-b border-[#1A1A1A]/5 pb-4">
                  <h3 className="font-semibold text-lg">Your Performance</h3>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]">
                    {completionType === 'subtopic' ? 'Subtopic Summary' : 'Chapter Summary'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {completionType === 'subtopic' ? (
                    // Show subtopic-specific metrics
                    <>
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Problems</p>
                        <p className="text-xl font-bold">{sessionSubtopicPerformances[sessionSubtopicPerformances.length - 1]?.questions.length || 0}</p>
                      </div>
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Expertise</p>
                        <p className="text-xl font-bold capitalize">{sessionSubtopicPerformances[sessionSubtopicPerformances.length - 1]?.expertise_level || 'novice'}</p>
                      </div>
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Reading</p>
                        <p className="text-xl font-bold">{Math.floor((sessionSubtopicPerformances[sessionSubtopicPerformances.length - 1]?.reading_time_seconds || 0) / 60)}m</p>
                      </div>
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Accuracy</p>
                        <p className="text-xl font-bold">
                          {sessionSubtopicPerformances[sessionSubtopicPerformances.length - 1] 
                            ? `${((sessionSubtopicPerformances[sessionSubtopicPerformances.length - 1].questions.filter(q => q.is_correct && q.attempts === 1).length / sessionSubtopicPerformances[sessionSubtopicPerformances.length - 1].questions.length) * 100).toFixed(0)}%`
                            : '0%'
                          }
                        </p>
                      </div>
                    </>
                  ) : (
                    // Show chapter metrics
                    <>
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Correct</p>
                        <p className="text-xl font-bold">{lastPayload.correct_answers}</p>
                      </div>
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Hints</p>
                        <p className="text-xl font-bold">{lastPayload.hints_used}</p>
                      </div>
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Time</p>
                        <p className="text-xl font-bold">{Math.floor(lastPayload.time_spent_seconds / 60)}m</p>
                      </div>
                      <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Completion</p>
                        <p className="text-xl font-bold">{(lastPayload.topic_completion_ratio * 100).toFixed(0)}%</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {completionType === 'subtopic' ? (
                  <>
                    <button 
                      onClick={() => setView('chapter')}
                      className="w-full p-6 bg-[#5A5A40] text-white rounded-[32px] font-semibold hover:opacity-90 transition-opacity shadow-lg"
                    >
                      Move to Course Page
                    </button>
                    <button 
                      onClick={finishChapter}
                      className="w-full p-6 bg-[#F5F5F0] text-[#1A1A1A] rounded-[32px] font-semibold hover:bg-[#E4E3E0] transition-colors"
                    >
                      End Session
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setView('home')}
                    className="w-full p-6 bg-[#5A5A40] text-white rounded-[32px] font-semibold hover:opacity-90 transition-opacity shadow-lg"
                  >
                    Back to Home
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-semibold">Session History</h2>
                <button 
                  onClick={() => setView('home')}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
              </div>

              {sessionHistory.length === 0 ? (
                <div className="bg-white p-12 rounded-[32px] text-center space-y-4 border border-[#1A1A1A]/5">
                  <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto text-[#1A1A1A]/20">
                    <History size={32} />
                  </div>
                  <p className="text-[#1A1A1A]/40 font-medium">No sessions recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessionHistory.map((session, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[24px] border border-[#1A1A1A]/5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-shadow">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]">
                            {session.chapter_id.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-[#1A1A1A]/30">•</span>
                          <span className="text-[10px] text-[#1A1A1A]/40">
                            {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h3 className="font-semibold">Session {session.session_id.slice(0, 8)}</h3>
                      </div>

                      <div className="grid grid-cols-4 gap-8">
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-1">Score</p>
                          <p className="font-bold text-[#5A5A40]">{session.correct_answers}/{session.questions_attempted}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-1">Hints</p>
                          <p className="font-bold">{session.hints_used}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-1">Time</p>
                          <p className="font-bold">{Math.floor(session.time_spent_seconds / 60)}m</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-30 mb-1">Ratio</p>
                          <p className="font-bold">{(session.topic_completion_ratio * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => {
                      if (confirm("Are you sure you want to clear your entire session history?")) {
                        setSessionHistory([]);
                        localStorage.removeItem('polya_session_history');
                      }
                    }}
                    className="w-full p-4 text-red-500 text-sm font-medium hover:bg-red-50 rounded-2xl transition-colors"
                  >
                    Clear History
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {view === 'quiz' && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6"
            >
              {showCheer ? (
                <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
                  <Sparkles className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Amazing! You solved 3 questions in a row!</h2>
                  <p className="text-gray-600 mb-6">Now it's time for the next level of questions.</p>
                  <button 
                    onClick={() => {
                      setShowCheer(false);
                      if (currentDifficultyLevel === 'low') {
                        setCurrentDifficultyLevel('medium');
                      } else if (currentDifficultyLevel === 'medium') {
                        setCurrentDifficultyLevel('high');
                      }
                    }} 
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
                  >
                    Continue
                  </button>
                </div>
              ) : currentQuizIndex < 10 ? (
                <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Final Quiz</h1>
                    <div className="text-sm text-gray-500">Question {currentQuizIndex + 1} of 10</div>
                  </div>
                  {currentQuizQuestion && (
                    <>
                      <div className="mb-6">
                        <p className="text-lg text-gray-700 mb-4">{currentQuizQuestion.question}</p>
                        <input
                          type="text"
                          value={quizAnswer}
                          onChange={(e) => setQuizAnswer(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter your answer"
                          disabled={quizSubmitted}
                        />
                      </div>
                      {quizShowHint && (
                        <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 rounded-lg">
                          <strong>Hint:</strong> {currentQuizQuestion.hint}
                        </div>
                      )}
                      {quizIsCorrect !== null && (
                        <div className={`p-4 rounded-lg mb-4 ${quizIsCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {quizIsCorrect ? 'Correct!' : `Incorrect. The answer is ${currentQuizQuestion.correct_answer}`}
                        </div>
                      )}
                      <div className="flex justify-between">
                        {!quizSubmitted ? (
                          <>
                            <button onClick={submitQuizAnswer} className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">Submit</button>
                            <button onClick={showQuizHint} className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600">Hint</button>
                          </>
                        ) : (
                          <button onClick={nextQuizQuestion} className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600">Next</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 text-center">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Quiz Completed!</h2>
                  <p className="text-gray-600">You have finished the final quiz for this chapter.</p>
                  <button onClick={() => setView('home')} className="mt-6 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">Back to Home</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
