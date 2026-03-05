import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { api, Question } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { 
  ArrowLeft, 
  Library, 
  Plus, 
  Trash2,
  Brain,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export function QuestionBank() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Question>({
    type: 'multiple-choice',
    question: '',
    options: ['', ''],
    correctAnswer: 0,
    points: 1,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (accessToken) {
      loadQuestions();
    }
  }, [accessToken]);

  const loadQuestions = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const data = await api.getQuestions(accessToken);
      setQuestions(data);
    } catch (error) {
      toast.error('Failed to load questions');
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!accessToken) return;

    if (!newQuestion.question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if (newQuestion.type === 'multiple-choice' && (!newQuestion.options || newQuestion.options.length < 2)) {
      toast.error('Please add at least 2 options');
      return;
    }

    try {
      const saved = await api.saveQuestion(accessToken, newQuestion);
      setQuestions([saved, ...questions]);
      toast.success('Question saved to bank!');
      setDialogOpen(false);
      resetNewQuestion();
    } catch (error) {
      toast.error('Failed to save question');
      console.error('Error saving question:', error);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!accessToken) return;

    try {
      await api.deleteQuestion(accessToken, questionId);
      setQuestions(questions.filter(q => q.id !== questionId));
      toast.success('Question deleted');
    } catch (error) {
      toast.error('Failed to delete question');
      console.error('Error deleting question:', error);
    }
  };

  const resetNewQuestion = () => {
    setNewQuestion({
      type: 'multiple-choice',
      question: '',
      options: ['', ''],
      correctAnswer: 0,
      points: 1,
    });
  };

  const addOption = () => {
    if (newQuestion.type === 'multiple-choice') {
      setNewQuestion({
        ...newQuestion,
        options: [...(newQuestion.options || []), ''],
      });
    }
  };

  const updateOption = (index: number, value: string) => {
    if (newQuestion.type === 'multiple-choice') {
      const options = [...(newQuestion.options || [])];
      options[index] = value;
      setNewQuestion({ ...newQuestion, options });
    }
  };

  const removeOption = (index: number) => {
    if (newQuestion.type === 'multiple-choice') {
      const options = [...(newQuestion.options || [])];
      options.splice(index, 1);
      setNewQuestion({ ...newQuestion, options });
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
            <Link to="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Library className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
          </div>
          <p className="text-gray-600">Save and reuse questions across multiple quizzes</p>
        </div>

        {/* Add Question Button */}
        <div className="mb-6">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Question to Bank</DialogTitle>
                <DialogDescription>
                  Create a new question to add to your question bank for reuse across quizzes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* Question Type */}
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <RadioGroup
                    value={newQuestion.type}
                    onValueChange={(value) => {
                      const type = value as Question['type'];
                      setNewQuestion({
                        type,
                        question: '',
                        correctAnswer: type === 'true-false' ? 'true' : type === 'multiple-choice' ? 0 : '',
                        options: type === 'multiple-choice' ? ['', ''] : undefined,
                        points: 1,
                      });
                    }}
                  >
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="multiple-choice" id="mc" />
                        <Label htmlFor="mc">Multiple Choice</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true-false" id="tf" />
                        <Label htmlFor="tf">True/False</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="short-answer" id="sa" />
                        <Label htmlFor="sa">Short Answer</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Question Text */}
                <div className="space-y-2">
                  <Label>Question</Label>
                  <Input
                    placeholder="Enter your question"
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                  />
                </div>

                {/* Multiple Choice Options */}
                {newQuestion.type === 'multiple-choice' && (
                  <div className="space-y-3">
                    <Label>Answer Options</Label>
                    <RadioGroup
                      value={newQuestion.correctAnswer?.toString()}
                      onValueChange={(value) => setNewQuestion({ ...newQuestion, correctAnswer: parseInt(value) })}
                    >
                      {newQuestion.options?.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <RadioGroupItem value={index.toString()} id={`opt-${index}`} />
                          <Input
                            placeholder={`Option ${index + 1}`}
                            value={option}
                            onChange={(e) => updateOption(index, e.target.value)}
                            className="flex-1"
                          />
                          {newQuestion.options && newQuestion.options.length > 2 && (
                            <Button variant="ghost" size="sm" onClick={() => removeOption(index)}>
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                    <Button variant="outline" size="sm" onClick={addOption}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Option
                    </Button>
                  </div>
                )}

                {/* True/False */}
                {newQuestion.type === 'true-false' && (
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <RadioGroup
                      value={newQuestion.correctAnswer?.toString()}
                      onValueChange={(value) => setNewQuestion({ ...newQuestion, correctAnswer: value })}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id="true" />
                        <Label htmlFor="true">True</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id="false" />
                        <Label htmlFor="false">False</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Short Answer */}
                {newQuestion.type === 'short-answer' && (
                  <div className="space-y-2">
                    <Label>Correct Answer</Label>
                    <Input
                      placeholder="Enter the correct answer"
                      value={newQuestion.correctAnswer?.toString() || ''}
                      onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveQuestion} className="flex-1">
                    Save to Bank
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setDialogOpen(false);
                      resetNewQuestion();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Questions List */}
        {questions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Library className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved questions</h3>
              <p className="text-gray-600 mb-6">Start building your question bank!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {questions.map((question) => (
              <Card key={question.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                          {question.type === 'multiple-choice' && 'Multiple Choice'}
                          {question.type === 'true-false' && 'True/False'}
                          {question.type === 'short-answer' && 'Short Answer'}
                        </span>
                      </div>
                      <CardTitle className="text-lg">{question.question}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteQuestion(question.id!)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {question.type === 'multiple-choice' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700 mb-2">Options:</p>
                      {question.options?.map((option, index) => (
                        <div 
                          key={index} 
                          className={`text-sm p-2 rounded ${
                            question.correctAnswer === index 
                              ? 'bg-green-50 text-green-700 font-medium' 
                              : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {index + 1}. {option}
                          {question.correctAnswer === index && ' ✓'}
                        </div>
                      ))}
                    </div>
                  )}
                  {question.type === 'true-false' && (
                    <p className="text-sm">
                      <span className="font-medium">Correct Answer:</span>{' '}
                      <span className="text-green-700 font-semibold">
                        {question.correctAnswer === 'true' ? 'True' : 'False'}
                      </span>
                    </p>
                  )}
                  {question.type === 'short-answer' && (
                    <p className="text-sm">
                      <span className="font-medium">Correct Answer:</span>{' '}
                      <span className="text-green-700 font-semibold">{question.correctAnswer}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
