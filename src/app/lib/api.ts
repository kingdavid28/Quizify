import { supabase, hasSupabaseCredentials, API_URL } from './supabase';

export interface Question {
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  points?: number;
}

export interface QuizSettings {
  timeLimit: number | null;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showResults: boolean;
  passingScore: number;
}

export interface Quiz {
  id: string;
  userId: string;
  title: string;
  description: string;
  questions: Question[];
  settings: QuizSettings;
  createdAt: string;
  updatedAt: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userName: string;
  userEmail: string;
  answers: (string | number)[];
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  timeSpent: number;
  createdAt: string;
}

export interface QuizAnalytics {
  totalAttempts: number;
  averageScore: number;
  passRate: number;
  averageTimeSpent: number;
  questionStats: {
    questionIndex: number;
    questionText: string;
    correctPercentage: number;
    totalAnswered: number;
  }[];
  recentAttempts: QuizAttempt[];
}

// Database response types - no longer needed with HTTP API
// Keeping for reference but not used in new implementation

// Helper function to make API calls
const apiCall = async (
  method: string,
  endpoint: string,
  accessToken: string | undefined,
  body?: unknown
): Promise<unknown> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// Local storage fallback helpers
const localStorageAPI = {
  getQuizzes(userId: string): Quiz[] {
    const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
    return quizzes.filter((q: Quiz) => q.userId === userId);
  },
  
  saveQuizzes(quizzes: Quiz[]): void {
    localStorage.setItem('quizify_quizzes', JSON.stringify(quizzes));
  },
  
  getQuestions(userId: string): Question[] {
    const questions = JSON.parse(localStorage.getItem('quizify_questions') || '[]');
    return questions.filter((q: Question) => (q as unknown as { userId?: string }).userId === userId);
  },
  
  saveQuestions(questions: Question[]): void {
    localStorage.setItem('quizify_questions', JSON.stringify(questions));
  },
  
  getAttempts(): QuizAttempt[] {
    return JSON.parse(localStorage.getItem('quizify_attempts') || '[]');
  },
  
  saveAttempts(attempts: QuizAttempt[]): void {
    localStorage.setItem('quizify_attempts', JSON.stringify(attempts));
  },
};

