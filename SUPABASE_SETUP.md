# Supabase Setup Instructions for Quizify

Follow these steps to set up your Supabase backend for Quizify:

## 1. Enable Email Authentication

1. Go to your Supabase project dashboard at: https://supabase.com/dashboard/project/yxfrsmohrjtusijhqphy
2. Navigate to **Authentication** → **Providers**
3. Enable **Email** provider
4. **Important**: Disable email confirmation for easier testing:
   - Go to **Authentication** → **Settings**
   - Under "Email Auth", turn OFF "Enable email confirmations"
   - This allows users to sign up and login immediately without email verification

## 2. Create Database Tables

1. Go to **SQL Editor** in your Supabase dashboard
2. Click **New Query**
3. Copy the entire contents of `/supabase/schema.sql` file
4. Paste it into the SQL editor
5. Click **Run** to execute the SQL

This will create:
- `quizzes` table - stores all quizzes
- `questions` table - stores question bank
- `quiz_attempts` table - stores quiz submission attempts
- Proper Row Level Security (RLS) policies for data protection
- Indexes for better performance

## 3. Verify Setup

After running the SQL, verify the tables were created:
1. Go to **Table Editor**
2. You should see three tables: `quizzes`, `questions`, and `quiz_attempts`

## 4. Test the Application

1. Your app is now connected to Supabase!
2. Try signing up with a new account
3. Create a quiz
4. Share the quiz and submit an attempt
5. Check the analytics

## Database Schema Overview

### quizzes table
- `id` (UUID) - Primary key
- `user_id` (UUID) - References auth.users
- `title` (TEXT) - Quiz title
- `description` (TEXT) - Quiz description
- `questions` (JSONB) - Array of question objects
- `settings` (JSONB) - Quiz settings (time limit, passing score, etc.)
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

### questions table
- `id` (UUID) - Primary key
- `user_id` (UUID) - References auth.users
- `type` (TEXT) - Question type (multiple-choice, true-false, short-answer)
- `question` (TEXT) - Question text
- `options` (JSONB) - Answer options (for multiple choice)
- `correct_answer` (TEXT) - Correct answer
- `points` (INTEGER) - Points for this question
- `created_at` (TIMESTAMP) - Creation timestamp

### quiz_attempts table
- `id` (UUID) - Primary key
- `quiz_id` (UUID) - References quizzes table
- `user_name` (TEXT) - Name of person taking quiz
- `user_email` (TEXT) - Email of person taking quiz
- `answers` (JSONB) - Array of submitted answers
- `score` (INTEGER) - Percentage score
- `correct_answers` (INTEGER) - Number of correct answers
- `total_questions` (INTEGER) - Total questions in quiz
- `passed` (BOOLEAN) - Whether they passed
- `time_spent` (INTEGER) - Time spent in seconds
- `created_at` (TIMESTAMP) - Submission timestamp

## Security Features

The database includes Row Level Security (RLS) policies:
- Users can only view/edit/delete their own quizzes and questions
- Quiz creators can view all attempts for their quizzes
- Anyone can submit quiz attempts (for public quiz taking)
- All data is protected and isolated per user

## Troubleshooting

### If authentication fails:
- Make sure email authentication is enabled
- Verify email confirmation is disabled for testing
- Check browser console for detailed error messages

### If data operations fail:
- Verify all tables were created successfully
- Check that RLS policies are in place
- Make sure you're signed in with a valid account

### To switch back to localStorage:
If you need to disable Supabase temporarily, edit `/src/app/lib/supabase.ts`:
```typescript
const hasSupabaseCredentials = false; // Force disable Supabase
```

## Next Steps

Once everything is working:
1. Consider enabling email confirmation in production
2. Set up custom email templates in Supabase
3. Configure additional security rules as needed
4. Set up backups for your database
