import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import { rateLimiters } from "./rate_limiter.tsx";
import { logger as appLogger, metrics, measureAsync } from "./monitoring.tsx";

const app = new Hono();

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS with restricted origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...((Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)),
];

app.use(
  "/*",
  cors({
    origin: (origin: string | undefined) => {
      if (!origin) return undefined;
      // Allow localhost for development, restrict in production
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return origin;
      }
      return allowedOrigins.includes(origin) ? origin : undefined;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    maxAge: 600,
    credentials: true,
  }),
);

// Input validation helpers
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

const validatePassword = (password: string): boolean => {
  return password.length >= 8 && password.length <= 128;
};

const getRequestId = (c: any): string => {
  return c.req.header('x-request-id') || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============ HEALTH CHECK ============

app.get("/health", (c) => {
  return c.json({ status: "ok", version: "1.0" });
});

// ============ API V1 ROUTES ============

// -------- AUTH ROUTES --------

// Sign up a new user
app.post("/v1/auth/signup", rateLimiters.auth, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const body = await c.req.json() as Record<string, unknown>;
    const { email, password, name } = body;
    
    // Input validation
    if (!email || !password) {
      appLogger.warn("Signup attempt with missing fields", { email: !!email, password: !!password }, requestId);
      return c.json({ error: "Email and password are required" }, 400);
    }

    if (!validateEmail(email as string)) {
      appLogger.warn("Signup with invalid email format", { email }, requestId);
      return c.json({ error: "Invalid email format" }, 400);
    }

    if (!validatePassword(password as string)) {
      appLogger.warn("Signup with weak password", {}, requestId);
      return c.json({
        error: "Password must be between 8 and 128 characters and include uppercase, lowercase, and numbers",
      }, 400);
    }

    if (name && typeof name !== 'string') {
      return c.json({ error: "Invalid name format" }, 400);
    }

    const result = await measureAsync(
      'auth.signup',
      async () => {
        const { data, error } = await supabase.auth.admin.createUser({
          email: email as string,
          password: password as string,
          user_metadata: { name: name || '' },
          email_confirm: true
        });

        if (error) {
          throw new Error(error.message);
        }

        return { data, error: null };
      }
    );

    appLogger.info("User signup successful", { email, userId: result.data?.user?.id }, requestId);
    metrics.recordCounter('auth.signup.success');
    
    return c.json({ user: result.data!.user }, 201);
  } catch (error) {
    appLogger.error("Unexpected error during signup", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    metrics.recordCounter('auth.signup.error');
    return c.json({ error: "Failed to create user" }, 500);
  }
});

// Login
app.post("/v1/auth/login", rateLimiters.auth, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const body = await c.req.json() as Record<string, unknown>;
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const result = await measureAsync(
      'auth.login',
      async () => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email as string,
          password: password as string,
        });

        if (error) {
          throw new Error(error.message);
        }

        return { data, error: null };
      }
    );

    if (!result.data?.session) {
      appLogger.warn("Login failed for user", { email }, requestId);
      metrics.recordCounter('auth.login.failure');
      return c.json({ error: "Invalid email or password" }, 401);
    }

    appLogger.info("User login successful", { email, userId: result.data.user?.id }, requestId);
    metrics.recordCounter('auth.login.success');
    
    return c.json({
      user: result.data.user,
      session: result.data.session
    }, 200);
  } catch (error) {
    appLogger.error("Error during login", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    metrics.recordCounter('auth.login.error');
    return c.json({ error: "Failed to login" }, 500);
  }
});

// Get current user info
app.get("/v1/auth/me", async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    appLogger.debug("User info retrieved", { userId: user.id }, requestId);
    return c.json({ user });
  } catch (error) {
    appLogger.error("Error getting user info", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to get user info" }, 500);
  }
});

// -------- QUIZ ROUTES --------

