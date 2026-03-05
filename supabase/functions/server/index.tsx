import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-a728d49f/health", (c) => {
  return c.json({ status: "ok" });
});

// ============ AUTH ROUTES ============

// Sign up a new user
app.post("/make-server-a728d49f/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error(`Error creating user during signup: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.error(`Unexpected error during signup: ${error}`);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

// Get current user info
app.get("/make-server-a728d49f/me", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return c.json({ user });
  } catch (error) {
    console.error(`Error getting user info: ${error}`);
    return c.json({ error: "Failed to get user info" }, 500);
  }
});

// ============ QUIZ ROUTES ============

// Create a new quiz
app.post("/make-server-a728d49f/quizzes", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizData = await c.req.json();
    const quizId = crypto.randomUUID();
    const now = new Date().toISOString();

    const quiz = {
      id: quizId,
      userId: user.id,
      title: quizData.title,
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

    // Save quiz
    await kv.set(`quizzes:${user.id}:${quizId}`, quiz);

    // Add to user's quiz list
    const userQuizzes = await kv.get(`user_quizzes:${user.id}`) || [];
    userQuizzes.push(quizId);
    await kv.set(`user_quizzes:${user.id}`, userQuizzes);

    return c.json({ quiz });
  } catch (error) {
    console.error(`Error creating quiz: ${error}`);
    return c.json({ error: "Failed to create quiz" }, 500);
  }
});

// Get all quizzes for the user
app.get("/make-server-a728d49f/quizzes", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizIds = await kv.get(`user_quizzes:${user.id}`) || [];
    const quizzes = [];

    for (const quizId of quizIds) {
      const quiz = await kv.get(`quizzes:${user.id}:${quizId}`);
      if (quiz) {
        quizzes.push(quiz);
      }
    }

    // Sort by most recent
    quizzes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ quizzes });
  } catch (error) {
    console.error(`Error fetching quizzes: ${error}`);
    return c.json({ error: "Failed to fetch quizzes" }, 500);
  }
});

// Get a specific quiz (for editing)
app.get("/make-server-a728d49f/quizzes/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

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
    console.error(`Error fetching quiz: ${error}`);
    return c.json({ error: "Failed to fetch quiz" }, 500);
  }
});

// Get a quiz for taking (public - no auth required)
app.get("/make-server-a728d49f/quizzes/:id/public", async (c) => {
  try {
    const quizId = c.req.param('id');
    
    // Try to find the quiz by searching all users' quizzes
    const allKeys = await kv.getByPrefix(`quizzes:`);
    const quiz = allKeys.find(item => item.value?.id === quizId)?.value;

    if (!quiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    // Return quiz without sensitive info
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
    console.error(`Error fetching public quiz: ${error}`);
    return c.json({ error: "Failed to fetch quiz" }, 500);
  }
});

// Update a quiz
app.put("/make-server-a728d49f/quizzes/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizId = c.req.param('id');
    const existingQuiz = await kv.get(`quizzes:${user.id}:${quizId}`);

    if (!existingQuiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    const updates = await c.req.json();
    const updatedQuiz = {
      ...existingQuiz,
      ...updates,
      id: quizId,
      userId: user.id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`quizzes:${user.id}:${quizId}`, updatedQuiz);

    return c.json({ quiz: updatedQuiz });
  } catch (error) {
    console.error(`Error updating quiz: ${error}`);
    return c.json({ error: "Failed to update quiz" }, 500);
  }
});

// Delete a quiz
app.delete("/make-server-a728d49f/quizzes/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizId = c.req.param('id');

    // Delete quiz
    await kv.del(`quizzes:${user.id}:${quizId}`);

    // Remove from user's quiz list
    const userQuizzes = await kv.get(`user_quizzes:${user.id}`) || [];
    const updatedQuizzes = userQuizzes.filter((id: string) => id !== quizId);
    await kv.set(`user_quizzes:${user.id}`, updatedQuizzes);

    return c.json({ success: true });
  } catch (error) {
    console.error(`Error deleting quiz: ${error}`);
    return c.json({ error: "Failed to delete quiz" }, 500);
  }
});

// ============ QUESTION BANK ROUTES ============

// Save a question to the bank
app.post("/make-server-a728d49f/questions", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const questionData = await c.req.json();
    const questionId = crypto.randomUUID();

    const question = {
      id: questionId,
      userId: user.id,
      ...questionData,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`questions:${user.id}:${questionId}`, question);

    // Add to user's question list
    const userQuestions = await kv.get(`user_questions:${user.id}`) || [];
    userQuestions.push(questionId);
    await kv.set(`user_questions:${user.id}`, userQuestions);

    return c.json({ question });
  } catch (error) {
    console.error(`Error saving question: ${error}`);
    return c.json({ error: "Failed to save question" }, 500);
  }
});

