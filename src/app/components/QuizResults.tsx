import { useLocation, useNavigate } from 'react-router';
import { QuizAttempt, Quiz } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Trophy, XCircle, CheckCircle2, Clock, Target } from 'lucide-react';
import { Progress } from './ui/progress';

export function QuizResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const { attempt, quiz } = location.state as { attempt: QuizAttempt; quiz: Quiz } || {};

  if (!attempt || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">Results not found</p>
            <Button onClick={() => navigate('/')} className="mt-4">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Results Header */}
        <Card className="mb-8 text-center">
          <CardContent className="pt-12 pb-8">
            {attempt.passed ? (
              <div className="mb-6">
                <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Congratulations! 🎉</h1>
                <p className="text-lg text-gray-600">You passed the quiz!</p>
              </div>
            ) : (
              <div className="mb-6">
                <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Completed</h1>
                <p className="text-lg text-gray-600">Keep practicing to improve!</p>
              </div>
            )}

            <div className="max-w-md mx-auto">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Your Score</span>
                  <span className="text-sm font-medium text-gray-900">{attempt.score}%</span>
                </div>
                <Progress 
                  value={attempt.score} 
                  className={`h-3 ${
                    attempt.passed ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'
                  }`}
                />
              </div>
              <p className="text-sm text-gray-600">
                Passing score: {quiz.settings.passingScore}%
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {attempt.correctAnswers}/{attempt.totalQuestions}
              </p>
              <p className="text-sm text-gray-600">Correct Answers</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Target className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900 mb-1">{attempt.score}%</p>
              <p className="text-sm text-gray-600">Score</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {formatTime(attempt.timeSpent)}
              </p>
              <p className="text-sm text-gray-600">Time Spent</p>
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quiz Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Quiz Title</span>
              <span className="font-semibold">{quiz.title}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Participant</span>
              <span className="font-semibold">{attempt.userName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Date</span>
              <span className="font-semibold">
                {new Date(attempt.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status</span>
              <span className={`font-semibold ${
                attempt.passed ? 'text-green-600' : 'text-red-600'
              }`}>
                {attempt.passed ? 'Passed' : 'Failed'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={() => navigate('/')} 
            className="flex-1"
            size="lg"
          >
            Go to Home
          </Button>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="flex-1"
            size="lg"
          >
            Retake Quiz
          </Button>
        </div>
      </div>
    </div>
  );
}
