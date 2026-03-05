import { useState, useCallback } from 'react';
import { Upload, FileText, Sparkles, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { parseQuizContent, ParsedQuestion } from '../lib/quizParser';
import { toast } from 'sonner';

interface AIQuizGeneratorProps {
  onQuestionsGenerated: (questions: ParsedQuestion[], title?: string) => void;
  onClose: () => void;
}

export function AIQuizGenerator({ onQuestionsGenerated, onClose }: AIQuizGeneratorProps) {
  const [content, setContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<ParsedQuestion[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [detectedTitle, setDetectedTitle] = useState<string>('');

  const handleFileRead = useCallback((fileContent: string, fileName: string) => {
    setContent(fileContent);
    processContent(fileContent);
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      // Check file type
      const validTypes = ['text/plain', 'text/markdown', 'application/json'];
      const isValidType = validTypes.includes(file.type) || 
        file.name.endsWith('.txt') || 
        file.name.endsWith('.md') ||
        file.name.endsWith('.json');

      if (!isValidType) {
        toast.error('Please upload a text, markdown, or JSON file');
        return;
      }

      if (file.size > 1024 * 1024) { // 1MB limit
        toast.error('File too large. Maximum size is 1MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        handleFileRead(content, file.name);
      };
      reader.readAsText(file);
    },
    [handleFileRead]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) {
          toast.error('File is empty');
          return;
        }
        handleFileRead(content, file.name);
      } catch (error) {
        // File read error handled below
        toast.error('Failed to read file. Please try again.');
      }
    };
    reader.onerror = () => {
      // FileReader error; user feedback provided
      toast.error('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  };

  const processContent = useCallback((text: string) => {
    if (!text || text.trim().length === 0) {
      toast.error('Content is empty. Please provide some text.');
      return;
    }

    setIsProcessing(true);
    setParseErrors([]);
    
    try {
      // Small delay to show processing state
      setTimeout(() => {
        try {
          const result = parseQuizContent(text);
          
          if (result.errors.length > 0) {
            setParseErrors(result.errors);
          }
          
          if (result.questions.length > 0) {
            setPreviewQuestions(result.questions);
            setDetectedTitle(result.title || '');
            toast.success(`Generated ${result.questions.length} questions!`);
          } else {
            toast.error('No questions found. Please check your format.');
          }
          
          setIsProcessing(false);
        } catch (parseError) {
          // Parse error handled below
          const errorMessage = parseError instanceof Error ? parseError.message : 'Failed to process content';
          setParseErrors([errorMessage]);
          setIsProcessing(false);
        }
      }, 500);
    } catch (error) {
      // Processing error handled below
      setParseErrors(['Failed to process content']);
      setIsProcessing(false);
    }
  }, []);

  const handleGenerate = () => {
    if (previewQuestions.length === 0) {
      toast.error('No questions to add');
      return;
    }

    try {
      onQuestionsGenerated(previewQuestions, detectedTitle);
      toast.success('Questions added to quiz!');
    } catch (error) {
      // Error adding questions handled below
      toast.error('Failed to add questions. Please try again.');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        toast.error('Clipboard is empty');
        return;
      }
      setContent(text);
      processContent(text);
    } catch (error) {
      // Clipboard access error handled below
      toast.error('Failed to read clipboard. Please paste manually or use the file upload.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI Quiz Generator
              </CardTitle>
              <CardDescription>
                Upload a file or paste content to automatically generate quiz questions
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-6 space-y-6">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-300 hover:border-indigo-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">Drop your file here</h3>
            <p className="text-sm text-gray-600 mb-4">
              Supports .txt, .md, .json files (max 1MB)
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                <FileText className="w-4 h-4 mr-2" />
                Choose File
              </Button>
              <Button variant="outline" onClick={handlePaste}>
                Paste Content
              </Button>
            </div>
            <input
              id="file-upload"
              type="file"
              accept=".txt,.md,.json,text/plain,text/markdown"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Format Guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Supported Formats:</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <div>
                <strong>Markdown with bullets:</strong>
                <pre className="bg-white p-2 rounded mt-1 text-xs">
{`- What is 2+2?
- 3
- 4 ✅
- 5`}
                </pre>
              </div>
              <div>
                <strong>Q&A Format:</strong>
                <pre className="bg-white p-2 rounded mt-1 text-xs">
{`Q: What is the capital of France?
A: Paris`}
                </pre>
              </div>
              <div>
                <strong>Numbered List:</strong>
                <pre className="bg-white p-2 rounded mt-1 text-xs">
{`1. What is 2+2?
a) 3
b) 4 *
c) 5`}
                </pre>
              </div>
            </div>
          </div>

          {/* Text Input Area */}
          <div>
            <label className="block text-sm font-medium mb-2">Or paste content directly:</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your quiz content here..."
              className="min-h-[150px] font-mono text-sm"
            />
            {content && (
              <Button
                onClick={() => processContent(content)}
                className="mt-2"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Generate Questions'}
              </Button>
            )}
          </div>

          {/* Errors */}
          {parseErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900 mb-1">Parsing Errors:</h4>
                  <ul className="text-sm text-red-800 list-disc list-inside">
                    {parseErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewQuestions.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-medium text-green-900">
                  Preview: {previewQuestions.length} Questions Generated
                </h4>
              </div>
              {detectedTitle && (
                <p className="text-sm text-green-800 mb-3">
                  <strong>Detected Title:</strong> {detectedTitle}
                </p>
              )}
              <div className="space-y-3 max-h-64 overflow-auto">
                {previewQuestions.map((q, i) => (
                  <div key={i} className="bg-white p-3 rounded border border-green-200">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">
                        {i + 1}. {q.question}
                      </p>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        {q.type}
                      </span>
                    </div>
                    {q.options && (
                      <ul className="mt-2 space-y-1 text-sm text-gray-600">
                        {q.options.map((opt, j) => (
                          <li
                            key={j}
                            className={opt === q.correctAnswer ? 'text-green-700 font-medium' : ''}
                          >
                            • {opt} {opt === q.correctAnswer && '✓'}
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.type === 'short-answer' && q.correctAnswer && (
                      <p className="mt-2 text-sm text-gray-600">
                        Answer: <span className="text-green-700 font-medium">{q.correctAnswer}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer Actions */}
        {previewQuestions.length > 0 && (
          <div className="border-t p-4 flex gap-2 justify-end bg-gray-50">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} className="bg-indigo-600 hover:bg-indigo-700">
              <Sparkles className="w-4 h-4 mr-2" />
              Add {previewQuestions.length} Questions to Quiz
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