// Get all questions from the bank
app.get("/make-server-a728d49f/questions", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const questionIds = await kv.get(`user_questions:${user.id}`) || [];
    const questions = [];

    for (const questionId of questionIds) {
      const question = await kv.get(`questions:${user.id}:${questionId}`);
      if (question) {
        questions.push(question);
      }
    }

    return c.json({ questions });
  } catch (error) {
    console.error(`Error fetching questions: ${error}`);
    return c.json({ error: "Failed to fetch questions" }, 500);
  }
});

// Delete a question
app.delete("/make-server-a728d49f/questions/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const questionId = c.req.param('id');

    await kv.del(`questions:${user.id}:${questionId}`);

    // Remove from user's question list
    const userQuestions = await kv.get(`user_questions:${user.id}`) || [];
    const updatedQuestions = userQuestions.filter((id: string) => id !== questionId);
    await kv.set(`user_questions:${user.id}`, updatedQuestions);

    return c.json({ success: true });
  } catch (error) {
    console.error(`Error deleting question: ${error}`);
    return c.json({ error: "Failed to delete question" }, 500);
  }
});

// ============ QUIZ ATTEMPT ROUTES ============

// Submit a quiz attempt
app.post("/make-server-a728d49f/quizzes/:id/attempts", async (c) => {
  try {
    const quizId = c.req.param('id');
    const attemptData = await c.req.json();
    const attemptId = crypto.randomUUID();

    // Find the quiz
    const allKeys = await kv.getByPrefix(`quizzes:`);
    const quiz = allKeys.find(item => item.value?.id === quizId)?.value;

    if (!quiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    // Calculate score
    let correctAnswers = 0;
    const totalQuestions = quiz.questions.length;

    quiz.questions.forEach((question: any, index: number) => {
      const userAnswer = attemptData.answers[index];
      if (question.type === 'multiple-choice' || question.type === 'true-false') {
        if (userAnswer === question.correctAnswer) {
          correctAnswers++;
        }
      } else if (question.type === 'short-answer') {
        // Case-insensitive comparison for short answer
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

    // Save attempt
    await kv.set(`attempts:${quizId}:${attemptId}`, attempt);

    // Add to quiz attempts list
    const quizAttempts = await kv.get(`quiz_attempts:${quizId}`) || [];
    quizAttempts.push(attemptId);
    await kv.set(`quiz_attempts:${quizId}`, quizAttempts);

    return c.json({ attempt });
  } catch (error) {
    console.error(`Error submitting quiz attempt: ${error}`);
    return c.json({ error: "Failed to submit quiz attempt" }, 500);
  }
});

// Get all attempts for a quiz
app.get("/make-server-a728d49f/quizzes/:id/attempts", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizId = c.req.param('id');
    
    // Verify quiz ownership
    const quiz = await kv.get(`quizzes:${user.id}:${quizId}`);
    if (!quiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    const attemptIds = await kv.get(`quiz_attempts:${quizId}`) || [];
    const attempts = [];

    for (const attemptId of attemptIds) {
      const attempt = await kv.get(`attempts:${quizId}:${attemptId}`);
      if (attempt) {
        attempts.push(attempt);
      }
    }

    // Sort by most recent
    attempts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ attempts });
  } catch (error) {
    console.error(`Error fetching quiz attempts: ${error}`);
    return c.json({ error: "Failed to fetch attempts" }, 500);
  }
});

// Get analytics for a quiz
app.get("/make-server-a728d49f/quizzes/:id/analytics", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const quizId = c.req.param('id');
    
    // Verify quiz ownership
    const quiz = await kv.get(`quizzes:${user.id}:${quizId}`);
    if (!quiz) {
      return c.json({ error: "Quiz not found" }, 404);
    }

    const attemptIds = await kv.get(`quiz_attempts:${quizId}`) || [];
    const attempts = [];

    for (const attemptId of attemptIds) {
      const attempt = await kv.get(`attempts:${quizId}:${attemptId}`);
      if (attempt) {
        attempts.push(attempt);
      }
    }

    // Calculate analytics
    const totalAttempts = attempts.length;
    const avgScore = totalAttempts > 0
      ? attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts
      : 0;
    const passRate = totalAttempts > 0
      ? (attempts.filter(a => a.passed).length / totalAttempts) * 100
      : 0;
    const avgTimeSpent = totalAttempts > 0
      ? attempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / totalAttempts
      : 0;

    // Question-level analytics
    const questionStats = quiz.questions.map((question: any, qIndex: number) => {
      const correctCount = attempts.filter(attempt => {
        const userAnswer = attempt.answers[qIndex];
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

    return c.json({
      analytics: {
        totalAttempts,
        averageScore: Math.round(avgScore * 10) / 10,
        passRate: Math.round(passRate * 10) / 10,
        averageTimeSpent: Math.round(avgTimeSpent),
        questionStats,
        recentAttempts: attempts
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10),
      }
    });
  } catch (error) {
    console.error(`Error fetching quiz analytics: ${error}`);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
});

Deno.serve(app.fetch);