// Create a new quiz
app.post("/v1/quizzes", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizData = await c.req.json() as Record<string, unknown>;
    const quizId = crypto.randomUUID();
    const now = new Date().toISOString();

    const quiz = {
      id: quizId,
      userId: user.id,
      title: quizData.title || "",
      description: quizData.description || "",
      questions: quizData.questions || [],
      settings: quizData.settings || {
        timeLimit: null,
        shuffleQuestions: false,
        shuffleAnswers: false,
        showResults: true,
        passingScore: 70,
      },
      createdAt: now,
      updatedAt: now,
    };

    await kv.set(`quizzes:${user.id}:${quizId}`, quiz);

    const userQuizzes = (await kv.get(`user_quizzes:${user.id}`) as string[]) || [];
    userQuizzes.push(quizId);
    await kv.set(`user_quizzes:${user.id}`, userQuizzes);

    appLogger.info("Quiz created", { quizId, userId: user.id }, requestId);
    metrics.recordCounter('quiz.created');
    
    return c.json({ quiz }, 201);
  } catch (error) {
    appLogger.error("Error creating quiz", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    metrics.recordCounter('quiz.create.error');
    return c.json({ error: "Failed to create quiz" }, 500);
  }
});

// Get all quizzes for the user
app.get("/v1/quizzes", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizIds = (await kv.get(`user_quizzes:${user.id}`) as string[]) || [];
    const quizzes = [];

    for (const quizId of quizIds) {
      const quiz = await kv.get(`quizzes:${user.id}:${quizId}`);
      if (quiz) {
        quizzes.push(quiz);
      }
    }

    quizzes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    appLogger.debug("Quizzes fetched", { count: quizzes.length, userId: user.id }, requestId);
    metrics.recordGauge('quiz.user_count', quizzes.length);
    
    return c.json({ quizzes });
  } catch (error) {
    appLogger.error("Error fetching quizzes", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to fetch quizzes" }, 500);
  }
});

// Get a specific quiz (for editing)
app.get("/v1/quizzes/:id", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizId = c.req.param('id');
    const quiz = await kv.get(`quizzes:${user.id}:${quizId}`);

    if (!quiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    return c.json({ quiz });
  } catch (error) {
    appLogger.error("Error fetching quiz", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to fetch quiz" }, 500);
  }
});

// Get a quiz for taking (public - no auth required)
app.get("/v1/quizzes/:id/public", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const quizId = c.req.param('id');
    
    const allKeys = await kv.getByPrefix(`quizzes:`) as Array<{ value: any }>;
    const quiz = allKeys.find(item => item.value?.id === quizId)?.value;

    if (!quiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    return c.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions,
        settings: quiz.settings,
      }
    });
  } catch (error) {
    appLogger.error("Error fetching public quiz", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to fetch quiz" }, 500);
  }
});

// Update a quiz
app.put("/v1/quizzes/:id", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizId = c.req.param('id');
    const existingQuiz = await kv.get(`quizzes:${user.id}:${quizId}`);

    if (!existingQuiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    const updates = await c.req.json() as Record<string, unknown>;
    const updatedQuiz = {
      ...existingQuiz,
      ...updates,
      id: quizId,
      userId: user.id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`quizzes:${user.id}:${quizId}`, updatedQuiz);

    appLogger.info("Quiz updated", { quizId, userId: user.id }, requestId);
    metrics.recordCounter('quiz.updated');
    
    return c.json({ quiz: updatedQuiz });
  } catch (error) {
    appLogger.error("Error updating quiz", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to update quiz" }, 500);
  }
});

// Delete a quiz
app.delete("/v1/quizzes/:id", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizId = c.req.param('id');

    await kv.del(`quizzes:${user.id}:${quizId}`);

    const userQuizzes = (await kv.get(`user_quizzes:${user.id}`) as string[]) || [];
    const updatedQuizzes = userQuizzes.filter((id: string) => id !== quizId);
    await kv.set(`user_quizzes:${user.id}`, updatedQuizzes);

    appLogger.info("Quiz deleted", { quizId, userId: user.id }, requestId);
    metrics.recordCounter('quiz.deleted');
    
    return c.json({ success: true });
  } catch (error) {
    appLogger.error("Error deleting quiz", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to delete quiz" }, 500);
  }
});

