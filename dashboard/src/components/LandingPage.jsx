import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, Zap, Lock, Globe } from 'lucide-react';

const FeatureCard = ({ icon, title, desc }) => (
  <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-slate-400 leading-relaxed">{desc}</p>
  </div>
);

const LandingPage = ({ onGetStarted }) => {
  return (
    <motion.div 
      key="landing"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl w-full text-center space-y-12 z-10"
    >
      <div className="space-y-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-block px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-semibold mb-4"
        >
          🚀 Now in Private Beta
        </motion.div>
        <h1 className="text-6xl md:text-7xl font-extrabold leading-tight tracking-tight">
          Universal <span className="gradient-text">Playwright</span> <br />
          AI Framework
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Next-generation test automation platform. Deploy AI-driven tests across multiple domains with pixel-perfect precision and self-healing locators.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button 
          onClick={onGetStarted}
          className="px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all shadow-xl shadow-brand-500/25 flex items-center gap-2 group"
        >
          Start Free Integration <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>
        <button className="px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all">
          View Documentation
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12"
      >
        <FeatureCard 
          icon={<Zap className="text-brand-400" />}
          title="Model-Driven"
          desc="Choose between Standard UI, Hybrid API+UI, or Visual Regression models."
        />
        <FeatureCard 
          icon={<Lock className="text-brand-400" />}
          title="Enterprise Security"
          desc="Strict domain-based licensing and multi-tenant isolation for your data."
        />
        <FeatureCard 
          icon={<Globe className="text-brand-400" />}
          title="Global Scale"
          desc="Manage 100+ projects and domains in one unified, high-performance dashboard."
        />
      </motion.div>
    </motion.div>
  );
};

export default LandingPage;
