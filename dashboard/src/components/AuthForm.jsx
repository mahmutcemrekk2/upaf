import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { authService } from '../services/auth';

const AuthForm = ({ initialMode = 'login', onSuccess }) => {
  const [authMode, setAuthMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (authMode === 'signup') {
        await authService.signUp(email, password);
        alert('Check your email for the confirmation link!');
      } else {
        await authService.signIn(email, password);
        onSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      key="login"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-md p-8 glass rounded-3xl shadow-2xl space-y-8 z-10"
    >
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">
          {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-slate-400">
          {authMode === 'login' 
            ? 'Login to access your UPAF dashboard' 
            : 'Start your 14-day free trial today'}
        </p>
      </div>
      
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Work Email</label>
          <input 
            type="email" 
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-brand-500 focus:outline-none transition-colors placeholder:text-slate-600"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-slate-300">Password</label>
            {authMode === 'login' && (
              <button type="button" className="text-xs text-brand-400 hover:text-brand-300 font-medium">Forgot?</button>
            )}
          </div>
          <input 
            type="password" 
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-brand-500 focus:outline-none transition-colors placeholder:text-slate-600"
          />
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : (authMode === 'login' ? 'Continue to UPAF' : 'Set Up Infrastructure')} <ArrowRight size={20} />
        </button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-dark-950 px-2 text-slate-500">Or</span></div>
        </div>

        <button 
          type="button"
          className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all"
        >
          Sign in with Magic Link
        </button>
      </form>

      <p className="text-center text-sm text-slate-400">
        {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
        <button 
          onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          className="ml-2 text-brand-400 hover:text-brand-300 font-bold"
        >
          {authMode === 'login' ? 'Sign Up' : 'Log In'}
        </button>
      </p>
    </motion.div>
  );
};

export default AuthForm;