// -------- QUIZ ATTEMPT ROUTES --------

// Submit a quiz attempt
app.post("/v1/quizzes/:id/attempts", rateLimiters.submission, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const quizId = c.req.param('id');
    const attemptData = await c.req.json() as Record<string, unknown>;
    const attemptId = crypto.randomUUID();

    const allKeys = await kv.getByPrefix(`quizzes:`) as Array<{ value: any }>;
    const quiz = allKeys.find(item => item.value?.id === quizId)?.value;

    if (!quiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    let correctAnswers = 0;
    const totalQuestions = quiz.questions.length;

    quiz.questions.forEach((question: any, index: number) => {
      const userAnswer = (attemptData.answers as any[])?.[index];
      if (question.type === 'multiple-choice' || question.type === 'true-false') {
        if (userAnswer === question.correctAnswer) {
          correctAnswers++;
        }
      } else if (question.type === 'short-answer') {
        if (userAnswer?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim()) {
          correctAnswers++;
        }
      }
    });

    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const passed = score >= (quiz.settings?.passingScore || 70);

    const attempt = {
      id: attemptId,
      quizId,
      userName: attemptData.userName || "Anonymous",
      userEmail: attemptData.userEmail || "",
      answers: attemptData.answers,
      score,
      correctAnswers,
      totalQuestions,
      passed,
      timeSpent: attemptData.timeSpent || 0,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`attempts:${quizId}:${attemptId}`, attempt);

    const quizAttempts = (await kv.get(`quiz_attempts:${quizId}`) as string[]) || [];
    quizAttempts.push(attemptId);
    await kv.set(`quiz_attempts:${quizId}`, quizAttempts);

    appLogger.info("Quiz attempt submitted", { quizId, score, passed }, requestId);
    metrics.recordCounter('quiz.attempt.submitted');
    metrics.recordGauge('quiz.attempt.score', score);
    
    return c.json({ attempt }, 201);
  } catch (error) {
    appLogger.error("Error submitting quiz attempt", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    metrics.recordCounter('quiz.attempt.error');
    return c.json({ error: "Failed to submit quiz attempt" }, 500);
  }
});

// Get analytics for a quiz
app.get("/v1/quizzes/:id/analytics", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizId = c.req.param('id');
    const quiz = await kv.get(`quizzes:${user.id}:${quizId}`);

    if (!quiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    const attemptIds = (await kv.get(`quiz_attempts:${quizId}`) as string[]) || [];
    const attempts = [];

    for (const attemptId of attemptIds) {
      const attempt = await kv.get(`attempts:${quizId}:${attemptId}`);
      if (attempt) {
        attempts.push(attempt);
      }
    }

    const totalAttempts = attempts.length;
    const avgScore = totalAttempts > 0
      ? attempts.reduce((sum: number, a: any) => sum + a.score, 0) / totalAttempts
      : 0;
    const passRate = totalAttempts > 0
      ? (attempts.filter((a: any) => a.passed).length / totalAttempts) * 100
      : 0;
    const avgTimeSpent = totalAttempts > 0
      ? attempts.reduce((sum: number, a: any) => sum + (a.timeSpent || 0), 0) / totalAttempts
      : 0;

    const questionStats = quiz.questions.map((question: any, qIndex: number) => {
      const correctCount = attempts.filter((attempt: any) => {
        const userAnswer = attempt.answers?.[qIndex];
        if (question.type === 'multiple-choice' || question.type === 'true-false') {
          return userAnswer === question.correctAnswer;
        } else if (question.type === 'short-answer') {
          return userAnswer?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
        }
        return false;
      }).length;

      return {
        questionIndex: qIndex,
        questionText: question.question,
        correctPercentage: totalAttempts > 0 ? (correctCount / totalAttempts) * 100 : 0,
        totalAnswered: totalAttempts,
      };
    });

    appLogger.debug("Analytics retrieved", { quizId, totalAttempts }, requestId);
    metrics.recordGauge('quiz.analytics.avg_score', Math.round(avgScore * 10) / 10);
    
    return c.json({
      analytics: {
        totalAttempts,
        averageScore: Math.round(avgScore * 10) / 10,
        passRate: Math.round(passRate * 10) / 10,
        averageTimeSpent: Math.round(avgTimeSpent),
        questionStats,
        recentAttempts: attempts
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10),
      }
    });
  } catch (error) {
    appLogger.error("Error fetching quiz analytics", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
});

