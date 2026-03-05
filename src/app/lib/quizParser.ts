export interface ParsedQuestion {
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  points: number;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  title?: string;
  errors: string[];
}

/**
 * Parse quiz content from various formats and auto-generate questions
 */
export function parseQuizContent(content: string): ParseResult {
  const errors: string[] = [];
  const questions: ParsedQuestion[] = [];
  let title: string | undefined;

  try {
    // Clean up content
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
      errors.push('No content found');
      return { questions, errors, title };
    }

    // Try to extract title (first line if it looks like a title)
    if (lines[0] && !lines[0].startsWith('-') && !lines[0].match(/^\d+\./)) {
      title = lines[0].replace(/^#+\s*/, '').trim();
    }

    // Parse markdown-style quiz format (like the uploaded file)
    const markdownQuestions = parseMarkdownFormat(lines);
    if (markdownQuestions.length > 0) {
      questions.push(...markdownQuestions);
      return { questions, errors, title };
    }

    // Parse plain text Q&A format
    const plainTextQuestions = parsePlainTextFormat(lines);
    if (plainTextQuestions.length > 0) {
      questions.push(...plainTextQuestions);
      return { questions, errors, title };
    }

    // Parse numbered list format
    const numberedQuestions = parseNumberedFormat(lines);
    if (numberedQuestions.length > 0) {
      questions.push(...numberedQuestions);
      return { questions, errors, title };
    }

    errors.push('Could not parse quiz format. Please check the format and try again.');
  } catch (error) {
    errors.push(`Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { questions, errors, title };
}

/**
 * Parse markdown-style format with bullets and checkmarks
 * Example:
 * - What is 2+2?
 * - 3
 * - 4 ✅
 * - 5
 */
function parseMarkdownFormat(lines: string[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let currentQuestion: string | null = null;
  let currentOptions: string[] = [];
  let correctAnswer: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip title or empty lines
    if (!line.startsWith('-')) {
      // Save previous question if exists
      if (currentQuestion && currentOptions.length > 0 && correctAnswer) {
        questions.push(createQuestion(currentQuestion, currentOptions, correctAnswer));
        currentQuestion = null;
        currentOptions = [];
        correctAnswer = null;
      }
      continue;
    }

    const content = line.substring(1).trim();
    const hasCheckmark = content.includes('✅') || content.includes('✓') || content.includes('[x]');

    // Determine if this is a question or an option
    if (currentOptions.length === 0 && !hasCheckmark) {
      // Save previous question if exists
      if (currentQuestion && correctAnswer) {
        questions.push(createQuestion(currentQuestion, currentOptions, correctAnswer));
        currentOptions = [];
        correctAnswer = null;
      }
      // This is a new question
      currentQuestion = content.replace(/\?$/, '').trim() + '?';
    } else {
      // This is an option
      const cleanOption = content
        .replace(/✅|✓|\[x\]/g, '')
        .trim();
      
      currentOptions.push(cleanOption);
      
      if (hasCheckmark) {
        correctAnswer = cleanOption;
      }
    }
  }

  // Add last question
  if (currentQuestion && currentOptions.length > 0 && correctAnswer) {
    questions.push(createQuestion(currentQuestion, currentOptions, correctAnswer));
  }

  return questions;
}

/**
 * Parse plain text Q&A format
 * Example:
 * Q: What is the capital of France?
 * A: Paris
 */
function parsePlainTextFormat(lines: string[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let currentQuestion: string | null = null;

  for (const line of lines) {
    // Question pattern
    if (line.match(/^(Q:|Question:|What|Who|When|Where|Why|How|Is|Are|Do|Does|Can|Will)/i)) {
      currentQuestion = line.replace(/^(Q:|Question:)\s*/i, '').trim();
      if (!currentQuestion.endsWith('?')) {
        currentQuestion += '?';
      }
    }
    // Answer pattern
    else if (currentQuestion && line.match(/^(A:|Answer:)/i)) {
      const answer = line.replace(/^(A:|Answer:)\s*/i, '').trim();
      
      // Detect if it's true/false
      if (isTrueFalseAnswer(answer)) {
        questions.push({
          type: 'true-false',
          question: currentQuestion,
          options: ['True', 'False'],
          correctAnswer: answer.toLowerCase().includes('true') || answer.toLowerCase() === 'yes' ? 'True' : 'False',
          points: 1,
        });
      } else {
        // Short answer
        questions.push({
          type: 'short-answer',
          question: currentQuestion,
          correctAnswer: answer,
          points: 1,
        });
      }
      
      currentQuestion = null;
    }
  }

  return questions;
}

/**
 * Parse numbered format
 * Example:
 * 1. What is 2+2?
 * a) 3
 * b) 4 *
 * c) 5
 */
function parseNumberedFormat(lines: string[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let currentQuestion: string | null = null;
  let currentOptions: string[] = [];
  let correctAnswer: string | null = null;

  for (const line of lines) {
    // Question pattern (numbered)
    if (line.match(/^\d+[\.)]\s/)) {
      // Save previous question
      if (currentQuestion) {
        if (currentOptions.length > 0 && correctAnswer) {
          questions.push(createQuestion(currentQuestion, currentOptions, correctAnswer));
        } else if (currentOptions.length === 0) {
          // Short answer question
          questions.push({
            type: 'short-answer',
            question: currentQuestion,
            correctAnswer: '',
            points: 1,
          });
        }
      }

      currentQuestion = line.replace(/^\d+[\.)]\s/, '').trim();
      if (!currentQuestion.endsWith('?')) {
        currentQuestion += '?';
      }
      currentOptions = [];
      correctAnswer = null;
    }
    // Option pattern (a), b), etc.)
    else if (currentQuestion && line.match(/^[a-z][\)\.]\s/i)) {
      const hasMarker = line.includes('*') || line.includes('✅') || line.includes('✓') || line.includes('[x]');
      const cleanOption = line
        .replace(/^[a-z][\)\.]\s/i, '')
        .replace(/\*|✅|✓|\[x\]/g, '')
        .trim();
      
      currentOptions.push(cleanOption);
      
      if (hasMarker) {
        correctAnswer = cleanOption;
      }
    }
  }

  // Add last question
  if (currentQuestion) {
    if (currentOptions.length > 0 && correctAnswer) {
      questions.push(createQuestion(currentQuestion, currentOptions, correctAnswer));
    } else if (currentOptions.length === 0) {
      questions.push({
        type: 'short-answer',
        question: currentQuestion,
        correctAnswer: '',
        points: 1,
      });
    }
  }

  return questions;
}

/**
 * Create a question object with intelligent type detection
 */
function createQuestion(
  question: string,
  options: string[],
  correctAnswer: string
): ParsedQuestion {
  // Detect true/false questions
  if (isTrueFalseQuestion(question, options)) {
    return {
      type: 'true-false',
      question,
      options: ['True', 'False'],
      correctAnswer: normalizeToTrueFalse(correctAnswer),
      points: 1,
    };
  }

  // Multiple choice
  if (options.length >= 2) {
    return {
      type: 'multiple-choice',
      question,
      options,
      correctAnswer,
      points: 1,
    };
  }

  // Short answer
  return {
    type: 'short-answer',
    question,
    correctAnswer,
    points: 1,
  };
}

/**
 * Check if this is a true/false question
 */
function isTrueFalseQuestion(question: string, options: string[]): boolean {
  if (options.length !== 2) return false;
  
  const optionsLower = options.map(o => o.toLowerCase().trim());
  
  // Check for true/false
  if (
    (optionsLower.includes('true') && optionsLower.includes('false')) ||
    (optionsLower.includes('yes') && optionsLower.includes('no'))
  ) {
    return true;
  }

  return false;
}

/**
 * Check if an answer is true/false
 */
function isTrueFalseAnswer(answer: string): boolean {
  const answerLower = answer.toLowerCase().trim();
  return ['true', 'false', 'yes', 'no'].includes(answerLower);
}

/**
 * Normalize answer to True/False
 */
function normalizeToTrueFalse(answer: string): string {
  const answerLower = answer.toLowerCase().trim();
  if (answerLower === 'true' || answerLower === 'yes') return 'True';
  if (answerLower === 'false' || answerLower === 'no') return 'False';
  return answer;
}

/**
 * Generate AI-like questions from plain content (for future enhancement)
 */
export function generateQuestionsFromContent(content: string): ParsedQuestion[] {
  // This is a placeholder for AI-powered question generation
  // In a real app, this would call an AI API to generate questions
  
  const questions: ParsedQuestion[] = [];
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  // Generate simple questions from sentences (mock AI)
  for (const sentence of sentences.slice(0, 5)) {
    // Extract key facts and create questions
    const words = sentence.split(' ');
    if (words.length > 5) {
      questions.push({
        type: 'short-answer',
        question: `What can you tell me about: ${sentence.substring(0, 50)}...?`,
        correctAnswer: sentence,
        points: 1,
      });
    }
  }

  return questions;
}
