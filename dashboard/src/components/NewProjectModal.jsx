import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TerminalSquare, MousePointerClick, Image as ImageIcon, ArrowRight, CheckCircle2, Settings2, Code2, Globe, Shield, Key, Plus } from 'lucide-react';
import { projectService } from '../services/projects';
import { parseCurl } from '../utils/curlParser';

const parseHeaders = (headersStr) => {
  if (!headersStr) return {};
  const trimmed = headersStr.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // JSON parsing failed, fallback to line-based parsing
    }
  }

  const headers = {};
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    const match = cleanLine.match(/^([^:=]+)[:=](.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      headers[key] = val;
    }
  }
  return headers;
};

const NewProjectModal = ({ isOpen, onClose, onSuccess, initialData = null }) => {
  const [step, setStep] = useState(1); // 1: Select Type, 2: Project Details, 3: Success Mock
  const [selectedType, setSelectedType] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [environments, setEnvironments] = useState([
    { name: 'Production', url: '', variables: '{}', headers: '{}', showAdvanced: false }
  ]);
  const [gitConfig, setGitConfig] = useState({
    provider: 'github',
    repoUrl: '',
    branch: 'main',
    token: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [authMethods, setAuthMethods] = useState([]);
  const [testResponse, setTestResponse] = useState({}); // { [idx]: responseData }
  const [showGit, setShowGit] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (initialData) {
      setStep(2); // Directly to details for edit
      setProjectName(initialData.name || '');
      setSelectedType(initialData.type || 'api');
      setEnvironments(initialData.environments || [{ name: 'Production', url: '', variables: '{}', headers: '{}', showAdvanced: false }]);
      setGitConfig({
        provider: initialData.git_provider || 'github',
        repoUrl: initialData.git_repo_url || '',
        branch: initialData.git_branch || 'main',
        token: initialData.git_token || ''
      });
      setAuthMethods(initialData.auth_methods || []);
      setShowGit(!!initialData.git_repo_url);
      setShowAuth(initialData.auth_methods?.length > 0);
    }
  }, [initialData]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setSelectedType(null);
      setProjectName('');
      setEnvironments([{ name: 'Production', url: '', variables: '{}', headers: '{}', showAdvanced: false }]);
      setGitConfig({ provider: 'github', repoUrl: '', branch: 'main', token: '' });
      setAuthMethods([]);
      setShowGit(false);
      setShowAuth(false);
    }, 300);
  };

  const addEnvironment = () => {
    setEnvironments([...environments, { name: '', url: '', variables: '{}', headers: '{}', showAdvanced: false }]);
  };

  const updateEnvironment = (index, field, value) => {
    const newEnvs = [...environments];
    newEnvs[index][field] = value;
    setEnvironments(newEnvs);
  };

  const toggleAdvanced = (index) => {
    const newEnvs = [...environments];
    newEnvs[index].showAdvanced = !newEnvs[index].showAdvanced;
    setEnvironments(newEnvs);
  };

  const removeEnvironment = (index) => {
    const newEnvs = environments.filter((_, i) => i !== index);
    setEnvironments(newEnvs);
  };

  const projectTypes = [
    {
      id: 'api',
      title: 'API Testing',
      description: 'Test your backend endpoints, validate JSON responses, and monitor API health.',
      icon: <TerminalSquare size={32} />,
      color: 'from-blue-500 to-cyan-400',
      glow: 'group-hover:shadow-cyan-500/20'
    },
    {
      id: 'hybrid',
      title: 'Hybrid (UI + API)',
      description: 'End-to-end browser interactions combined with underlying network request validation.',
      icon: <MousePointerClick size={32} />,
      color: 'from-brand-500 to-purple-500',
      glow: 'group-hover:shadow-brand-500/20'
    },
    {
      id: 'visual',
      title: 'Visual Regression',
      description: 'Pixel-perfect screenshot comparisons across multiple viewports and browsers.',
      icon: <ImageIcon size={32} />,
      color: 'from-pink-500 to-rose-400',
      glow: 'group-hover:shadow-pink-500/20'
    }
  ];

  const handleSelectType = (typeId) => {
    setSelectedType(typeId);
    setTimeout(() => setStep(2), 150);
  };

  const handleTestAuth = async (idx) => {
    const auth = authMethods[idx];
    if (!auth.url) return;

    setTestResponse(prev => ({ ...prev, [idx]: { loading: true } }));
    
    try {
      const headers = parseHeaders(auth.headers);
      
      // Zero-logic, direct pass to proxy to match the successful node script
      const proxyUrl = import.meta.env.DEV ? '/proxy' : 'http://localhost:5175/proxy';
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: auth.url,
          method: auth.method,
          headers: headers,
          body: auth.method !== 'GET' ? auth.body.replace(/\n/g, '&') : null,
          extractCookies: true
        })
      });

      const data = await res.json();
      
      setTestResponse(prev => ({ ...prev, [idx]: { 
         loading: false, 
         data, 
         status: res.status,
         isJson: true
      } }));
    } catch (err) {
      setTestResponse(prev => ({ 
        ...prev, 
        [idx]: { 
          loading: false, 
          error: "Proxy connection failed. Check terminal."
        } 
      }));
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const isValidFormat = (str) => {
      if (!str) return true;
      const trimmed = str.trim();
      if (!trimmed) return true;
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          JSON.parse(trimmed);
          return true;
        } catch (e) {
          return false;
        }
      }
      const lines = trimmed.split('\n');
      for (const line of lines) {
        const clean = line.trim();
        if (!clean) continue;
        if (!clean.includes(':') && !clean.includes('=')) {
          return false;
        }
      }
      return true;
    };

    // Validate variables & headers
    for (const env of environments) {
      if (!isValidFormat(env.variables)) {
        setError(`Invalid format in variables for environment: ${env.name}. Use JSON or 'Key: Value' format.`);
        setIsSubmitting(false);
        return;
      }
      if (!isValidFormat(env.headers)) {
        setError(`Invalid format in headers for environment: ${env.name}. Use JSON or 'Key: Value' format.`);
        setIsSubmitting(false);
        return;
      }
    }

    const projectPayload = {
      name: projectName,
      type: selectedType,
      environments: environments.map(({ showAdvanced, ...rest }) => rest),
      gitConfig: showGit ? gitConfig : null,
      authMethods: authMethods
    };

    const { data, error } = initialData?.id 
      ? await projectService.updateProject(initialData.id, projectPayload)
      : await projectService.createProject(projectPayload);

    if (error) {
      setError(error.message || 'Failed to create project');
      setIsSubmitting(false);
      return;
    }

    setStep(3);
    setTimeout(() => {
      if (onSuccess) onSuccess(data);
      handleClose();
      setIsSubmitting(false);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto pt-10 pb-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-dark-950/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-6 border-b border-white/5 relative z-10 bg-dark-900/50 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
              {step === 1 && <><Globe size={20} className="text-brand-500" /> Choose Test Strategy</>}
              {step === 2 && <><Settings2 size={20} className="text-brand-500" /> {initialData ? 'Project Settings' : 'Infrastructure Setup'}</>}
              {step === 3 && (initialData ? "Updating Workspace..." : "Initializing Workspace...")}
            </h2>
            <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-8 overflow-y-auto relative z-10 flex-1">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {projectTypes.map((type) => (
                    <button key={type.id} onClick={() => handleSelectType(type.id)} className={`group relative text-left p-6 rounded-2xl border transition-all duration-300 ${selectedType === type.id ? 'border-brand-500 bg-brand-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 shadow-xl'}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${type.color} text-white shadow-lg`}>
                        {type.icon}
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{type.title}</h3>
                      <p className="text-slate-400 text-xs leading-relaxed">{type.description}</p>
                    </button>
                  ))}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Project Identity</label>
                    <input
                      type="text"
                      required
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. My SaaS API"
                      className="w-full px-4 py-3 rounded-xl bg-dark-950 border border-white/10 focus:border-brand-500 outline-none text-white transition-all"
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Environments & Global Config</label>
                      <button type="button" onClick={addEnvironment} className="px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-400 text-[10px] font-bold uppercase hover:bg-brand-500/20 transition-all">
                        + New Environment
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {environments.map((env, idx) => (
                        <div key={idx} className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
                          <div className="flex gap-3">
                            <div className="w-1/4">
                              <input
                                type="text"
                                required
                                value={env.name}
                                onChange={(e) => updateEnvironment(idx, 'name', e.target.value)}
                                placeholder="Env Name (e.g. Prod)"
                                className="w-full px-3 py-2.5 rounded-xl bg-dark-950 border border-white/10 focus:border-brand-500 outline-none text-sm text-white"
                              />
                            </div>
                            <div className="flex-1">
                              <input
                                type="url"
                                required
                                value={env.url}
                                onChange={(e) => updateEnvironment(idx, 'url', e.target.value)}
                                placeholder="Base URL (https://api.myapp.com)"
                                className="w-full px-3 py-2.5 rounded-xl bg-dark-950 border border-white/10 focus:border-brand-500 outline-none text-sm text-white font-mono"
                              />
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => toggleAdvanced(idx)}
                                className={`p-2.5 rounded-xl border transition-all ${env.showAdvanced ? 'bg-brand-500/20 border-brand-500/50 text-brand-400' : 'bg-dark-950 border-white/10 text-slate-500 hover:text-white'}`}
                                title="Config (Headers & Variables)"
                              >
                                <Settings2 size={18} />
                              </button>
                              {environments.length > 1 && (
                                <button type="button" onClick={() => removeEnvironment(idx)} className="p-2.5 rounded-xl bg-dark-950 border border-white/10 text-slate-500 hover:text-rose-400 transition-all">
                                  <X size={18} />
                                </button>
                              )}
                            </div>
                          </div>

                          <AnimatePresence>
                            {env.showAdvanced && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-2 grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><Code2 size={12} /> Default Headers (JSON)</label>
                                  <textarea
                                    value={env.headers}
                                    onChange={(e) => updateEnvironment(idx, 'headers', e.target.value)}
                                    placeholder='{ "Authorization": "Bearer token" }'
                                    className="w-full h-32 bg-dark-950 border border-white/5 rounded-xl p-3 text-xs text-brand-300 font-mono focus:border-brand-500 outline-none resize-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><TerminalSquare size={12} /> Global Variables (JSON)</label>
                                  <textarea
                                    value={env.variables}
                                    onChange={(e) => updateEnvironment(idx, 'variables', e.target.value)}
                                    placeholder='{ "userId": "123", "apiKey": "ABC" }'
                                    className="w-full h-32 bg-dark-950 border border-white/5 rounded-xl p-3 text-xs text-emerald-300 font-mono focus:border-brand-500 outline-none resize-none"
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AUTH METHODS SECTION */}
                  <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                    <button 
                      type="button"
                      onClick={() => setShowAuth(!showAuth)}
                      className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${showAuth ? 'bg-amber-500 text-white' : 'bg-dark-950 text-slate-500'}`}>
                          <Shield size={20} />
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-bold text-white">Authentication Methods</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Define how to acquire tokens (Login, OAuth, etc.)</p>
                        </div>
                      </div>
                      <ArrowRight size={18} className={`text-slate-500 transition-transform ${showAuth ? 'rotate-90' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showAuth && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-6 pb-6 space-y-4"
                        >
                          {authMethods.map((auth, idx) => (
                            <div key={idx} className="p-4 bg-dark-950 rounded-xl border border-white/5 space-y-4 relative">
                              <button 
                                onClick={() => setAuthMethods(authMethods.filter((_, i) => i !== idx))}
                                className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400"
                              >
                                <X size={14} />
                              </button>

                              {/* Token Identity */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Token Name (Alias)</label>
                                  <input 
                                    placeholder="e.g. USER_TOKEN"
                                    value={auth.name}
                                    onChange={(e) => {
                                      const newMethods = [...authMethods];
                                      newMethods[idx].name = e.target.value.toUpperCase().replace(/\s+/g, '_');
                                      setAuthMethods(newMethods);
                                    }}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-brand-400 font-bold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Usage Strategy</label>
                                  <select 
                                    value={auth.usageType}
                                    onChange={(e) => {
                                      const newMethods = [...authMethods];
                                      newMethods[idx].usageType = e.target.value;
                                      setAuthMethods(newMethods);
                                    }}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
                                  >
                                    <option value="Bearer">Bearer Token</option>
                                    <option value="Cookie">Cookie</option>
                                    <option value="CustomHeader">Custom Header</option>
                                  </select>
                                </div>
                              </div>

                              {/* cURL Input */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Import from cURL (Optional)</label>
                                <textarea 
                                  placeholder="Paste cURL here to auto-fill fields..."
                                  value={auth.curl}
                                  onChange={(e) => {
                                    const newMethods = [...authMethods];
                                    newMethods[idx].curl = e.target.value;
                                    const parsed = parseCurl(e.target.value);
                                    if (parsed.url) {
                                      newMethods[idx].url = parsed.url;
                                      newMethods[idx].method = parsed.method;
                                      newMethods[idx].body = parsed.body;
                                      newMethods[idx].headers = JSON.stringify(parsed.headers, null, 2);
                                    }
                                    setAuthMethods(newMethods);
                                  }}
                                  className="w-full h-20 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] text-brand-200 font-mono resize-none focus:border-brand-500/50 outline-none"
                                />
                              </div>

                              {/* Manual Postman-style Fields */}
                              <div className="grid grid-cols-6 gap-2">
                                <div className="col-span-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Method</label>
                                  <select 
                                    value={auth.method}
                                    onChange={(e) => {
                                      const newMethods = [...authMethods];
                                      newMethods[idx].method = e.target.value;
                                      setAuthMethods(newMethods);
                                    }}
                                    className="w-full px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
                                  >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                  </select>
                                </div>
                                <div className="col-span-5">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Auth URL</label>
                                  <input 
                                    value={auth.url}
                                    onChange={(e) => {
                                      const newMethods = [...authMethods];
                                      newMethods[idx].url = e.target.value;
                                      setAuthMethods(newMethods);
                                    }}
                                    placeholder="https://api.example.com/auth/token"
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white font-mono"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Headers (JSON)</label>
                                  <textarea 
                                    value={auth.headers}
                                    onChange={(e) => {
                                      const newMethods = [...authMethods];
                                      newMethods[idx].headers = e.target.value;
                                      setAuthMethods(newMethods);
                                    }}
                                    className="w-full h-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] text-slate-300 font-mono resize-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Body (Raw / Form-Encoded)</label>
                                  <textarea 
                                    value={auth.body}
                                    onChange={(e) => {
                                      const newMethods = [...authMethods];
                                      newMethods[idx].body = e.target.value;
                                      setAuthMethods(newMethods);
                                    }}
                                    placeholder="client_id=...&grant_type=..."
                                    className="w-full h-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] text-slate-300 font-mono resize-none"
                                  />
                                </div>
                              </div>

                              {/* Extraction Path */}
                              <div className="grid grid-cols-2 gap-3 items-end">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Token Path (JSON Path)</label>
                                  <input 
                                    placeholder="e.g. data.token"
                                    value={auth.tokenPath}
                                    onChange={(e) => {
                                      const newMethods = [...authMethods];
                                      newMethods[idx].tokenPath = e.target.value;
                                      setAuthMethods(newMethods);
                                    }}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white font-mono"
                                  />
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => handleTestAuth(idx)}
                                  className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase hover:bg-amber-500/20 transition-all h-[34px]"
                                >
                                  {testResponse[idx]?.loading ? 'Testing...' : 'Test & Map Response'}
                                </button>
                              </div>

                              {/* Test Result Preview */}
                              {testResponse[idx] && (
                                <div className="mt-2 p-3 bg-black/40 rounded-lg border border-white/5 text-[10px] font-mono overflow-auto max-h-48">
                                  {testResponse[idx].error ? (
                                    <div className="space-y-2">
                                      <div className="text-rose-400">Error: {testResponse[idx].error}</div>
                                      <div className="p-2 bg-rose-500/10 rounded border border-rose-500/20 text-[9px] text-rose-300">
                                        DEBUG: Tried {auth.method} to {auth.url}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="text-emerald-400">Status: {testResponse[idx].status}</div>
                                      <div className="text-slate-500 text-[9px] mb-1">Request: {auth.method} {auth.url}</div>
                                      <pre className="text-brand-300">{JSON.stringify(testResponse[idx].data, null, 2)}</pre>
                                    </div>
                                  )}
                                </div>
                              )}

                              {auth.usageType === 'CustomHeader' && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Header Name</label>
                                  <input 
                                    placeholder="e.g. X-Auth-Token"
                                    value={auth.headerName}
                                    onChange={(e) => {
                                      const newMethods = [...authMethods];
                                      newMethods[idx].headerName = e.target.value;
                                      setAuthMethods(newMethods);
                                    }}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                          <button 
                            type="button"
                            onClick={() => setAuthMethods([...authMethods, { 
                              name: 'TOKEN_' + (authMethods.length + 1), 
                              curl: '', 
                              tokenPath: 'access_token',
                              usageType: 'Bearer',
                              headerName: 'Authorization',
                              url: '',
                              method: 'POST',
                              body: '{}',
                              headers: '{}'
                            }])}
                            className="w-full py-3 border border-dashed border-white/10 rounded-xl text-xs text-slate-500 hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus size={14} /> Add Named Token Provider
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* GIT INTEGRATION SECTION */}
                  <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                    <button 
                      type="button"
                      onClick={() => setShowGit(!showGit)}
                      className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${showGit ? 'bg-brand-500 text-white' : 'bg-dark-950 text-slate-500'}`}>
                          <Code2 size={20} />
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-bold text-white">Git Integration (Optional)</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Automate push/PR to your GitHub or GitLab repo.</p>
                        </div>
                      </div>
                      <ArrowRight size={18} className={`text-slate-500 transition-transform ${showGit ? 'rotate-90' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showGit && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-6 pb-6 space-y-4"
                        >
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Provider</label>
                              <select 
                                value={gitConfig.provider}
                                onChange={(e) => setGitConfig({ ...gitConfig, provider: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-sm outline-none focus:border-brand-500"
                              >
                                <option value="github">GitHub</option>
                                <option value="gitlab">GitLab</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Default Branch</label>
                              <input 
                                type="text"
                                value={gitConfig.branch}
                                onChange={(e) => setGitConfig({ ...gitConfig, branch: e.target.value })}
                                placeholder="main"
                                className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-sm outline-none focus:border-brand-500"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Repository URL</label>
                            <input 
                              type="text"
                              value={gitConfig.repoUrl}
                              onChange={(e) => setGitConfig({ ...gitConfig, repoUrl: e.target.value })}
                              placeholder="e.g. username/repo-name"
                              className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-sm outline-none focus:border-brand-500 font-mono"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Personal Access Token</label>
                            <input 
                              type="password"
                              value={gitConfig.token}
                              onChange={(e) => setGitConfig({ ...gitConfig, token: e.target.value })}
                              placeholder="ghp_xxxxxxxxxxxx"
                              className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-white text-sm outline-none focus:border-brand-500 font-mono"
                            />
                            <p className="text-[9px] text-slate-500 italic">This token is used only for pushing tests. Keep it secure.</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">{error}</div>}

                  <div className="pt-4 flex items-center justify-between border-t border-white/5">
                    <button type="button" onClick={() => setStep(1)} className="text-slate-500 hover:text-white text-sm font-medium">Back to Types</button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      onClick={handleCreateProject}
                      className="px-10 py-3.5 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-bold shadow-xl shadow-brand-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (initialData ? 'Saving...' : 'Initializing...') : (initialData ? 'Save Changes' : 'Initialize Project')} <ArrowRight size={18} />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={40} className="text-emerald-400" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-2">Workspace Ready!</h3>
                  <p className="text-slate-400 text-sm">Deploying test infrastructure...</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NewProjectModal;