// -------- QUESTION BANK ROUTES --------

// Save a question to the bank
app.post("/v1/questions", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const questionData = await c.req.json() as Record<string, unknown>;
    const questionId = crypto.randomUUID();

    const question = {
      id: questionId,
      userId: user.id,
      ...questionData,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`questions:${user.id}:${questionId}`, question);

    const userQuestions = (await kv.get(`user_questions:${user.id}`) as string[]) || [];
    userQuestions.push(questionId);
    await kv.set(`user_questions:${user.id}`, userQuestions);

    appLogger.info("Question saved", { questionId, userId: user.id }, requestId);
    metrics.recordCounter('question.saved');
    
    return c.json({ question }, 201);
  } catch (error) {
    appLogger.error("Error saving question", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to save question" }, 500);
  }
});

// Get all questions from the bank
app.get("/v1/questions", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const questionIds = (await kv.get(`user_questions:${user.id}`) as string[]) || [];
    const questions = [];

    for (const questionId of questionIds) {
      const question = await kv.get(`questions:${user.id}:${questionId}`);
      if (question) {
        questions.push(question);
      }
    }

    appLogger.debug("Questions retrieved", { count: questions.length, userId: user.id }, requestId);
    metrics.recordGauge('question.bank_count', questions.length);
    
    return c.json({ questions });
  } catch (error) {
    appLogger.error("Error fetching questions", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to fetch questions" }, 500);
  }
});

// Update a question
app.put("/v1/questions/:id", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const questionId = c.req.param('id');
    const existingQuestion = await kv.get(`questions:${user.id}:${questionId}`);

    if (!existingQuestion) {
      return c.json({ error: "Question not found" }, 404);
    }

    const updates = await c.req.json() as Record<string, unknown>;
    const updatedQuestion = {
      ...existingQuestion,
      ...updates,
      id: questionId,
      userId: user.id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`questions:${user.id}:${questionId}`, updatedQuestion);

    appLogger.info("Question updated", { questionId, userId: user.id }, requestId);
    metrics.recordCounter('question.updated');
    
    return c.json({ question: updatedQuestion });
  } catch (error) {
    appLogger.error("Error updating question", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to update question" }, 500);
  }
});

// Delete a question
app.delete("/v1/questions/:id", rateLimiters.api, async (c) => {
  const requestId = getRequestId(c);
  
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken!);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const questionId = c.req.param('id');

    await kv.del(`questions:${user.id}:${questionId}`);

    const userQuestions = (await kv.get(`user_questions:${user.id}`) as string[]) || [];
    const updatedQuestions = userQuestions.filter((id: string) => id !== questionId);
    await kv.set(`user_questions:${user.id}`, updatedQuestions);

    appLogger.info("Question deleted", { questionId, userId: user.id }, requestId);
    metrics.recordCounter('question.deleted');
    
    return c.json({ success: true });
  } catch (error) {
    appLogger.error("Error deleting question", error instanceof Error ? error : new Error(String(error)), {}, undefined, requestId);
    return c.json({ error: "Failed to delete question" }, 500);
  }
});

// Start the server
Deno.serve(app.fetch);