import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';
import { authService } from './services/auth';
import LandingPage from './components/LandingPage';
import AuthForm from './components/AuthForm';
import DashboardPage from './pages/DashboardPage';
import TestBuilderPage from './pages/TestBuilderPage';

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); // 'landing', 'auth'
  const [initialAuthMode, setInitialAuthMode] = useState('login');
  const [initializing, setInitializing] = useState(true);
  const [activeProject, setActiveProject] = useState(null); // Stores project info to open builder

  useEffect(() => {
    // Check current session
    authService.getCurrentUser().then(user => {
      setUser(user);
      setInitializing(false);
    });
  }, []);

  const handleLogout = async () => {
    await authService.signOut();
    setUser(null);
    setView('landing');
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    if (activeProject) {
      return (
        <TestBuilderPage 
          project={activeProject} 
          onBack={() => setActiveProject(null)} 
          user={user}
        />
      );
    }
    return (
      <DashboardPage 
        onLogout={handleLogout} 
        user={user} 
        onOpenProject={(projectDetails) => setActiveProject(projectDetails)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-dark-950 text-white selection:bg-brand-500/30">
      {/* Navbar */}
      <nav className="p-6 flex justify-between items-center border-b border-white/5 glass sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Shield className="text-white" size={24} />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">UPAF</span>
        </div>
        <button 
          onClick={() => {
            setInitialAuthMode('login');
            setView(view === 'auth' ? 'landing' : 'auth');
          }}
          className="px-6 py-2 rounded-full bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all shadow-lg shadow-brand-500/20 active:scale-95"
        >
          {view === 'auth' ? 'Back to Home' : 'Client Login'}
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />

        <AnimatePresence mode="wait">
          {view === 'landing' ? (
            <LandingPage 
              onGetStarted={() => {
                setInitialAuthMode('signup');
                setView('auth');
              }} 
            />
          ) : (
            <AuthForm 
              initialMode={initialAuthMode} 
              onSuccess={() => {
                authService.getCurrentUser().then(setUser);
              }}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;
