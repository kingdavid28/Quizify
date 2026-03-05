import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import { Landing } from './components/Landing';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Dashboard } from './components/Dashboard';
import { QuizBuilder } from './components/QuizBuilder';
import { QuizTaker } from './components/QuizTaker';
import { QuizResults } from './components/QuizResults';
import { QuizAnalytics } from './components/QuizAnalytics';
import { QuestionBank } from './components/QuestionBank';
import { NotFound } from './components/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/quiz/new" element={<QuizBuilder />} />
          <Route path="/quiz/:id/edit" element={<QuizBuilder />} />
          <Route path="/quiz/:id/analytics" element={<QuizAnalytics />} />
          <Route path="/questions" element={<QuestionBank />} />
          <Route path="/take/:id" element={<QuizTaker />} />
          <Route path="/results/:attemptId" element={<QuizResults />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}
