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
import { sendRecommendation, retrySavedRecommendation, RecommendationResponse } from './services/recommendation';
import { useSessionParams } from './hooks/useSession';
import RecommendationResult from './components/RecommendationResult';
import localContent from './data/content.json';
import learningMaterial from './data/learning_material.json';
import remedialContent from './data/remedial_content.json';
import poolOfQuestions from './data/pool_of_questions.json';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [view, setView] = useState<'home' | 'chapter' | 'learning' | 'tutoring' | 'summary' | 'history' | 'quiz' | 'pretest' | 'recommendation'>('home');
  const [lastPayload, setLastPayload] = useState<SessionInteractionPayload | null>(null);
  const [recommendationResult, setRecommendationResult] = useState<RecommendationResponse | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const sessionParams = useSessionParams();
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
  const [completedSubtopics, setCompletedSubtopics] = useState<Set<string>>(new Set());
  const [currentQuestionCorrect, setCurrentQuestionCorrect] = useState(false);

  const [pretestQuestions, setPretestQuestions] = useState<Problem[]>([]);
  const [currentPretestIndex, setCurrentPretestIndex] = useState(0);
  const [pretestAnswer, setPretestAnswer] = useState('');
  const [pretestIsCorrect, setPretestIsCorrect] = useState<boolean | null>(null);
  const [pretestSubmitted, setPretestSubmitted] = useState(false);
  const [pretestScore, setPretestScore] = useState(0);
  const [pretestCompleted, setPretestCompleted] = useState(false);
  const [showQuestionCheer, setShowQuestionCheer] = useState(false);
  const [masteredConceptMessage, setMasteredConceptMessage] = useState('');
  const [explanationUsedForCurrentProblem, setExplanationUsedForCurrentProblem] = useState(false);
  const [isSimilarQuestion, setIsSimilarQuestion] = useState(false);
  const [stepMcq, setStepMcq] = useState<{ options: string[]; correct: string; selected: string | null; submitted: boolean } | null>(null);
  const [showSimilarPrompt, setShowSimilarPrompt] = useState(false);
  const [subtopicReviewRecommendations, setSubtopicReviewRecommendations] = useState<Record<string, boolean>>({});
  const [isShowingRemedial, setIsShowingRemedial] = useState(false);
  const [showRemedialPrompt, setShowRemedialPrompt] = useState(false);
  const [remedialExercises, setRemedialExercises] = useState<string[]>([]);
  const [questionCompleted, setQuestionCompleted] = useState<Set<string>>(new Set());
  const [similarAttempted, setSimilarAttempted] = useState<Set<string>>(new Set());
  const [pretestTaken, setPretestTaken] = useState<Set<string>>(new Set());
  const [subtopicProgress, setSubtopicProgress] = useState<Record<string, number>>({});
  const [subtopicCorrectCount, setSubtopicCorrectCount] = useState<Record<string, number>>({});
  
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

  const buildStepMcq = (stepText: string, correctAnswer: string) => {
    // Generate 3 plausible wrong options by slightly altering the correct answer
    const distractors: string[] = [];
    const num = parseFloat(correctAnswer.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) {
      const prefix = correctAnswer.replace(/[0-9.]+/, '').trim();
      distractors.push(`${prefix}${(num * 1.1).toFixed(num % 1 !== 0 ? 2 : 0)}`.trim());
      distractors.push(`${prefix}${(num * 0.9).toFixed(num % 1 !== 0 ? 2 : 0)}`.trim());
      distractors.push(`${prefix}${(num + Math.ceil(num * 0.2)).toFixed(0)}`.trim());
    } else {
      distractors.push('I am not sure', 'None of the above', 'Cannot be determined');
    }
    const options = [correctAnswer, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
    return { options, correct: correctAnswer, selected: null, submitted: false };
  };

  const generateSimilarProblem = (problem: Problem): Problem => {
    let question = problem.question;
    let answer = problem.correct_answer;
    const numbers = question.match(/\d+(?:\.\d+)?/g);

    if (numbers && numbers.length) {
      let i = 0;
      question = question.replace(/\d+(?:\.\d+)?/g, (match) => {
        const num = parseFloat(match);
        const next = num + Math.floor(Math.random() * 4 + 1);
        i += 1;
        return `${next}`;
      });
      if (/^-?\d+(?:\.\d+)?$/.test(problem.correct_answer.trim())) {
        const ansNum = parseFloat(problem.correct_answer);
        answer = `${ansNum + Math.floor(Math.random() * 4 + 1)}`;
      }
    } else {
      question = `${question} (similar variation)`;
    }

    return {
      ...problem,
      problem_id: `${problem.problem_id}_sim_${Date.now()}`,
      question,
      correct_answer: answer,
      options: problem.options ? [...problem.options] : undefined,
      hints: problem.hints ? problem.hints.map((h) => `${h} (use previous strategy)`) : []
    };
  };

  const startChapter = (chapter: ChapterMetadata) => {
    const chapterData = (localContent as unknown as ChapterContent[]).find(c => c.chapter_id === chapter.chapter_id);
    const totalQuestions = chapterData?.subtopics.reduce((acc, sub) => acc + sub.problems.length, 0) || 0;

    const shouldRunPretest = !pretestTaken.has(chapter.chapter_id);
    if (shouldRunPretest) {
      const flatProblems = chapterData?.subtopics.flatMap(s => s.problems) || [];
      const pretest = flatProblems.slice(0, 3).map((p, idx) => ({ ...p, problem_id: `pretest_${p.problem_id}_${idx}` }));
      setPretestQuestions(pretest);
      setCurrentPretestIndex(0);
      setPretestAnswer('');
      setPretestIsCorrect(null);
      setPretestSubmitted(false);
      setPretestScore(0);
      setPretestCompleted(false);
      setView('pretest');
    }

    setState(prev => ({
      ...prev,
      currentChapter: chapter,
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      totalChapterQuestions: totalQuestions,
      metrics: { ...prev.metrics, startTime: Date.now() }
    }));
    setReadSubtopics(new Set());
    setCompletedSubtopics(new Set());
    setSessionSubtopicPerformances([]);
    setCurrentQuestionCorrect(false);
    if (!shouldRunPretest) {
      setView('chapter');
    }
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

  const QUIZ_QUESTION_LIMIT = 10;

  const nextQuizQuestion = () => {
    if (!currentQuizQuestion) return;

    const newUsed = new Set(usedQuestions).add(currentQuizQuestion.problem_id);
    setUsedQuestions(newUsed);

    if (newUsed.size >= QUIZ_QUESTION_LIMIT || newUsed.size >= quizQuestions.length) {
      // Final assessment done, complete chapter
      finishChapter();
      return;
    }

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

  const shouldShowRemedial = (subtopicId: string) => {
    // Check if student has attempted this subtopic and performed poorly
    const subtopicPerformances = sessionSubtopicPerformances.filter(p => p.subtopic_id === subtopicId);
    if (subtopicPerformances.length === 0) return false;
    
    // Check if the latest performance shows poor understanding
    const latestPerformance = subtopicPerformances[subtopicPerformances.length - 1];
    return latestPerformance.expertise_level === 'novice' || latestPerformance.questions.some(q => !q.correct);
  };

  const showLearningMaterial = (subtopic: Subtopic) => {
    const chapterData = (localContent as unknown as ChapterContent[]).find(c => c.chapter_id === state.currentChapter?.chapter_id);
    const subtopicData = chapterData?.subtopics.find(s => s.subtopic_id === subtopic.subtopic_id);
    
    // Check if remedial content should be shown
    const needsRemedial = shouldShowRemedial(subtopic.subtopic_id);
    
    let contentToShow;
    
    if (needsRemedial) {
      // Find remedial content
      const remedialChapter = (remedialContent as any).find((c: any) => c.chapter_id === state.currentChapter?.chapter_id);
      const remedialSubtopic = remedialChapter?.subtopics.find((s: any) => s.subtopic_id === subtopic.subtopic_id);
      
      if (remedialSubtopic) {
        contentToShow = {
          ...subtopicData,
          learning_material: remedialSubtopic.remedial_content,
          story_hook: `🔄 **Remedial Learning: ${remedialSubtopic.remedial_title}**\n\nIt looks like you need some extra help with this topic. Don't worry - we'll go through it step by step with simpler explanations and more examples!`
        };
        setIsShowingRemedial(true);
        setRemedialExercises(remedialSubtopic.remedial_exercises || []);
      } else {
        // Fallback to regular content if remedial not available
        const materialChapter = (learningMaterial as any).find((c: any) => c.chapter_id === state.currentChapter?.chapter_id);
        const materialSubtopic = materialChapter?.subtopics.find((s: any) => s.subtopic_id === subtopic.subtopic_id);
        
        contentToShow = subtopicData ? {
          ...subtopicData,
          learning_material: materialSubtopic?.learning_material || subtopicData.learning_material,
          story_hook: materialSubtopic?.story_hook
        } : null;
        setIsShowingRemedial(false);
        setRemedialExercises([]);
      }
    } else {
      // Show regular content
      const materialChapter = (learningMaterial as any).find((c: any) => c.chapter_id === state.currentChapter?.chapter_id);
      const materialSubtopic = materialChapter?.subtopics.find((s: any) => s.subtopic_id === subtopic.subtopic_id);
      
      contentToShow = subtopicData ? {
        ...subtopicData,
        learning_material: materialSubtopic?.learning_material || subtopicData.learning_material,
        story_hook: materialSubtopic?.story_hook
      } : null;
      setIsShowingRemedial(false);
      setRemedialExercises([]);
    }

    setCurrentContent(contentToShow || null);
    const resumeProblemIndex = subtopicProgress[subtopic.subtopic_id] ?? 0;
    setCurrentProblemIndex(resumeProblemIndex);
    setState(prev => ({ ...prev, currentSubtopic: subtopic }));

    if (explanationUsedForCurrentProblem) {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'model', text: 'You already used explanations on the previous question. Now try to solve directly without hints. Want to try some remedial content for a simpler explanation of this topic?' }]
      }));
      setExplanationUsedForCurrentProblem(false);
    }

    setLearningStep(contentToShow?.story_hook ? 'story' : 'material');
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
    console.log('Starting tutoring with problemIdx:', problemIdx);
    
    setIsTyping(true);
    setIsWrong(false);
    setExplanationShown(false);
    setShowHint(false);
    setCurrentQuestionCorrect(false);
    setStepMcq(null);
    setShowSimilarPrompt(false);
    setShowRemedialPrompt(false);
    try {
      // If we're starting tutoring from learning material, record reading time
      if (readingStartTime && currentSubtopicPerformance) {
        const readingTime = Math.floor((Date.now() - readingStartTime) / 1000);
        setCurrentSubtopicPerformance(prev => prev ? { ...prev, reading_time_seconds: readingTime } : null);
        setReadingStartTime(null);
      }
      let problem: Problem | null = null;
      
      const chapterData = (localContent as unknown as ChapterContent[]).find(c => c.chapter_id === state.currentChapter?.chapter_id);
      console.log('Chapter data found:', !!chapterData);
      
      const subtopicData = chapterData?.subtopics.find(s => s.subtopic_id === state.currentSubtopic?.subtopic_id);
      console.log('Subtopic data found:', !!subtopicData);
      console.log('Subtopic problems length:', subtopicData?.problems?.length);
      
      if (subtopicData && subtopicData.problems.length > problemIdx) {
        problem = { ...subtopicData.problems[problemIdx] };
        console.log('Using local problem:', problem.problem_id);
        
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
        console.log('Falling back to generated problem');
        // Fallback to Gemini generation
        const generated = await generateProblem(state.currentChapter!.chapter_name, state.currentSubtopic!.name);
        problem = {
          problem_id: generated.problem_id,
          question: generated.question,
          hints: generated.hints || [],
          correct_answer: generated.correct_answer,
          difficulty: generated.difficulty
        };
        console.log('Generated problem:', problem.problem_id);
      }

      if (!problem) {
        console.error('No problem could be loaded');
        // If still no problem, show error
        setState(prev => ({
          ...prev,
          messages: [{ role: 'model', text: 'Sorry, I couldn\'t load a problem right now. Please try again or contact support.' }]
        }));
        setView('tutoring');
        return;
      }

      console.log('Setting problem and view to tutoring');
      setExplanationUsedForCurrentProblem(false);
      setState(prev => ({
        ...prev,
        currentProblem: problem,
        currentStep: 'QUESTION_ATTEMPT',
        isAnswered: false,
        hintIndex: -1,
        messages: [{ role: 'model', text: `Here is your problem:\n\n**Problem:** ${problem.question}\n\nTry to solve it directly! What is the answer?` }],
        metrics: { ...prev.metrics, attempts: prev.metrics.attempts + 1 }
      }));
      setView('tutoring');
      setQuestionStartTime(Date.now());
    } catch (error) {
      console.error("Failed to start tutoring:", error);
      setState(prev => ({
        ...prev,
        messages: [{ role: 'model', text: 'An error occurred while starting the tutoring session. Please try again.' }]
      }));
      setView('tutoring');
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

  const submitPretestAnswer = () => {
    const question = pretestQuestions[currentPretestIndex];
    if (!question) return;

    const isCorrect = pretestAnswer.trim().toLowerCase().includes(question.correct_answer.toLowerCase().trim());
    setPretestIsCorrect(isCorrect);
    setPretestSubmitted(true);

    if (isCorrect) {
      setPretestScore(prev => prev + 1);
      setQuestionCompleted(prev => new Set(prev).add(question.problem_id));
      setShowQuestionCheer(true);
      setTimeout(() => setShowQuestionCheer(false), 1600);
    }
  };

  const advancePretest = () => {
    const nextIndex = currentPretestIndex + 1;
    if (nextIndex < pretestQuestions.length) {
      setCurrentPretestIndex(nextIndex);
      setPretestAnswer('');
      setPretestIsCorrect(null);
      setPretestSubmitted(false);
    } else {
      setPretestCompleted(true);
      // Mark pretest as taken for this chapter
      const newPretestTaken = new Set(pretestTaken).add(state.currentChapter!.chapter_id);
      setPretestTaken(newPretestTaken);
      localStorage.setItem('polya_pretest_taken', JSON.stringify([...newPretestTaken]));
      setView('chapter');
    }
  };

  const startSimilarQuestionForCurrent = () => {
    if (!state.currentProblem) return;
    const similar = generateSimilarProblem(state.currentProblem);
    setState(prev => ({
      ...prev,
      currentProblem: similar,
      currentStep: 'QUESTION_ATTEMPT',
      isAnswered: false,
      hintIndex: -1,
      messages: [{ role: 'model', text: `Hey buddy, now you know how to solve it, give it a try for this new problem:\n\n**Problem:** ${similar.question}\n\nTry to solve it directly!` }],
      metrics: { ...prev.metrics, attempts: prev.metrics.attempts + 1 }
    }));
    setIsSimilarQuestion(true);
    setCurrentQuestionCorrect(false);
    setExplanationShown(false);
    setCurrentExplanationStep(0);
    setIsWrong(false);
    setQuestionStartTime(Date.now());
    setSimilarAttempted(prev => new Set(prev).add(state.currentProblem!.problem_id));
  };


  const nextQuestion = () => {
    if (!currentQuestionCorrect) {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'model', text: 'Please answer the current question correctly before moving to the next one.' }]
      }));
      return;
    }

    const nextIdx = currentProblemIndex + 1;
    
    const chapterData = (localContent as unknown as ChapterContent[]).find(c => c.chapter_id === state.currentChapter?.chapter_id);
    const subtopicData = chapterData?.subtopics.find(s => s.subtopic_id === state.currentSubtopic?.subtopic_id);
    
    if (subtopicData && nextIdx < subtopicData.problems.length) {
      setCurrentProblemIndex(nextIdx);
      setIsWrong(false);
      setExplanationShown(false);
      setCurrentExplanationStep(0);
      setShowHint(false);
      setCurrentQuestionCorrect(false);
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
    setStepMcq(null);
    setShowRemedialPrompt(false);
    setState(prev => ({
      ...prev,
      isAnswered: false,
      messages: [...prev.messages, { role: 'model', text: "Sure, try again! What's your answer?" }],
      metrics: { ...prev.metrics, retries: prev.metrics.retries + 1 }
    }));
  };

  const showExplanation = () => {
    setExplanationShown(true);
    setExplanationUsedForCurrentProblem(true);
    setCurrentExplanationStep(1);
    setStepMcq(null);
    setShowSimilarPrompt(false);
    const polya = state.currentProblem?.polya_steps;
    const stepText = polya
      ? `**Step 1: Understand the Problem**\n\n${polya.understand}`
      : "Let's break it down using Polya's method.\n\n**Step 1: Understand the Problem.** What information do we have?";

    const mcqCorrect = polya?.understand
      ? polya.understand.split('.')[0].trim()
      : state.currentProblem?.correct_answer ?? 'Understood';
    setStepMcq(buildStepMcq(mcqCorrect, mcqCorrect));

    setState(prev => ({
      ...prev,
      currentStep: 'UNDERSTAND',
      messages: [...prev.messages, { role: 'model', text: stepText }]
    }));
  };

  const completeExplanationAndPromptSimilar = () => {
    if (!state.currentProblem) return;
    setShowSimilarPrompt(false);
    setState(prev => ({
      ...prev,
      messages: [...prev.messages,
        { role: 'model', text: '🎓 **Great work!** You have learned how to solve this problem using **Polya\'s 4-Step Problem Solving Approach**:\n\n1. **Understand** – Identify what is given and what is asked\n2. **Plan** – Choose a strategy\n3. **Solve** – Carry out the plan\n4. **Review** – Verify the answer\n\nNow let\'s see if you can apply this on your own!' },
      ]
    }));
    setTimeout(() => {
      startSimilarQuestionForCurrent();
    }, 300);
  };

  const nextExplanationStep = () => {
    const nextStep = currentExplanationStep + 1;
    if (nextStep > 4) {
      completeExplanationAndPromptSimilar();
      return;
    }

    setCurrentExplanationStep(nextStep);
    setStepMcq(null);
    const polya = state.currentProblem?.polya_steps;
    if (!polya) return;

    let text = "";
    let stepName: PolyaStep = 'UNDERSTAND';
    let mcqCorrect = state.currentProblem?.correct_answer ?? '';

    switch(nextStep) {
      case 2:
        text = `**Step 2: Devise a Plan**\n\n${polya.plan}`;
        stepName = 'PLAN';
        mcqCorrect = polya.plan.split('.')[0].trim();
        break;
      case 3:
        text = `**Step 3: Carry Out the Plan**\n\n${polya.solve}`;
        stepName = 'SOLVE';
        mcqCorrect = state.currentProblem?.correct_answer ?? polya.solve.split('.')[0].trim();
        break;
      case 4:
        text = `**Step 4: Look Back (Review)**\n\n${polya.review}\n\nThe correct answer is: **${state.currentProblem?.correct_answer}**`;
        stepName = 'REVIEW';
        mcqCorrect = state.currentProblem?.correct_answer ?? polya.review.split('.')[0].trim();
        break;
    }

    setState(prev => ({
      ...prev,
      currentStep: stepName,
      messages: [...prev.messages, { role: 'model', text }]
    }));
    setStepMcq(buildStepMcq(mcqCorrect, mcqCorrect));
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
        const normalize = (text: string) => {
          const raw = text.toLowerCase().trim();
          const numeric = raw.replace(/[^0-9.]/g, '');
          return { raw, numeric };
        };

        const userNorm = normalize(currentInput);
        const correctNorm = normalize(state.currentProblem!.correct_answer);
        const isNumericMatch = userNorm.numeric && correctNorm.numeric && userNorm.numeric === correctNorm.numeric;
        const isTextMatch = userNorm.raw.includes(correctNorm.raw) || correctNorm.raw.includes(userNorm.raw);
        const isCorrect = isNumericMatch || isTextMatch;
        if (isCorrect) {
          setCurrentQuestionCorrect(true);
          setQuestionCompleted(prev => new Set(prev).add(state.currentProblem?.problem_id ?? ''));
          setShowQuestionCheer(true);
          setTimeout(() => setShowQuestionCheer(false), 1400);

          // Update subtopic progress
          if (state.currentSubtopic) {
            const subtopicId = state.currentSubtopic.subtopic_id;
            const newCorrectCount = (subtopicCorrectCount[subtopicId] || 0) + 1;
            setSubtopicCorrectCount(prev => ({
              ...prev,
              [subtopicId]: newCorrectCount
            }));

            // Calculate progress
            const chapterData = (localContent as unknown as ChapterContent[]).find(c => c.chapter_id === state.currentChapter?.chapter_id);
            const subtopicData = chapterData?.subtopics.find(s => s.subtopic_id === subtopicId);
            const totalQuestions = subtopicData?.problems.length || 1;
            const progress = Math.round((newCorrectCount / totalQuestions) * 100);
            setSubtopicProgress(prev => ({
              ...prev,
              [subtopicId]: progress
            }));

            // Save to localStorage
            localStorage.setItem('polya_subtopic_correct', JSON.stringify({
              ...subtopicCorrectCount,
              [subtopicId]: newCorrectCount
            }));
            localStorage.setItem('polya_subtopic_progress', JSON.stringify({
              ...subtopicProgress,
              [subtopicId]: progress
            }));

            // Check if subtopic is completed (all questions solved correctly)
            if (newCorrectCount >= totalQuestions) {
              setCompletedSubtopics(prev => new Set(prev).add(subtopicId));
            }
          }

          if (isSimilarQuestion) {
            setMasteredConceptMessage('You have mastered this concept');
            setTimeout(() => setMasteredConceptMessage(''), 2400);
            setIsSimilarQuestion(false);
          }

          if (explanationUsedForCurrentProblem && state.currentSubtopic) {
            setSubtopicReviewRecommendations(prev => ({
              ...prev,
              [state.currentSubtopic!.subtopic_id]: true
            }));
            setState(prev => ({
              ...prev,
              messages: [...prev.messages, { role: 'model', text: 'You solved this after using explanations, so we recommend revisiting the module for stronger mastery.' }]
            }));
          }

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

          if (explanationUsedForCurrentProblem && isSimilarQuestion && state.currentSubtopic) {
            // Recommending remedial content and learning material after failing the similar question
            setSubtopicReviewRecommendations(prev => ({
              ...prev,
              [state.currentSubtopic.subtopic_id]: true
            }));

            const remedialChapter = (remedialContent as any).find((c: any) => c.chapter_id === state.currentChapter?.chapter_id);
            const remedialSubtopic = remedialChapter?.subtopics.find((s: any) => s.subtopic_id === state.currentSubtopic.subtopic_id);

            if (remedialSubtopic) {
              setIsShowingRemedial(true);
              setRemedialExercises(remedialSubtopic.remedial_exercises || []);
            }

            setShowRemedialPrompt(true);
            setState(prev => ({
              ...prev,
              metrics: { ...prev.metrics, wrong: prev.metrics.wrong + 1 },
              messages: [...prev.messages,
                { role: 'model', text: "It looks like you're still finding this tricky even after the explanation. That's okay! 💡 We recommend going back to the **remedial material** to strengthen your foundation before trying again." },
              ]
            }));
          } else {
            setState(prev => ({
              ...prev,
              metrics: { ...prev.metrics, wrong: prev.metrics.wrong + 1 },
              messages: [...prev.messages, { role: 'model', text: "That's not quite right. Would you like to try again or see the step-by-step explanation?" }]
            }));
          }
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

    // Load pretest taken status
    const savedPretestTaken = localStorage.getItem('polya_pretest_taken');
    if (savedPretestTaken) {
      try {
        setPretestTaken(new Set(JSON.parse(savedPretestTaken)));
      } catch (e) {
        console.error("Failed to parse pretest taken", e);
      }
    }

    // Load subtopic progress
    const savedSubtopicProgress = localStorage.getItem('polya_subtopic_progress');
    if (savedSubtopicProgress) {
      try {
        setSubtopicProgress(JSON.parse(savedSubtopicProgress));
      } catch (e) {
        console.error("Failed to parse subtopic progress", e);
      }
    }

    // Load subtopic correct counts
    const savedSubtopicCorrect = localStorage.getItem('polya_subtopic_correct');
    if (savedSubtopicCorrect) {
      try {
        setSubtopicCorrectCount(JSON.parse(savedSubtopicCorrect));
      } catch (e) {
        console.error("Failed to parse subtopic correct counts", e);
      }
    }
  }, []);

  // Retry any pending recommendation from a previous failed network attempt
  useEffect(() => {
    if (!sessionParams.token) return;
    retrySavedRecommendation().then(result => {
      if (result) {
        setRecommendationResult(result);
      }
    });
  }, []);

  const exitAndSave = () => {
    if (!state.currentChapter) return;
    const timeSpent = Math.floor((Date.now() - state.metrics.startTime) / 1000);

    let finalSubtopicPerformances = [...sessionSubtopicPerformances];
    if (currentSubtopicPerformance && !finalSubtopicPerformances.find(p => p.subtopic_id === currentSubtopicPerformance.subtopic_id)) {
      const correctCount = currentSubtopicPerformance.questions.filter(q => q.is_correct && q.attempts === 1).length;
      const totalQ = currentSubtopicPerformance.questions.length;
      const ratio = totalQ > 0 ? correctCount / totalQ : 0;
      const avgHints = totalQ > 0 ? currentSubtopicPerformance.questions.reduce((acc, q) => acc + q.hints_used, 0) / totalQ : 0;
      let expertise: 'novice' | 'intermediate' | 'expert' = 'novice';
      if (ratio >= 0.8 && avgHints <= 0.5) expertise = 'expert';
      else if (ratio >= 0.5) expertise = 'intermediate';
      finalSubtopicPerformances.push({ ...currentSubtopicPerformance, expertise_level: expertise, last_attempt_timestamp: new Date().toISOString() });
    }

    const totalSubtopics = state.currentChapter.subtopics.length || 1;
    const topicCompletionRatio = finalSubtopicPerformances.length / totalSubtopics;

    const payload: SessionInteractionPayload = {
      student_id: sessionParams.student_id ?? 'student_123',
      session_id: sessionParams.session_id ?? state.sessionId,
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
      topic_completion_ratio: topicCompletionRatio,
    };

    const updatedHistory = [payload, ...sessionHistory].slice(0, 50);
    setSessionHistory(updatedHistory);
    localStorage.setItem('polya_session_history', JSON.stringify(updatedHistory));
    setLastPayload(payload);
    setCurrentSubtopicPerformance(null);
    setSessionSubtopicPerformances([]);
    setCompletionType('chapter');

    const token = sessionParams.token ?? 'default_token';
    setRecommendationLoading(true);
    setView('summary');
    sendRecommendation(payload, token)
      .then(result => {
        setRecommendationResult(result);
        setView('recommendation');
      })
      .catch(() => setView('summary'))
      .finally(() => setRecommendationLoading(false));
  };

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
      setCompletedSubtopics(prev => new Set(prev).add(finalPerformance.subtopic_id));
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
      student_id: sessionParams.student_id ?? "student_123", 
      session_id: sessionParams.session_id ?? state.sessionId,
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

    // Send to recommendation API
    const token = sessionParams.token ?? 'default_token';
    setRecommendationLoading(true);
    setView('summary');
    sendRecommendation(payload, token)
      .then(result => {
        setRecommendationResult(result);
        setView('recommendation');
      })
      .catch(() => setView('summary'))
      .finally(() => setRecommendationLoading(false));
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
      student_id: sessionParams.student_id ?? "student_123",
      session_id: sessionParams.session_id ?? state.sessionId,
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
    return state.currentChapter !== null && !['home', 'summary', 'history', 'quiz'].includes(view);
  };

  const chapterSubtopicCompletion = state.currentChapter ? state.currentChapter.subtopics.filter(sub => completedSubtopics.has(sub.subtopic_id)).length : 0;
  const chapterProgressRatio = state.currentChapter ? state.currentChapter.subtopics.reduce((acc, sub) => {
    const progress = subtopicProgress[sub.subtopic_id] || 0;
    return acc + (progress / 100);
  }, 0) / (state.currentChapter.subtopics.length || 1) : 0;

  // Handle beforeunload event - show confirmation when user tries to close tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSessionActive()) return;

      // Save session first (midway exit)
      endSessionMidway();

      // Set custom message for browser confirmation
      e.returnValue = 'Your progress will be saved. Are you sure you want to leave?';
      return 'Your progress will be saved. Are you sure you want to leave?';
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

          {view === 'pretest' && state.currentChapter && pretestQuestions.length > 0 && (
            <motion.div
              key="pretest"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-semibold">Pretest for {state.currentChapter.chapter_name}</h2>
                <p className="text-[#1A1A1A]/70">A quick diagnostic to personalize your learning path.</p>
                <p className="text-sm text-[#5A5A40]">{currentPretestIndex + 1} / {pretestQuestions.length}</p>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-[#1A1A1A]/10">
                <h3 className="text-xl font-semibold mb-4">{pretestQuestions[currentPretestIndex].question}</h3>
                <input
                  value={pretestAnswer}
                  onChange={(e) => setPretestAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitPretestAnswer()}
                  className="w-full p-3 border border-[#1A1A1A]/20 rounded-xl mb-4"
                  placeholder="Your answer"
                  disabled={pretestSubmitted}
                />
                {pretestSubmitted && (
                  <div className={`p-4 rounded-xl ${pretestIsCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {pretestIsCorrect ? 'Correct! Great start.' : `Incorrect. Correct answer: ${pretestQuestions[currentPretestIndex].correct_answer}.`}
                  </div>
                )}

                <div className="flex justify-between gap-3 mt-4">
                  <button
                    onClick={submitPretestAnswer}
                    disabled={pretestSubmitted}
                    className="flex-1 bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600"
                  >
                    Submit
                  </button>
                  <button
                    onClick={advancePretest}
                    disabled={!pretestSubmitted}
                    className="flex-1 bg-green-500 text-white p-3 rounded-xl hover:bg-green-600"
                  >
                    {currentPretestIndex < pretestQuestions.length - 1 ? 'Next' : 'Finish Pretest'}
                  </button>
                </div>
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
                          {completedSubtopics.has(sub.subtopic_id) && <CheckCircle2 size={16} className="text-green-500" />}
                          <span className="font-medium">{sub.name}</span>
                          {subtopicProgress[sub.subtopic_id] !== undefined && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              {subtopicProgress[sub.subtopic_id]}% complete
                            </span>
                          )}
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
                          {subtopicReviewRecommendations[sub.subtopic_id] && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-red-100 text-red-600">
                              Review Recommended
                            </span>
                          )}
                        </div>
                        <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5A5A40]" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-[32px] border border-[#1A1A1A]/5 space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Target size={20} />
                      Final Assessment
                    </h4>
                    {chapterProgressRatio >= 1 ? (
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
                          {Math.round(chapterProgressRatio * 100)}% of questions solved correctly
                        </div>
                      </div>
                    )}
                    {(state.metrics.attempts > 0 || readSubtopics.size > 0) && (
                      <button
                        onClick={exitAndSave}
                        className="w-full p-4 bg-red-50 text-red-600 border border-red-200 rounded-2xl font-semibold hover:bg-red-100 transition-colors text-sm"
                      >
                        Save Progress &amp; Exit
                      </button>
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
                        <span>{Math.round(chapterProgressRatio * 100)}%</span>
                      </div>
                      <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                        <div className="bg-white h-full" style={{ width: `${Math.round(chapterProgressRatio * 100)}%` }} />
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
                {isShowingRemedial && remedialExercises.length > 0 && (
                  <div className="mt-8 p-6 bg-blue-50 border border-blue-100 rounded-3xl">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                        <Target size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-900">Practice Exercises</h4>
                        <p className="text-sm text-blue-700">Try these exercises to reinforce your understanding:</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {remedialExercises.map((exercise, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-blue-100">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <p className="text-sm text-blue-900">{exercise}</p>
                        </div>
                      ))}
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
                      onClick={() => startTutoring(subtopicProgress[state.currentSubtopic?.subtopic_id ?? ''] ?? 0)}
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

          {view === 'tutoring' && (
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
                          "flex items-center justify-between gap-3 p-3 rounded-xl transition-all",
                          currentProblemIndex === idx ? "bg-[#5A5A40] text-white shadow-lg" : "opacity-40"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Target size={18} />
                          <span className="text-sm font-medium">Problem {idx + 1}</span>
                        </div>
                        {questionCompleted.has(prob.problem_id) && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600">Done</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={nextQuestion}
                    disabled={!currentQuestionCorrect}
                    className={cn(
                      "w-full p-4 border rounded-[24px] font-semibold flex items-center justify-center gap-2",
                      currentQuestionCorrect ? "bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:bg-[#F5F5F0]" : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    Next Question <ChevronRight size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      if (state.currentSubtopic) {
                        setSubtopicProgress(prev => ({
                          ...prev,
                          [state.currentSubtopic.subtopic_id]: currentProblemIndex,
                        }));
                      }
                      setView('chapter');
                    }}
                    className="w-full p-4 bg-[#F5F5F0] text-[#1A1A1A] rounded-[24px] font-semibold hover:bg-[#E4E3E0] transition-colors"
                  >
                    Go Back to Subtopics
                  </button>
                  <button 
                    onClick={finishChapter}
                    disabled={chapterProgressRatio < 1}
                    className={cn(
                      "w-full p-4 rounded-[24px] font-semibold transition-opacity",
                      chapterProgressRatio >= 1 ? "bg-[#1A1A1A] text-white hover:opacity-90" : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    Finish Session
                  </button>
                </div>
              </div>

              <div className="lg:col-span-3 bg-white rounded-[32px] border border-[#1A1A1A]/5 flex flex-col overflow-hidden shadow-sm">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <>
                    {state.messages.length > 0 ? (
                      <>
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
                                {msg.text}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                        
                        {showQuestionCheer && (
                          <div className="p-4 bg-green-100 border border-green-200 text-green-700 rounded-2xl text-center">
                            🎉 Great job! Question solved correctly.
                          </div>
                        )}

                        {masteredConceptMessage && (
                          <div className="p-4 bg-blue-100 border border-blue-200 text-blue-700 rounded-2xl text-center">
                            {masteredConceptMessage}
                          </div>
                        )}

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
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-4">
                            <Brain size={32} className="text-[#5A5A40]" />
                          </div>
                          <p className="text-[#1A1A1A]/60">Loading your problem...</p>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
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
                  ) : explanationShown && currentExplanationStep > 0 && currentExplanationStep <= 4 ? (
                    <div className="flex flex-col gap-3 max-w-4xl mx-auto">
                      {stepMcq && !stepMcq.submitted ? (
                        <>
                          <p className="text-sm font-semibold text-[#1A1A1A]/70 px-1">
                            {currentExplanationStep === 3
                              ? `Quick check: What is the answer to this problem?`
                              : `Quick check: Which best describes this step?`}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {stepMcq.options.map((opt, i) => (
                              <button
                                key={i}
                                onClick={() => setStepMcq(prev => prev ? { ...prev, selected: opt } : prev)}
                                className={cn(
                                  "p-3 rounded-xl border text-sm font-medium text-left transition-all",
                                  stepMcq.selected === opt
                                    ? "border-[#5A5A40] bg-[#5A5A40]/10"
                                    : "border-[#1A1A1A]/10 bg-white hover:bg-[#F5F5F0]"
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          <button
                            disabled={!stepMcq.selected}
                            onClick={() => {
                              if (!stepMcq?.selected) return;
                              setStepMcq(prev => prev ? { ...prev, submitted: true } : prev);
                            }}
                            className="p-3 bg-[#5A5A40] text-white rounded-xl font-semibold disabled:opacity-40"
                          >
                            Check Answer
                          </button>
                        </>
                      ) : stepMcq?.submitted ? (
                        <>
                          <div className={cn(
                            "p-3 rounded-xl text-sm font-medium",
                            stepMcq.selected === stepMcq.correct
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          )}>
                            {stepMcq.selected === stepMcq.correct
                              ? "✅ Correct! Great understanding."
                              : `❌ Not quite. The right answer is: ${stepMcq.correct}`}
                          </div>
                          <button
                            onClick={() => {
                              if (currentExplanationStep === 4) {
                                completeExplanationAndPromptSimilar();
                              } else {
                                nextExplanationStep();
                              }
                            }}
                            className="p-4 bg-[#5A5A40] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity"
                          >
                            {currentExplanationStep === 1 ? 'Next: Plan' :
                             currentExplanationStep === 2 ? 'Next: Solve' :
                             currentExplanationStep === 3 ? 'Next: Review' :
                             'Finish Explanation + Try Similar Problem'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            if (currentExplanationStep === 4) {
                              completeExplanationAndPromptSimilar();
                            } else {
                              nextExplanationStep();
                            }
                          }}
                          className="p-4 bg-[#5A5A40] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity"
                        >
                          {currentExplanationStep === 1 ? 'Next: Plan' :
                           currentExplanationStep === 2 ? 'Next: Solve' :
                           currentExplanationStep === 3 ? 'Next: Review' :
                           'Finish Explanation + Try Similar Problem'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {showRemedialPrompt && state.currentSubtopic && (
                        <div className="flex gap-3 max-w-4xl mx-auto">
                          <button
                            onClick={() => {
                              setShowRemedialPrompt(false);
                              if (state.currentSubtopic) showLearningMaterial(state.currentSubtopic);
                            }}
                            className="flex-1 p-4 bg-red-500 text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                          >
                            📚 Go Back to Remedial Material
                          </button>
                        </div>
                      )}
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
              {recommendationLoading && (
                <div className="text-center py-4 text-[#5A5A40] font-medium animate-pulse">
                  Analyzing your session and generating recommendations...
                </div>
              )}
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
              ) : currentQuizIndex < QUIZ_QUESTION_LIMIT ? (
                <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Final Quiz</h1>
                    <div className="text-sm text-gray-500">Question {currentQuizIndex + 1} of {QUIZ_QUESTION_LIMIT}</div>
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
                  <button onClick={() => finishChapter()} className="mt-6 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">Finish Chapter</button>
                </div>
              )}
            </motion.div>
          )}
          {view === 'recommendation' && recommendationResult && (
            <motion.div
              key="recommendation"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-3xl mx-auto"
            >
              <RecommendationResult
                result={recommendationResult}
                onHome={() => setView('home')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
