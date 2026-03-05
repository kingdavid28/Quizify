import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { api, Quiz } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { 
  Plus, 
  Brain, 
  LogOut, 
  FileText, 
  BarChart3, 
  Share2,
  Pencil,
  Trash2,
  Library
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export function Dashboard() {
  const { user, accessToken, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (accessToken) {
      loadQuizzes();
    }
  }, [accessToken]);

  const loadQuizzes = async (): Promise<void> => {
    if (!accessToken) return;
    
    try {
      const data = await api.getQuizzes(accessToken);
      setQuizzes(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load quizzes';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      toast.error(errorMessage);
    }
  };

  const handleDeleteQuiz = async (): Promise<void> => {
    if (!accessToken || !deleteQuizId) return;

    try {
      await api.deleteQuiz(accessToken, deleteQuizId);
      setQuizzes(quizzes.filter(q => q.id !== deleteQuizId));
      toast.success('Quiz deleted successfully');
      setDeleteQuizId(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete quiz';
      toast.error(errorMessage);
    } finally {
      setDeleteQuizId(null);
    }
  };

  const copyShareLink = async (quizId: string) => {
    const url = `${window.location.origin}/take/${quizId}`;
    
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
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 animate-pulse text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2">
              <Brain className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Quizify</h1>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/questions">
                <Button variant="outline" size="sm">
                  <Library className="w-4 h-4 mr-2" />
                  Question Bank
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.user_metadata?.name || user?.email}!
          </h2>
          <p className="text-gray-600">Manage your quizzes and track performance</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={<FileText className="w-8 h-8 text-indigo-600" />}
            title="Total Quizzes"
            value={quizzes.length}
          />
          <StatCard
            icon={<BarChart3 className="w-8 h-8 text-green-600" />}
            title="Active Quizzes"
            value={quizzes.length}
          />
          <StatCard
            icon={<Share2 className="w-8 h-8 text-purple-600" />}
            title="Shared"
            value={quizzes.length}
          />
        </div>

        {/* Actions */}
        <div className="mb-8">
          <Link to="/quiz/new">
            <Button size="lg" className="w-full md:w-auto">
              <Plus className="w-5 h-5 mr-2" />
              Create New Quiz
            </Button>
          </Link>
        </div>

        {/* Quizzes List */}
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Your Quizzes</h3>
          
          {quizzes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-xl font-semibold text-gray-900 mb-2">No quizzes yet</h4>
                <p className="text-gray-600 mb-6">Create your first quiz to get started!</p>
                <Link to="/quiz/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Quiz
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{quiz.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {quiz.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Questions</span>
                        <span className="font-semibold">{quiz.questions.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Created</span>
                        <span className="font-semibold">
                          {new Date(quiz.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-3">
                        <Link to={`/quiz/${quiz.id}/edit`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <Link to={`/quiz/${quiz.id}/analytics`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <BarChart3 className="w-4 h-4 mr-1" />
                            Analytics
                          </Button>
                        </Link>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => copyShareLink(quiz.id)}
                        >
                          <Share2 className="w-4 h-4 mr-1" />
                          Share
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteQuizId(quiz.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteQuizId} onOpenChange={() => setDeleteQuizId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quiz? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuiz}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon, title, value }: { 
  icon: React.ReactNode; 
  title: string; 
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
          <div>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
