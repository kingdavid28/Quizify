import { supabase, hasSupabaseCredentials } from './supabase';

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

// Local storage fallback helpers
const localStorageAPI = {
  getQuizzes(userId: string): Quiz[] {
    const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
    return quizzes.filter((q: Quiz) => q.userId === userId);
  },
  
  saveQuizzes(quizzes: Quiz[]) {
    localStorage.setItem('quizify_quizzes', JSON.stringify(quizzes));
  },
  
  getQuestions(userId: string): Question[] {
    const questions = JSON.parse(localStorage.getItem('quizify_questions') || '[]');
    return questions.filter((q: any) => q.userId === userId);
  },
  
  saveQuestions(questions: any[]) {
    localStorage.setItem('quizify_questions', JSON.stringify(questions));
  },
  
  getAttempts(): QuizAttempt[] {
    return JSON.parse(localStorage.getItem('quizify_attempts') || '[]');
  },
  
  saveAttempts(attempts: QuizAttempt[]) {
    localStorage.setItem('quizify_attempts', JSON.stringify(attempts));
  },
};

// Helper to convert database row to Quiz object
function dbRowToQuiz(row: any): Quiz {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    questions: row.questions,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper to convert database row to QuizAttempt object
function dbRowToAttempt(row: any): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    userName: row.user_name,
    userEmail: row.user_email,
    answers: row.answers,
    score: row.score,
    correctAnswers: row.correct_answers,
    totalQuestions: row.total_questions,
    passed: row.passed,
    timeSpent: row.time_spent,
    createdAt: row.created_at,
  };
}

export const api = {
  // Quiz operations
  async createQuiz(accessToken: string, quizData: Partial<Quiz>): Promise<Quiz> {
    if (!hasSupabaseCredentials) {
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

    // Get current user
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        title: quizData.title,
        description: quizData.description,
        questions: quizData.questions,
        settings: quizData.settings,
      })
      .select()
      .single();

    if (error) throw error;
    return dbRowToQuiz(data);
  },

  async getQuizzes(accessToken: string): Promise<Quiz[]> {
    if (!hasSupabaseCredentials) {
      const session = JSON.parse(localStorage.getItem('quizify_session') || '{}');
      return localStorageAPI.getQuizzes(session.user?.id || '');
    }

    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(dbRowToQuiz);
  },

  async getQuiz(accessToken: string, quizId: string): Promise<Quiz> {
    if (!hasSupabaseCredentials) {
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      const quiz = quizzes.find((q: Quiz) => q.id === quizId);
      if (!quiz) throw new Error('Quiz not found');
      return quiz;
    }

    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (error) throw error;
    return dbRowToQuiz(data);
  },

  async getPublicQuiz(quizId: string): Promise<Quiz> {
    if (!hasSupabaseCredentials) {
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      const quiz = quizzes.find((q: Quiz) => q.id === quizId);
      if (!quiz) throw new Error('Quiz not found');
      return quiz;
    }

    // For public access, we need to bypass RLS
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (error) throw error;
    return dbRowToQuiz(data);
  },

  async updateQuiz(accessToken: string, quizId: string, updates: Partial<Quiz>): Promise<Quiz> {
    if (!hasSupabaseCredentials) {
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

    const updateData: any = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.questions !== undefined) updateData.questions = updates.questions;
    if (updates.settings !== undefined) updateData.settings = updates.settings;

    const { data, error } = await supabase
      .from('quizzes')
      .update(updateData)
      .eq('id', quizId)
      .select()
      .single();

    if (error) throw error;
    return dbRowToQuiz(data);
  },

  async deleteQuiz(accessToken: string, quizId: string): Promise<void> {
    if (!hasSupabaseCredentials) {
      const quizzes = JSON.parse(localStorage.getItem('quizify_quizzes') || '[]');
      const filtered = quizzes.filter((q: Quiz) => q.id !== quizId);
      localStorageAPI.saveQuizzes(filtered);
      return;
    }

    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    if (error) throw error;
  },

  // Question bank operations
  async saveQuestion(accessToken: string, question: Question): Promise<Question> {
    if (!hasSupabaseCredentials) {
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

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('questions')
      .insert({
        user_id: user.id,
        type: question.type,
        question: question.question,
        options: question.options,
        correct_answer: String(question.correctAnswer),
        points: question.points || 1,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      type: data.type,
      question: data.question,
      options: data.options,
      correctAnswer: data.correct_answer,
      points: data.points,
    };
  },

  async getQuestions(accessToken: string): Promise<Question[]> {
    if (!hasSupabaseCredentials) {
      const session = JSON.parse(localStorage.getItem('quizify_session') || '{}');
      return localStorageAPI.getQuestions(session.user?.id || '');
    }

    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((row: any) => ({
      type: row.type,
      question: row.question,
      options: row.options,
      correctAnswer: row.correct_answer,
      points: row.points,
    }));
  },

  async deleteQuestion(accessToken: string, questionId: string): Promise<void> {
    if (!hasSupabaseCredentials) {
      const questions = JSON.parse(localStorage.getItem('quizify_questions') || '[]');
      const filtered = questions.filter((q: any) => q.id !== questionId);
      localStorageAPI.saveQuestions(filtered);
      return;
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) throw error;
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
    if (!hasSupabaseCredentials) {
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

    // Get quiz to calculate score
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;
    
    const quiz = dbRowToQuiz(quizData);
    
    // Calculate score
    let correctAnswers = 0;
    attemptData.answers.forEach((answer, index) => {
      if (quiz.questions[index] && answer === quiz.questions[index].correctAnswer) {
        correctAnswers++;
      }
    });
    
    const score = Math.round((correctAnswers / quiz.questions.length) * 100);
    const passed = score >= quiz.settings.passingScore;

    const { data, error } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        user_name: attemptData.userName,
        user_email: attemptData.userEmail,
        answers: attemptData.answers,
        score,
        correct_answers: correctAnswers,
        total_questions: quiz.questions.length,
        passed,
        time_spent: attemptData.timeSpent,
      })
      .select()
      .single();

    if (error) throw error;
    return dbRowToAttempt(data);
  },

  async getQuizAttempts(accessToken: string, quizId: string): Promise<QuizAttempt[]> {
    if (!hasSupabaseCredentials) {
      const attempts = localStorageAPI.getAttempts();
      return attempts.filter(a => a.quizId === quizId);
    }

    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(dbRowToAttempt);
  },

  async getQuizAnalytics(accessToken: string, quizId: string): Promise<QuizAnalytics> {
    if (!hasSupabaseCredentials) {
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

    // Get quiz
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;
    const quiz = dbRowToQuiz(quizData);

    // Get all attempts
    const { data: attemptsData, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: false });

    if (attemptsError) throw attemptsError;
    const attempts = attemptsData.map(dbRowToAttempt);

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
      recentAttempts: attempts.slice(0, 10),
    };
  },
};