export const api = {
  // Quiz operations
  async createQuiz(accessToken: string, quizData: Partial<Quiz>): Promise<Quiz> {
    if (!hasSupabaseCredentials || !API_URL) {
      // Local storage fallback
      const session = JSON.parse(localStorage.getItem('quizify_session') || '{}');
      const quiz: Quiz = {
        id: `quiz_${Date.now()}`,
        userId: session.user?.id || '',
        title: quizData.title || '',
        description: quizData.description || '',
        questions: quizData.questions || [],
        settings: quizData.settings || {
          timeLimit: null,
          shuffleQuestions: false,
          shuffleAnswers: false,
          showResults: true,
          passingScore: 70,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      quizzes.push(quiz);
      localStorageAPI.saveQuizzes(quizzes);
      
      return quiz;
    }

    const response = await apiCall('POST', '/server/v1/quizzes', accessToken, quizData) as { quiz: Quiz };
    return response.quiz;
  },

  async getQuizzes(accessToken: string): Promise<Quiz[]> {
    if (!hasSupabaseCredentials || !API_URL) {
      const session = JSON.parse(localStorage.getItem('quizify_session') || '{}');
      return localStorageAPI.getQuizzes(session.user?.id || '');
    }

    const response = await apiCall('GET', '/server/v1/quizzes', accessToken) as { quizzes: Quiz[] };
    return response.quizzes || [];
  },

  async getQuiz(accessToken: string, quizId: string): Promise<Quiz> {
    if (!hasSupabaseCredentials || !API_URL) {
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      const quiz = quizzes.find((q: Quiz) => q.id === quizId);
      if (!quiz) throw new Error('Quiz not found');
      return quiz;
    }

    const response = await apiCall('GET', `/server/v1/quizzes/${quizId}`, accessToken) as { quiz: Quiz };
    return response.quiz;
  },

  async getPublicQuiz(quizId: string): Promise<Quiz> {
    if (!hasSupabaseCredentials || !API_URL) {
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      const quiz = quizzes.find((q: Quiz) => q.id === quizId);
      if (!quiz) throw new Error('Quiz not found');
      return quiz;
    }

    const response = await apiCall('GET', `/server/v1/quizzes/${quizId}/public`, undefined) as { quiz: Quiz };
    return response.quiz;
  },

  async updateQuiz(accessToken: string, quizId: string, updates: Partial<Quiz>): Promise<Quiz> {
    if (!hasSupabaseCredentials || !API_URL) {
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      const index = quizzes.findIndex((q: Quiz) => q.id === quizId);
      if (index === -1) throw new Error('Quiz not found');
      
      quizzes[index] = {
        ...quizzes[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      localStorageAPI.saveQuizzes(quizzes);
      return quizzes[index];
    }

    const response = await apiCall('PUT', `/server/v1/quizzes/${quizId}`, accessToken, updates) as { quiz: Quiz };
    return response.quiz;
  },

  async deleteQuiz(accessToken: string, quizId: string): Promise<void> {
    if (!hasSupabaseCredentials || !API_URL) {
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      const filtered = quizzes.filter((q: Quiz) => q.id !== quizId);
      localStorageAPI.saveQuizzes(filtered);
      return;
    }

    await apiCall('DELETE', `/server/v1/quizzes/${quizId}`, accessToken);
  },

  // Question bank operations
  async saveQuestion(accessToken: string, question: Question): Promise<Question> {
    if (!hasSupabaseCredentials || !API_URL) {
      const session = JSON.parse(localStorage.getItem('quizify_session') || '{}');
      const questionWithId = {
        ...question,
        id: `question_${Date.now()}`,
        userId: session.user?.id || '',
      };
      
      const questions = JSON.parse(localStorage.getItem('quizify_questions') || '[]');
      questions.push(questionWithId);
      localStorageAPI.saveQuestions(questions);
      
      return questionWithId;
    }

    const response = await apiCall('POST', '/server/v1/questions', accessToken, question) as { question: Question };
    return response.question;
  },

  async getQuestions(accessToken: string): Promise<Question[]> {
    if (!hasSupabaseCredentials || !API_URL) {
      const session = JSON.parse(localStorage.getItem('quizify_session') || '{}');
      return localStorageAPI.getQuestions(session.user?.id || '');
    }

    const response = await apiCall('GET', '/server/v1/questions', accessToken) as { questions: Question[] };
    return response.questions || [];
  },

  async deleteQuestion(accessToken: string, questionId: string): Promise<void> {
    if (!hasSupabaseCredentials || !API_URL) {
      const questions = JSON.parse(localStorage.getItem('quizify_questions') || '[]');
      const filtered = questions.filter((q: Question) => (q as unknown as { id?: string }).id !== questionId);
      localStorageAPI.saveQuestions(filtered);
      return;
    }

    await apiCall('DELETE', `/server/v1/questions/${questionId}`, accessToken);
  },

  // Quiz attempt operations
  async submitQuizAttempt(
    quizId: string,
    attemptData: {
      userName: string;
      userEmail: string;
      answers: (string | number)[];
      timeSpent: number;
    }
  ): Promise<QuizAttempt> {
    if (!hasSupabaseCredentials || !API_URL) {
      // Get quiz to calculate score
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      const quiz = quizzes.find((q: Quiz) => q.id === quizId);
      if (!quiz) throw new Error('Quiz not found');
      
      // Calculate score
      let correctAnswers = 0;
      attemptData.answers.forEach((answer, index) => {
        if (quiz.questions[index] && answer === quiz.questions[index].correctAnswer) {
          correctAnswers++;
        }
      });
      
      const score = Math.round((correctAnswers / quiz.questions.length) * 100);
      const passed = score >= quiz.settings.passingScore;
      
      const attempt: QuizAttempt = {
        id: `attempt_${Date.now()}`,
        quizId,
        userName: attemptData.userName,
        userEmail: attemptData.userEmail,
        answers: attemptData.answers,
        score,
        correctAnswers,
        totalQuestions: quiz.questions.length,
        passed,
        timeSpent: attemptData.timeSpent,
        createdAt: new Date().toISOString(),
      };
      
      const attempts = localStorageAPI.getAttempts();
      attempts.push(attempt);
      localStorageAPI.saveAttempts(attempts);
      
      return attempt;
    }

    const response = await apiCall('POST', `/server/v1/quizzes/${quizId}/attempts`, undefined, attemptData) as { attempt: QuizAttempt };
    return response.attempt;
  },

  async getQuizAnalytics(accessToken: string, quizId: string): Promise<QuizAnalytics> {
    if (!hasSupabaseCredentials || !API_URL) {
      const attempts = localStorageAPI.getAttempts().filter(a => a.quizId === quizId);
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      const quiz = quizzes.find((q: Quiz) => q.id === quizId);
      
      if (!quiz) throw new Error('Quiz not found');
      
      const totalAttempts = attempts.length;
      const averageScore = totalAttempts > 0
        ? attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts
        : 0;
      const passRate = totalAttempts > 0
        ? (attempts.filter(a => a.passed).length / totalAttempts) * 100
        : 0;
      const averageTimeSpent = totalAttempts > 0
        ? attempts.reduce((sum, a) => sum + a.timeSpent, 0) / totalAttempts
        : 0;
      
      // Calculate per-question stats
      const questionStats = quiz.questions.map((q: Question, index: number) => {
        const answersForQuestion = attempts.map(a => a.answers[index]);
        const correctCount = answersForQuestion.filter(
          answer => answer === q.correctAnswer
        ).length;
        
        return {
          questionIndex: index,
          questionText: q.question,
          correctPercentage: totalAttempts > 0 ? (correctCount / totalAttempts) * 100 : 0,
          totalAnswered: totalAttempts,
        };
      });
      
      return {
        totalAttempts,
        averageScore,
        passRate,
        averageTimeSpent,
        questionStats,
        recentAttempts: attempts.slice(-10).reverse(),
      };
    }

    const response = await apiCall('GET', `/server/v1/quizzes/${quizId}/analytics`, accessToken) as { analytics: QuizAnalytics };
    return response.analytics;
  },
};
