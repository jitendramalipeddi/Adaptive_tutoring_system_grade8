import { PolyaStep, Problem } from "../types";

// No external API required for static deployment in Vercel.
// The app uses local mock problems and local content in `src/data`.

const MOCK_PROBLEMS: Record<string, Problem> = {
  "ratios_percentages": {
    problem_id: "mock_1",
    question: "A shopkeeper sells a bag for $120, which is 20% more than the cost price. What was the cost price of the bag?",
    hints: ["Think about what 100% represents.", "If 120% is $120, what is 1%?"],
    correct_answer: "$100",
    difficulty: 0.4
  },
  "direct_proportion": {
    problem_id: "mock_2",
    question: "If 5 kg of sugar costs $25, how much will 12 kg of sugar cost?",
    hints: ["Find the cost of 1 kg first.", "Multiply the cost per kg by 12."],
    correct_answer: "$60",
    difficulty: 0.3
  }
};

const DEFAULT_MOCK_PROBLEM: Problem = {
  problem_id: "mock_default",
  question: "A car travels 150 km in 3 hours. How far will it travel in 5 hours at the same speed?",
  hints: ["Calculate the speed first (Distance / Time).", "Multiply the speed by the new time."],
  correct_answer: "250 km",
  difficulty: 0.4
};

const SYSTEM_INSTRUCTION = `
You are an expert Math Tutor for Grade 8 students. 
Your goal is to guide students through math problems using George Polya's four-step problem-solving method:
1. Understand the Problem: Identify the unknown, the data, and the condition.
2. Devise a Plan: Find the connection between the data and the unknown. Suggest strategies like drawing a diagram, looking for a pattern, or using a formula.
3. Carry out the Plan: Solve the problem step-by-step.
4. Look Back: Verify the solution and reflect on the method.

CRITICAL RULES:
- Never give the final answer directly.
- Use scaffolding: ask leading questions to help the student reach the next step.
- If the student is stuck, provide a small hint.
- Be encouraging and patient.
- Keep explanations simple and suitable for an 8th grader.
- Use LaTeX for mathematical expressions (e.g., $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$).
- Focus on the chapters: "Comparing Quantities" (Ratios, Percentages, Profit/Loss, Interest) and "Direct and Inverse Proportions".

When a new problem is started, begin with Step 1: Understand the Problem.
`;

export async function generateProblem(chapter: string, subtopic: string): Promise<Problem> {
  // Use local mock content for static deployment.
  const problem = MOCK_PROBLEMS[subtopic] || DEFAULT_MOCK_PROBLEM;
  return {
    ...problem,
    problem_id: problem.problem_id || `mock_${subtopic}_${Date.now()}`,
  };
}

export async function getTutoringResponse(
  problem: Problem,
  step: PolyaStep,
  history: { role: 'user' | 'model'; text: string }[],
  userInput: string
) {
  // Simple deterministic mock response for client-only deployment.
  return `[MOCK TUTOR] Great progress! You are on **${step}**. Based on your input "${userInput}", try to connect it to the problem: "${problem.question.substring(0, 50)}..." and explain your next step.`;
}

export async function generateMCQOptions(question: string, correctAnswer: string) {
  // Static mock distractors for Vercel static deployment.
  return [correctAnswer, "Option B", "Option C", "Option D"].sort(() => Math.random() - 0.5);
}
