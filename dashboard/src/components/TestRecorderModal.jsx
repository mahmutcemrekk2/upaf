import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Square, Sparkles, CheckCircle2, Globe, ArrowRight, Video, AlertCircle, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TestRecorderModal({ isOpen, onClose, onSaveSteps, defaultUrl = 'https://example.com' }) {
  const [url, setUrl] = useState(defaultUrl);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [recordedSteps, setRecordedSteps] = useState([]);
  const [error, setError] = useState(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (defaultUrl) setUrl(defaultUrl);
  }, [defaultUrl]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleStartRecording = async () => {
    setError(null);
    setIsRecording(true);
    setRecordedSteps([]);

    let formattedUrl = url?.trim() || 'https://example.com';
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const serverUrl = 'http://localhost:5175';
    try {
      const res = await fetch(`${serverUrl}/api/recorder/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUrl: formattedUrl })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Recorder Error: ${res.status} ${errText}`);
      }

      const data = await res.json();
      setSessionId(data.sessionId);

      // Start polling recorded events
      pollIntervalRef.current = setInterval(async () => {
        try {
          const eventsRes = await fetch(`${serverUrl}/api/recorder/events?sessionId=${data.sessionId}`);
          if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            if (eventsData.steps) {
              setRecordedSteps(eventsData.steps);
            }
          }
        } catch (pollErr) {
          console.error('Failed polling events:', pollErr);
        }
      }, 600);

    } catch (err) {
      console.error('Start recording error:', err);
      setError(err.message || 'Canlı kaydedici başlatılamadı. Proxy sunucusunun (http://localhost:5175) çalıştığından emin olun.');
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const serverUrl = 'http://localhost:5175';
    try {
      if (sessionId) {
        const res = await fetch(`${serverUrl}/api/recorder/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.steps) setRecordedSteps(data.steps);
        }
      }
    } catch (e) {
      console.error('Stop recording error:', e);
    } finally {
      setIsRecording(false);
      setSessionId(null);
    }
  };


  const handleApplySteps = () => {
    if (recordedSteps.length > 0) {
      onSaveSteps(recordedSteps);
    }
    handleStopRecording();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 to-red-600/20 text-rose-400 border border-rose-500/30">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  Canlı Chrome Senaryo Kaydedici
                  {isRecording && (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      KAYDEDİLİYOR
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Açılan Chrome tarayıcısında tıklayın, yazı yazın ve validasyon ekleyin. Gherkin adımları otomatik üretilir.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                handleStopRecording();
                onClose();
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Hata Oluştu</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            {!isRecording ? (
              <div className="space-y-4">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Başlangıç URL Adresi
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/login"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-rose-500 transition-colors font-mono"
                    />
                  </div>
                  <button
                    onClick={handleStartRecording}
                    className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Kaydı Başlat
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-2">
                  <div className="font-medium text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Nasıl Kullanılır?
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>"Kaydı Başlat" butonuna bastığınızda harici bir Chrome penceresi açılacaktır.</li>
                    <li>Tarayıcıda yaptığınız her tıklama ve yazı girdisi otomatik Gherkin adımına çevrilir.</li>
                    <li>Sağ alttaki <b>✨ Validasyon Ekle</b> butonuna basarak sayfadaki alanları doğrulayabilirsiniz.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <div className="text-xs text-slate-300 font-mono">
                      Chrome Oturumu Aktif: <span className="text-indigo-400">{url}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleStopRecording}
                    className="px-4 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Kaydı Durdur
                  </button>
                </div>

                {/* Recorded Steps Stream */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Canlı Kaydedilen Adımlar ({recordedSteps.length})
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 min-h-[220px] max-h-[300px] overflow-y-auto space-y-2 font-mono text-xs">
                    {recordedSteps.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        Chrome pencereli tarayıcısında işlem yapmaya başlayın...
                      </div>
                    ) : (
                      recordedSteps.map((step, idx) => (
                        <div
                          key={step.id || idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-slate-200"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className="w-5 h-5 rounded bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            <span className="text-indigo-400 font-semibold uppercase text-[10px]">
                              [{step.action}]
                            </span>
                            <span className="truncate text-slate-300">
                              {step.gherkin || step.description || `${step.action} -> ${step.locator?.value}`}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50">
            <button
              onClick={() => {
                handleStopRecording();
                onClose();
              }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={handleApplySteps}
              disabled={recordedSteps.length === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              Adımları Senaryoya Aktar ({recordedSteps.length})
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
