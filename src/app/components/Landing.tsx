import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { 
  Brain, 
  BarChart3, 
  Share2, 
  Clock, 
  Shuffle, 
  Award,
  CheckCircle2
} from 'lucide-react';
import { useEffect } from 'react';

export function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Quizify</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Create Engaging Quizzes
            <span className="block text-indigo-600 mt-2">In Minutes</span>
          </h2>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Build, share, and analyze quizzes with ease. Perfect for educators, trainers, and businesses.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="text-lg px-8 py-6">
                Start Creating Free
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Everything You Need
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <FeatureCard
            icon={<Brain className="w-10 h-10 text-indigo-600" />}
            title="Drag & Drop Builder"
            description="Create quizzes with an intuitive drag-and-drop interface. No technical skills required."
          />
          <FeatureCard
            icon={<Share2 className="w-10 h-10 text-indigo-600" />}
            title="Easy Sharing"
            description="Share quizzes via link or embed them directly on your website with a simple code."
          />
          <FeatureCard
            icon={<BarChart3 className="w-10 h-10 text-indigo-600" />}
            title="Detailed Analytics"
            description="Track completion rates, average scores, and identify difficult questions."
          />
          <FeatureCard
            icon={<Clock className="w-10 h-10 text-indigo-600" />}
            title="Time Limits"
            description="Set custom time limits for quizzes to create timed assessments."
          />
          <FeatureCard
            icon={<Shuffle className="w-10 h-10 text-indigo-600" />}
            title="Randomization"
            description="Shuffle questions and answers to prevent cheating and improve fairness."
          />
          <FeatureCard
            icon={<Award className="w-10 h-10 text-indigo-600" />}
            title="Custom Scoring"
            description="Define passing scores and create custom grading rules for your quizzes."
          />
        </div>
      </section>

      {/* Question Types */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-10">
          <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Multiple Question Types
          </h3>
          <div className="space-y-4">
            <QuestionType
              title="Multiple Choice"
              description="Classic multiple-choice questions with customizable options"
            />
            <QuestionType
              title="True/False"
              description="Simple true or false questions for quick assessments"
            />
            <QuestionType
              title="Short Answer"
              description="Open-ended questions that require text responses"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-12 text-white">
          <h3 className="text-4xl font-bold mb-4">
            Ready to Get Started?
          </h3>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of educators and businesses using Quizify to create better assessments.
          </p>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
              Create Your First Quiz
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600">
          <p>&copy; 2026 Quizify. Built with ❤️ for better learning.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
      <div className="mb-4">{icon}</div>
      <h4 className="text-xl font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function QuestionType({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2 className="w-6 h-6 text-green-600 mt-1 flex-shrink-0" />
      <div>
        <h5 className="font-semibold text-gray-900">{title}</h5>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );
}
