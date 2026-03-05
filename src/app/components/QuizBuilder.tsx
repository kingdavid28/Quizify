import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { api, Question, QuizSettings } from '../lib/api';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  ArrowLeft, 
  Save, 
  Plus,
  GripVertical,
  Trash2,
  Brain,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { QuestionEditor } from './QuestionEditor';
import { AIQuizGenerator } from './AIQuizGenerator';
import { ParsedQuestion } from '../lib/quizParser';

export function QuizBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, accessToken, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<QuizSettings>({
    timeLimit: null,
    shuffleQuestions: false,
    shuffleAnswers: false,
    showResults: true,
    passingScore: 70,
  });
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && accessToken) {
      loadQuiz();
    }
  }, [id, accessToken]);

  const loadQuiz = async () => {
    if (!id || !accessToken) return;

    setLoading(true);
    try {
      const quiz = await api.getQuiz(accessToken, id);
      setTitle(quiz.title);
      setDescription(quiz.description);
      setQuestions(quiz.questions);
      setSettings(quiz.settings);
    } catch (error) {
      toast.error('Failed to load quiz');
      console.error('Error loading quiz:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accessToken) return;

    if (!title.trim()) {
      toast.error('Please enter a quiz title');
      return;
    }

    if (questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        toast.error(`Question ${i + 1} is empty`);
        return;
      }
      if (q.type === 'multiple-choice' && (!q.options || q.options.length < 2)) {
        toast.error(`Question ${i + 1} needs at least 2 options`);
        return;
      }
    }

    setSaving(true);
    try {
      if (id) {
        await api.updateQuiz(accessToken, id, {
          title,
          description,
          questions,
          settings,
        });
        toast.success('Quiz updated successfully!');
      } else {
        const quiz = await api.createQuiz(accessToken, {
          title,
          description,
          questions,
          settings,
        });
        toast.success('Quiz created successfully!');
        navigate(`/quiz/${quiz.id}/edit`);
      }
    } catch (error) {
      toast.error('Failed to save quiz');
      console.error('Error saving quiz:', error);
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = (type: Question['type']) => {
    const newQuestion: Question = {
      type,
      question: '',
      correctAnswer: type === 'true-false' ? 'true' : '',
      options: type === 'multiple-choice' ? ['', ''] : undefined,
      points: 1,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestions(newQuestions);
  };

  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    const newQuestions = [...questions];
    const [movedQuestion] = newQuestions.splice(fromIndex, 1);
    newQuestions.splice(toIndex, 0, movedQuestion);
    setQuestions(newQuestions);
  };

  const handleAIGenerated = (parsedQuestions: ParsedQuestion[], detectedTitle?: string) => {
    // Convert ParsedQuestion to Question
    const newQuestions: Question[] = parsedQuestions.map(pq => ({
      type: pq.type,
      question: pq.question,
      options: pq.options,
      correctAnswer: pq.correctAnswer,
      points: pq.points,
    }));

    setQuestions([...questions, ...newQuestions]);
    
    // Set title if detected and current title is empty
    if (detectedTitle && !title.trim()) {
      setTitle(detectedTitle);
    }
    
    setShowAIGenerator(false);
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
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </Link>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Quiz'}
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Tabs defaultValue="questions" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="questions">Questions</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Questions Tab */}
            <TabsContent value="questions" className="space-y-6">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Quiz Title *</Label>
                    <Input
                      id="title"
                      placeholder="Enter quiz title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter quiz description (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Questions ({questions.length})</h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => setShowAIGenerator(true)}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI Generate
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => addQuestion('multiple-choice')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Multiple Choice
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => addQuestion('true-false')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      True/False
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => addQuestion('short-answer')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Short Answer
                    </Button>
                  </div>
                </div>

                {questions.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-600 mb-4">No questions yet. Add your first question!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <QuestionEditor
                        key={index}
                        question={question}
                        index={index}
                        onUpdate={(updates) => updateQuestion(index, updates)}
                        onDelete={() => deleteQuestion(index)}
                        onMove={moveQuestion}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Time Limit */}
                  <div className="space-y-2">
                    <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                    <Select
                      value={settings.timeLimit?.toString() || 'none'}
                      onValueChange={(value) => 
                        setSettings({
                          ...settings,
                          timeLimit: value === 'none' ? null : parseInt(value)
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No time limit</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">60 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Passing Score */}
                  <div className="space-y-2">
                    <Label htmlFor="passingScore">Passing Score (%)</Label>
                    <Input
                      id="passingScore"
                      type="number"
                      min="0"
                      max="100"
                      value={settings.passingScore}
                      onChange={(e) => 
                        setSettings({
                          ...settings,
                          passingScore: parseInt(e.target.value) || 70
                        })
                      }
                    />
                  </div>

                  {/* Shuffle Questions */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Shuffle Questions</Label>
                      <p className="text-sm text-gray-600">Randomize question order for each attempt</p>
                    </div>
                    <Switch
                      checked={settings.shuffleQuestions}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, shuffleQuestions: checked })
                      }
                    />
                  </div>

                  {/* Shuffle Answers */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Shuffle Answers</Label>
                      <p className="text-sm text-gray-600">Randomize answer options in multiple choice</p>
                    </div>
                    <Switch
                      checked={settings.shuffleAnswers}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, shuffleAnswers: checked })
                      }
                    />
                  </div>

                  {/* Show Results */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Results</Label>
                      <p className="text-sm text-gray-600">Display score immediately after completion</p>
                    </div>
                    <Switch
                      checked={settings.showResults}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, showResults: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* AI Quiz Generator Modal */}
        {showAIGenerator && (
          <AIQuizGenerator
            onQuestionsGenerated={handleAIGenerated}
            onClose={() => setShowAIGenerator(false)}
          />
        )}
      </div>
    </DndProvider>
  );
}
