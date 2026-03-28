import { GoogleGenAI } from "@google/genai";
import { PolyaStep, Problem } from "../types";

const API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

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
  if (!API_KEY) {
    console.warn("No Gemini API key found. Using mock problem.");
    return MOCK_PROBLEMS[subtopic] || DEFAULT_MOCK_PROBLEM;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a Grade 8 math problem for the chapter "${chapter}" and subtopic "${subtopic}". 
      Return it in JSON format: { "problem_id": "uuid", "question": "problem text", "hints": ["hint 1", "hint 2"], "correct_answer": "final answer", "difficulty": 0.5 }`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data;
  } catch (error) {
    console.error("Gemini API error:", error);
    return MOCK_PROBLEMS[subtopic] || DEFAULT_MOCK_PROBLEM;
  }
}

export async function getTutoringResponse(
  problem: Problem,
  step: PolyaStep,
  history: { role: 'user' | 'model'; text: string }[],
  userInput: string
) {
  if (!API_KEY) {
    return `[MOCK TUTOR] That's a great start! You're currently in the **${step}** phase. 
    Based on what you said: "${userInput}", think about how it relates to the problem: "${problem.question.substring(0, 50)}...". 
    What do you think the next logical step should be?`;
  }

  const hintsPrompt = problem.hints.length > 0 
    ? `\n\n**Available Hints:**\n- ${problem.hints.join('\n- ')}`
    : '';

  const contents = [
    { role: 'user', parts: [{ text: `Problem: ${problem.question}${hintsPrompt}` }] },
    ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: `Current Polya Step: ${step}. Student says: ${userInput}` }] }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents as any,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API error:", error);
    return "I'm having a bit of trouble connecting to my brain right now. Could you try rephrasing that, or let's try another step?";
  }
}

export async function generateMCQOptions(question: string, correctAnswer: string) {
  if (!API_KEY) {
    return [correctAnswer, "Option B", "Option C", "Option D"].sort(() => Math.random() - 0.5);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 3 plausible but incorrect distractors for the following question and answer. 
      Question: ${question}
      Correct Answer: ${correctAnswer}
      Return only the 3 distractors separated by commas.`,
    });
    const distractors = response.text.split(',').map(s => s.trim());
    return [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
  } catch (error) {
    console.error("Gemini API error:", error);
    return [correctAnswer, "Option B", "Option C", "Option D"].sort(() => Math.random() - 0.5);
  }
}
