import React, { useState, useEffect, useCallback } from 'react';
import { KeyIcon, XMarkIcon, SparklesIcon } from './icons';
import { createPkceChallenge, DEFAULT_OPENROUTER_MODEL } from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const OPENROUTER_POPULAR_MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', label: 'Google Gemini 2.0 Flash (Free)' },
  { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 Reasoning (Free)' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B Instruct (Free)' },
  { id: 'google/gemini-2.5-flash', label: 'Google Gemini 2.5 Flash (Fast & Cheap)' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
  { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
];

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [aiMode, setAiMode] = useState<'openrouter' | 'gemini' | 'local'>('openrouter');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [apiKey, setApiKey] = useState('');
  const [localHost, setLocalHost] = useState('http://localhost:11434');
  const [localModel, setLocalModel] = useState('llama3');
  const [mtgaPath, setMtgaPath] = useState('');

  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [isStartingOllama, setIsStartingOllama] = useState<boolean>(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState<boolean>(false);

  const [connectionStatus, setConnectionStatus] = useState<{
    type: 'idle' | 'testing' | 'success' | 'error' | 'warning';
    message: string;
  }>({ type: 'idle', message: '' });

  const fetchInstalledModels = useCallback(async (hostUrl?: string) => {
    const host = (hostUrl || localHost).trim().replace(/\/$/, '');
    if (!host) return;

    setIsFetchingModels(true);
    setFetchModelsError(null);

    try {
      const res = await fetch(`${host}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const modelsList: string[] = (data.models || []).map((m: any) => m.name);
        setInstalledModels(modelsList);
        
        if (modelsList.length > 0) {
          setLocalModel((prev) => {
            if (!prev || !modelsList.includes(prev)) {
              return modelsList[0];
            }
            return prev;
          });
        }
      } else {
        setFetchModelsError(`Ollama server returned status ${res.status}`);
        setInstalledModels([]);
      }
    } catch {
      setFetchModelsError('Ollama server is not currently running');
      setInstalledModels([]);
    } finally {
      setIsFetchingModels(false);
    }
  }, [localHost]);

  const handleStartOllamaServer = async () => {
    setIsStartingOllama(true);
    setFetchModelsError(null);
    try {
      await fetch('/api/ollama/start', { method: 'POST' });
      await new Promise((resolve) => setTimeout(resolve, 2200));
      await fetchInstalledModels(localHost);
    } catch {
      setFetchModelsError('Could not send start signal to Ollama server');
    } finally {
      setIsStartingOllama(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const savedMode = (localStorage.getItem('ai_mode') as 'openrouter' | 'gemini' | 'local') || 'openrouter';
      const savedHost = localStorage.getItem('local_ai_host') || 'http://localhost:11434';
      const savedModel = localStorage.getItem('local_ai_model') || 'llama3';
      
      setAiMode(savedMode);
      setOpenRouterKey(localStorage.getItem('openrouter_api_key') || '');
      setOpenRouterModel(localStorage.getItem('openrouter_model') || DEFAULT_OPENROUTER_MODEL);
      setApiKey(localStorage.getItem('gemini_api_key') || '');
      setLocalHost(savedHost);
      setLocalModel(savedModel);
      setMtgaPath(localStorage.getItem('mtga_path') || '');
      setConnectionStatus({ type: 'idle', message: '' });

      if (savedMode === 'local') {
        fetchInstalledModels(savedHost);
      }
    }
  }, [isOpen, fetchInstalledModels]);

  if (!isOpen) return null;

  const handleConnectOpenRouterOAuth = async () => {
    setIsConnectingOAuth(true);
    try {
      const { verifier, challenge } = await createPkceChallenge();
      sessionStorage.setItem('openrouter_pkce_verifier', verifier);
      localStorage.setItem('ai_mode', 'openrouter');
      localStorage.setItem('openrouter_model', openRouterModel.trim() || DEFAULT_OPENROUTER_MODEL);

      const callbackUrl = window.location.origin + window.location.pathname;
      const authUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
      window.location.href = authUrl;
    } catch (e: any) {
      setIsConnectingOAuth(false);
      setConnectionStatus({
        type: 'error',
        message: `Failed to start OpenRouter login: ${e.message}`
      });
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus({ type: 'testing', message: 'Connecting to Ollama...' });
    try {
      const trimmedHost = localHost.trim().replace(/\/$/, '');
      const res = await fetch(`${trimmedHost}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const models: string[] = (data.models || []).map((m: any) => m.name);
        setInstalledModels(models);
        
        const target = localModel.trim();
        const found = models.some(m => m.includes(target) || target.includes(m));
        
        if (found) {
          setConnectionStatus({
            type: 'success',
            message: `Connected successfully! Model "${target}" is ready.`
          });
        } else {
          setConnectionStatus({
            type: 'warning',
            message: `Connected to Ollama! Installed models: [${models.join(', ') || 'none'}].`
          });
        }
      } else {
        setConnectionStatus({
          type: 'error',
          message: `Connection failed with status: ${res.status} (${res.statusText})`
        });
      }
    } catch {
      setConnectionStatus({
        type: 'error',
        message: 'Could not connect to Ollama. Click "Start Ollama Server" below to launch it.'
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ai_mode', aiMode);
    localStorage.setItem('openrouter_api_key', openRouterKey.trim());
    localStorage.setItem('openrouter_model', openRouterModel.trim() || DEFAULT_OPENROUTER_MODEL);
    localStorage.setItem('gemini_api_key', apiKey.trim());
    localStorage.setItem('local_ai_host', localHost.trim());
    localStorage.setItem('local_ai_model', localModel.trim());
    localStorage.setItem('mtga_path', mtgaPath.trim());
    localStorage.setItem('app_setup_completed', 'true');
    onSave();
  };

  const isSaveDisabled =
    (aiMode === 'openrouter' && !openRouterKey.trim()) ||
    (aiMode === 'gemini' && !apiKey.trim());

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-[#0d0d10] border border-white/[0.1] rounded-xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <SparklesIcon className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-zinc-100 tracking-wide">AI Deck Advisor Setup</h2>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Bring Your Own Key • Zero Fees</p>
          </div>
        </div>

        <p className="text-zinc-400 text-xs mb-4 leading-relaxed mt-3">
          Deck graphing, Scryfall lookups, mana curves, and the Goldfish Simulator work <strong className="text-zinc-200">100% free without any key</strong>. Connect an AI provider below to unlock deep deck reports &amp; card upgrade suggestions.
        </p>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 bg-zinc-900/90 p-1 rounded-lg border border-white/[0.06] mb-5 gap-1">
          <button
            type="button"
            onClick={() => setAiMode('openrouter')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
              aiMode === 'openrouter'
                ? 'bg-amber-500/15 text-amber-200 border border-amber-500/35 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
            OpenRouter
          </button>
          <button
            type="button"
            onClick={() => setAiMode('gemini')}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
              aiMode === 'gemini'
                ? 'bg-amber-500/15 text-amber-200 border border-amber-500/35 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <KeyIcon className="w-3.5 h-3.5 text-amber-400" />
            Gemini API
          </button>
          <button
            type="button"
            onClick={() => {
              setAiMode('local');
              fetchInstalledModels(localHost);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
              aiMode === 'local'
                ? 'bg-amber-500/15 text-amber-200 border border-amber-500/35 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Local Ollama
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {aiMode === 'openrouter' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-zinc-900/70 border border-amber-500/25 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300">⚡ Instant 1-Click Connect</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                    Free Models Included
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Authorize directly with OpenRouter in one click. Use free community models (like Gemini 2.0 Flash Free or DeepSeek R1 Free) without entering a credit card.
                </p>
                <button
                  type="button"
                  onClick={handleConnectOpenRouterOAuth}
                  disabled={isConnectingOAuth}
                  className="w-full py-2.5 px-4 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-semibold rounded-md text-xs transition-all flex items-center justify-center gap-2"
                >
                  <SparklesIcon className="w-4 h-4 text-amber-400" />
                  {isConnectingOAuth ? 'Redirecting to OpenRouter...' : 'Connect with OpenRouter (1-Click)'}
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-white/[0.06]"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Or paste key manually</span>
                <div className="flex-grow border-t border-white/[0.06]"></div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="openrouter-key" className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    OpenRouter API Key
                  </label>
                  {openRouterKey && (
                    <span className="text-[10px] text-emerald-400 font-mono">✓ Key Configured</span>
                  )}
                </div>
                <input
                  id="openrouter-key"
                  type="password"
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  placeholder="Paste your OpenRouter key..."
                  className="w-full bg-zinc-900 border border-white/[0.08] rounded-md p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              <div>
                <label htmlFor="openrouter-model" className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  AI Model
                </label>
                <select
                  id="openrouter-model"
                  value={openRouterModel}
                  onChange={(e) => setOpenRouterModel(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/[0.08] rounded-md p-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {OPENROUTER_POPULAR_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-zinc-900 text-zinc-100">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : aiMode === 'gemini' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="api-key" className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Google Gemini API Key
                </label>
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your Gemini API key..."
                  className="w-full bg-zinc-900 border border-white/[0.08] rounded-md p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 font-mono"
                  autoFocus
                />
              </div>

              <div className="flex justify-between items-center text-xs">
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 hover:underline transition-colors"
                >
                  Get a free key from Google AI Studio &rarr;
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="local-host" className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Ollama Host URL
                  </label>
                  <button
                    type="button"
                    onClick={() => fetchInstalledModels(localHost)}
                    disabled={isFetchingModels || isStartingOllama}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors font-medium"
                    title="Scan Ollama server for installed models"
                  >
                    <svg className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Models
                  </button>
                </div>
                <input
                  id="local-host"
                  type="text"
                  value={localHost}
                  onChange={(e) => setLocalHost(e.target.value)}
                  onBlur={() => fetchInstalledModels(localHost)}
                  placeholder="http://localhost:11434"
                  className="w-full bg-zinc-900 border border-white/[0.08] rounded-md p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              <div>
                <label htmlFor="local-model" className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Select Ollama Model
                </label>
                {isFetchingModels ? (
                  <div className="w-full bg-zinc-900 border border-white/[0.08] rounded-md p-2.5 text-xs text-zinc-400 flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Detecting models from Ollama...
                  </div>
                ) : installedModels.length > 0 ? (
                  <div className="relative">
                    <select
                      id="local-model"
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      className="w-full bg-zinc-900 border border-amber-500/35 rounded-md p-2.5 text-xs text-amber-200 focus:outline-none focus:border-amber-500/50 appearance-none font-medium cursor-pointer pr-8"
                    >
                      {installedModels.map((modelName) => (
                        <option key={modelName} value={modelName} className="bg-zinc-900 text-zinc-100 font-normal">
                          {modelName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      id="local-model"
                      type="text"
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      placeholder="e.g. llama3, mistral, qwen..."
                      className="w-full bg-zinc-900 border border-white/[0.08] rounded-md p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 font-mono"
                    />
                    
                    {fetchModelsError && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-md text-xs space-y-2">
                        <p className="text-amber-300 font-medium flex items-center gap-1.5">
                          <span>⚠️ {fetchModelsError}</span>
                        </p>
                        <button
                          type="button"
                          onClick={handleStartOllamaServer}
                          disabled={isStartingOllama}
                          className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-semibold py-2 px-3 rounded-md text-xs transition-all flex items-center justify-center gap-2"
                        >
                          {isStartingOllama ? 'Starting Ollama Server...' : 'Start Ollama Server Automatically'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={connectionStatus.type === 'testing'}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-zinc-100 font-medium py-2 px-3 rounded-md text-xs transition-all flex items-center justify-center gap-2"
                >
                  Test Ollama Connection
                </button>

                {connectionStatus.type !== 'idle' && (
                  <div className={`p-2.5 rounded-md border text-xs leading-relaxed ${
                    connectionStatus.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                      : connectionStatus.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : connectionStatus.type === 'testing'
                      ? 'bg-zinc-800 border-white/[0.08] text-zinc-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}>
                    {connectionStatus.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MTG Arena Installation Path (Optional) */}
          <div className="pt-3 border-t border-white/[0.06] space-y-2">
            <label htmlFor="mtga-path" className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              MTG Arena Folder Path (Optional Desktop Feature)
            </label>
            <input
              id="mtga-path"
              type="text"
              value={mtgaPath}
              onChange={(e) => setMtgaPath(e.target.value)}
              placeholder="e.g. C:\Program Files\Wizards of the Coast\MTG Arena"
              className="w-full bg-zinc-900 border border-white/[0.08] rounded-md p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 font-mono"
            />
          </div>

          <div className="pt-4 border-t border-white/[0.06] flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('app_setup_completed', 'true');
                onClose();
              }}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 font-medium py-2.5 px-4 rounded-md text-xs transition-all"
            >
              Skip (Use Free Graph)
            </button>
            <button
              type="submit"
              disabled={isSaveDisabled}
              className="flex-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-semibold py-2.5 px-4 rounded-md text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save AI Settings
            </button>
          </div>
        </form>
        
        <div className="mt-3 pt-3 border-t border-white/[0.06] text-center">
          <p className="text-[10px] text-zinc-500 font-mono">
            🔒 Keys are stored 100% locally in your browser&apos;s localStorage.
          </p>
        </div>
      </div>
    </div>
  );
};
