import { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  Users, 
  MessageCircle, 
  Heart, 
  Camera,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const onboardingSteps = [
    {
      icon: <Users className="w-16 h-16 text-blue-500" />,
      title: "Welcome to Rewsta",
      description: "Join a vibrant community where your voice matters and connections flourish.",
      gradient: "from-blue-500 to-purple-600"
    },
    {
      icon: <MessageCircle className="w-16 h-16 text-green-500" />,
      title: "Share Your Story",
      description: "Express yourself through posts, stories, and meaningful conversations with friends.",
      gradient: "from-green-500 to-teal-600"
    },
    {
      icon: <Heart className="w-16 h-16 text-pink-500" />,
      title: "Build Connections",
      description: "Discover like-minded people, follow your interests, and create lasting friendships.",
      gradient: "from-pink-500 to-rose-600"
    },
    {
      icon: <Camera className="w-16 h-16 text-orange-500" />,
      title: "Capture Moments",
      description: "Share your world through photos and videos that tell your unique story.",
      gradient: "from-orange-500 to-red-600"
    }
  ];

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % onboardingSteps.length);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  const nextStep = () => {
    setCurrentStep((prev) => (prev + 1) % onboardingSteps.length);
  };

  const prevStep = () => {
    setCurrentStep((prev) => (prev - 1 + onboardingSteps.length) % onboardingSteps.length);
  };

  const goToStep = (step) => {
    setCurrentStep(step);
  };

  const handleGetStarted = () => {
    // This would typically navigate to the main app
    alert('Welcome to Rewsta! Let\'s get started.');
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-32 h-32 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-purple-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        
        {/* Logo section */}
        <div className={`mb-12 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 mx-auto shadow-2xl">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Rewsta
          </h1>
        </div>

        {/* Onboarding content */}
        <div className="w-full max-w-md mx-auto">
          <div className="relative h-96 mb-8">
            {onboardingSteps.map((step, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-all duration-700 transform ${
                  index === currentStep
                    ? 'translate-x-0 opacity-100 scale-100'
                    : index < currentStep
                    ? '-translate-x-full opacity-0 scale-95'
                    : 'translate-x-full opacity-0 scale-95'
                }`}
              >
                <div className="text-center h-full flex flex-col justify-center">
                  {/* Icon with gradient background */}
                  <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${step.gradient} p-6 mx-auto mb-8 shadow-2xl transform transition-transform duration-300 hover:scale-110`}>
                    <div className="w-full h-full flex items-center justify-center">
                      {step.icon}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <h2 className="text-3xl font-bold mb-6 text-white">
                    {step.title}
                  </h2>
                  <p className="text-lg text-gray-300 leading-relaxed px-4">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Progress indicators */}
          <div className="flex justify-center space-x-3 mb-8">
            {onboardingSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => goToStep(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'bg-blue-500 scale-125'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={prevStep}
              className="flex items-center space-x-2 px-4 py-2 text-gray-400 hover:text-white transition-colors duration-200"
            >
              <ChevronRight className="w-5 h-5 transform rotate-180" />
              <span>Previous</span>
            </button>
            
            <button
              onClick={nextStep}
              className="flex items-center space-x-2 px-4 py-2 text-gray-400 hover:text-white transition-colors duration-200"
            >
              <span>Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Get Started button */}
          <button
            onClick={handleGetStarted}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 group"
          >
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-200" />
          </button>

          {/* Skip option */}
          <button
            onClick={handleGetStarted}
            className="w-full mt-4 text-gray-400 hover:text-white transition-colors duration-200 py-2"
          >
            Skip introduction
          </button>
        </div>
      </div>

      {/* Floating particles animation */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </div>
  );
}