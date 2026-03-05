# AI Quiz Generator Guide

## Overview
The AI Quiz Generator automatically creates quiz questions from uploaded files or pasted content. It supports multiple question types and various content formats.

## How to Use

### 1. Access the Generator
- Go to Quiz Builder (create new quiz or edit existing)
- Click the **"AI Generate"** button (purple gradient button with sparkle icon)

### 2. Input Your Content

#### Option A: Upload a File
- Drag and drop a file (.txt, .md, .json)
- Or click "Choose File" to browse
- Maximum file size: 1MB

#### Option B: Paste Content
- Click "Paste Content" to paste from clipboard
- Or manually paste in the text area
- Click "Generate Questions"

### 3. Supported Formats

#### Markdown with Bullets (Recommended)
```
History Quiz
- Who was the first President of the United States?
- Thomas Jefferson
- George Washington ✅
- John Adams
- James Madison
```

✅ Use checkmark (✅, ✓, or [x]) to mark correct answers

#### Q&A Format
```
Q: What is the capital of France?
A: Paris

Q: Is the Earth flat?
A: False
```

#### Numbered List
```
1. What is 2+2?
a) 3
b) 4 *
c) 5

2. The sky is blue
a) True *
b) False
```

Use * or ✅ to mark correct answers

### 4. Question Types Auto-Detected

- **Multiple Choice**: Questions with 3+ options
- **True/False**: Questions with exactly 2 options (True/False or Yes/No)
- **Short Answer**: Q&A format or single questions

### 5. Review & Import

1. Preview generated questions in the green panel
2. Check question count and types
3. Click "Add X Questions to Quiz"
4. Questions are automatically added to your quiz
5. Edit individual questions as needed

## Features

✨ **Smart Parsing**
- Automatically detects question types
- Extracts quiz title from first line
- Handles various formats

⚡ **Fast Processing**
- Instant preview
- No server delays
- Process hundreds of questions

🎯 **Accurate Detection**
- Identifies correct answers
- Validates question structure
- Reports parsing errors

## Tips for Best Results

1. **Clear Formatting**: Use consistent bullet points or numbering
2. **Mark Answers**: Always use ✅, ✓, [x], or * for correct answers
3. **One Question Per Block**: Separate questions with blank lines
4. **Valid Options**: Multiple choice needs 2+ options
5. **Check Preview**: Review questions before adding

## Example Files

Check `/src/imports/history-quiz.md` for a complete example!

## Troubleshooting

**No questions generated?**
- Check your format matches the examples above
- Make sure correct answers are marked
- Try a simpler format first

**Wrong question type?**
- True/False must have exactly 2 options
- Multiple choice needs 3+ options
- Check option formatting

**Parsing errors?**
- Review the error messages
- Fix formatting issues
- Ensure consistent structure

## Future Enhancements

Coming soon:
- AI-powered question generation from plain text
- Support for images in questions
- Bulk import from spreadsheets
- Question difficulty detection
