import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { api, Quiz, QuizAnalytics as Analytics } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { 
  ArrowLeft, 
  Users, 
  TrendingUp, 
  Award, 
  Clock,
  Brain
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export function QuizAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, accessToken, loading: authLoading } = useAuth();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && accessToken) {
      loadData();
    }
  }, [id, accessToken]);

  const loadData = async () => {
    if (!id || !accessToken) return;

    setLoading(true);
    try {
      const [quizData, analyticsData] = await Promise.all([
        api.getQuiz(accessToken, id),
        api.getQuizAnalytics(accessToken, id),
      ]);
      setQuiz(quizData);
      setAnalytics(analyticsData);
    } catch (error) {
      // Analytics loading failed; user feedback provided
      toast.error('Failed to load analytics');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 animate-pulse text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!quiz || !analytics) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Prepare chart data
  const questionPerformanceData = analytics.questionStats.map((stat, index) => ({
    name: `Q${index + 1}`,
    percentage: Math.round(stat.correctPercentage),
  }));

  const passFailData = [
    { name: 'Passed', value: Math.round(analytics.passRate), color: '#10b981' },
    { name: 'Failed', value: Math.round(100 - analytics.passRate), color: '#ef4444' },
  ];

  const recentScoresData = analytics.recentAttempts
    .slice(0, 10)
    .reverse()
    .map((attempt, index) => ({
      name: `#${index + 1}`,
      score: attempt.score,
    }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </Link>
            <Link to={`/quiz/${id}/edit`}>
              <Button variant="outline">Edit Quiz</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
          <p className="text-gray-600">Analytics and Performance Report</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Users className="w-8 h-8 text-indigo-600" />}
            title="Total Attempts"
            value={analytics.totalAttempts.toString()}
          />
          <StatCard
            icon={<TrendingUp className="w-8 h-8 text-green-600" />}
            title="Average Score"
            value={`${analytics.averageScore}%`}
          />
          <StatCard
            icon={<Award className="w-8 h-8 text-yellow-600" />}
            title="Pass Rate"
            value={`${analytics.passRate}%`}
          />
          <StatCard
            icon={<Clock className="w-8 h-8 text-purple-600" />}
            title="Avg. Time"
            value={formatTime(analytics.averageTimeSpent)}
          />
        </div>

        {analytics.totalAttempts === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No attempts yet</h3>
              <p className="text-gray-600 mb-6">Share your quiz to start collecting data!</p>
              <Button onClick={async () => {
                const url = `${window.location.origin}/take/${id}`;
                
                try {
                  // Try modern clipboard API first
                  await navigator.clipboard.writeText(url);
                  toast.success('Share link copied to clipboard!');
                } catch (err) {
                  // Fallback for browsers/contexts where clipboard API is blocked
                  try {
                    const textArea = document.createElement('textarea');
                    textArea.value = url;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    toast.success('Share link copied to clipboard!');
                  } catch (fallbackErr) {
                    // If all else fails, show the URL so user can copy manually
                    toast.info(`Share link: ${url}`, { duration: 10000 });
                  }
                }
              }}>
                Copy Share Link
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Question Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Question Performance</CardTitle>
                  <CardDescription>Percentage of correct answers per question</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={questionPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="percentage" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pass/Fail Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Pass/Fail Distribution</CardTitle>
                  <CardDescription>Overall pass rate for this quiz</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={passFailData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {passFailData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Recent Scores Trend */}
            {recentScoresData.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Recent Score Trends</CardTitle>
                  <CardDescription>Last 10 quiz attempts</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={recentScoresData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#6366f1" 
                        strokeWidth={2}
                        dot={{ fill: '#6366f1', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Question Difficulty Analysis */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Question Difficulty Analysis</CardTitle>
                <CardDescription>Identify challenging questions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.questionStats.map((stat, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          Question {index + 1}
                        </span>
                        <span className={`text-sm font-semibold ${
                          stat.correctPercentage >= 70 ? 'text-green-600' :
                          stat.correctPercentage >= 40 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {Math.round(stat.correctPercentage)}% correct
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-1">{stat.questionText}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            stat.correctPercentage >= 70 ? 'bg-green-500' :
                            stat.correctPercentage >= 40 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${stat.correctPercentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Attempts Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Attempts</CardTitle>
                <CardDescription>Latest quiz submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-left text-sm text-gray-600">
                        <th className="pb-3 font-medium">Name</th>
                        <th className="pb-3 font-medium">Score</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Time</th>
                        <th className="pb-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {analytics.recentAttempts.map((attempt) => (
                        <tr key={attempt.id} className="border-b last:border-0">
                          <td className="py-3">{attempt.userName}</td>
                          <td className="py-3">
                            <span className="font-semibold">{attempt.score}%</span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              attempt.passed 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {attempt.passed ? 'Passed' : 'Failed'}
                            </span>
                          </td>
                          <td className="py-3">{formatTime(attempt.timeSpent)}</td>
                          <td className="py-3 text-gray-600">
                            {new Date(attempt.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, title, value }: { 
  icon: React.ReactNode; 
  title: string; 
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
          <div>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
