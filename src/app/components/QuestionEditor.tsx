import { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Question } from '../lib/api';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { GripVertical, Trash2, Plus, X } from 'lucide-react';

const ITEM_TYPE = 'QUESTION';

interface QuestionEditorProps {
  question: Question;
  index: number;
  onUpdate: (updates: Partial<Question>) => void;
  onDelete: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}

export function QuestionEditor({ question, index, onUpdate, onDelete, onMove }: QuestionEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  const addOption = () => {
    if (question.type === 'multiple-choice') {
      const options = question.options || [];
      onUpdate({ options: [...options, ''] });
    }
  };

  const updateOption = (optionIndex: number, value: string) => {
    if (question.type === 'multiple-choice') {
      const options = [...(question.options || [])];
      options[optionIndex] = value;
      onUpdate({ options });
    }
  };

  const removeOption = (optionIndex: number) => {
    if (question.type === 'multiple-choice') {
      const options = [...(question.options || [])];
      options.splice(optionIndex, 1);
      onUpdate({ options });
      
      // If the correct answer was the removed option, reset it
      if (question.correctAnswer === optionIndex) {
        onUpdate({ correctAnswer: 0 });
      } else if (typeof question.correctAnswer === 'number' && question.correctAnswer > optionIndex) {
        onUpdate({ correctAnswer: (question.correctAnswer as number) - 1 });
      }
    }
  };

  return (
    <Card 
      ref={ref} 
      className={`transition-opacity ${isDragging ? 'opacity-50' : 'opacity-100'}`}
    >
      <CardContent className="p-6">
        <div className="flex gap-4">
          {/* Drag Handle */}
          <div className="flex-shrink-0 cursor-move pt-2">
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>

          <div className="flex-1 space-y-4">
            {/* Question Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-900">Question {index + 1}</span>
                  <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                    {question.type === 'multiple-choice' && 'Multiple Choice'}
                    {question.type === 'true-false' && 'True/False'}
                    {question.type === 'short-answer' && 'Short Answer'}
                  </span>
                </div>
                <Input
                  placeholder="Enter your question"
                  value={question.question}
                  onChange={(e) => onUpdate({ question: e.target.value })}
                  className="text-base"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Multiple Choice Options */}
            {question.type === 'multiple-choice' && (
              <div className="space-y-3">
                <Label>Answer Options</Label>
                <RadioGroup 
                  value={question.correctAnswer?.toString()}
                  onValueChange={(value) => onUpdate({ correctAnswer: parseInt(value) })}
                >
                  {question.options?.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <RadioGroupItem value={optionIndex.toString()} id={`q${index}-opt${optionIndex}`} />
                      <Input
                        placeholder={`Option ${optionIndex + 1}`}
                        value={option}
                        onChange={(e) => updateOption(optionIndex, e.target.value)}
                        className="flex-1"
                      />
                      {question.options && question.options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(optionIndex)}
                        >
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
                <p className="text-xs text-gray-600">Select the correct answer by clicking the radio button</p>
              </div>
            )}

            {/* True/False */}
            {question.type === 'true-false' && (
              <div className="space-y-3">
                <Label>Correct Answer</Label>
                <RadioGroup 
                  value={question.correctAnswer?.toString()}
                  onValueChange={(value) => onUpdate({ correctAnswer: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="true" id={`q${index}-true`} />
                    <Label htmlFor={`q${index}-true`} className="cursor-pointer">True</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="false" id={`q${index}-false`} />
                    <Label htmlFor={`q${index}-false`} className="cursor-pointer">False</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Short Answer */}
            {question.type === 'short-answer' && (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Input
                  placeholder="Enter the correct answer"
                  value={question.correctAnswer?.toString() || ''}
                  onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
                />
                <p className="text-xs text-gray-600">Answers will be checked case-insensitively</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
