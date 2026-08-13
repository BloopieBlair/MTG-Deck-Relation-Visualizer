import React, { useState, useEffect, useCallback } from 'react';
import { KeyIcon, XMarkIcon, SparklesIcon } from './icons';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
  const [aiMode, setAiMode] = useState<'gemini' | 'local'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [localHost, setLocalHost] = useState('http://localhost:11434');
  const [localModel, setLocalModel] = useState('llama3');
  const [mtgaPath, setMtgaPath] = useState('');

  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [isStartingOllama, setIsStartingOllama] = useState<boolean>(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);

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
    } catch (err: any) {
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
      // Wait 2 seconds for Ollama service to start up
      await new Promise((resolve) => setTimeout(resolve, 2200));
      await fetchInstalledModels(localHost);
    } catch (err: any) {
      setFetchModelsError('Could not send start signal to Ollama server');
    } finally {
      setIsStartingOllama(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const savedMode = (localStorage.getItem('ai_mode') as 'gemini' | 'local') || 'local';
      const savedHost = localStorage.getItem('local_ai_host') || 'http://localhost:11434';
      const savedModel = localStorage.getItem('local_ai_model') || 'llama3';
      
      setAiMode(savedMode);
      setApiKey(localStorage.getItem('gemini_api_key') || '');
      setLocalHost(savedHost);
      setLocalModel(savedModel);
      setMtgaPath(localStorage.getItem('mtga_path') || '');
      setConnectionStatus({ type: 'idle', message: '' });

      // Automatically fetch installed models when opening the modal
      fetchInstalledModels(savedHost);
    }
  }, [isOpen, fetchInstalledModels]);

  if (!isOpen) return null;

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
    } catch (e: any) {
      setConnectionStatus({
        type: 'error',
        message: 'Could not connect to Ollama. Click "Start Ollama Server" below to launch it.'
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ai_mode', aiMode);
    localStorage.setItem('gemini_api_key', apiKey.trim());
    localStorage.setItem('local_ai_host', localHost.trim());
    localStorage.setItem('local_ai_model', localModel.trim());
    localStorage.setItem('mtga_path', mtgaPath.trim());
    localStorage.setItem('app_setup_completed', 'true');
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-gray-900 border border-cyan-600 rounded-xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3 text-cyan-400">
          <SparklesIcon className="w-7 h-7 text-cyan-400" />
          <h2 className="text-xl font-bold">App & Engine Setup</h2>
        </div>

        <p className="text-gray-300 text-xs mb-5 leading-relaxed">
          Configure your local environment. Select an AI engine for deck analysis and optionally set your local MTG Arena path.
        </p>

        {/* Tab Selector */}
        <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800 mb-5">
          <button
            type="button"
            onClick={() => setAiMode('local')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
              aiMode === 'local'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Local AI (Ollama)
          </button>
          <button
            type="button"
            onClick={() => setAiMode('gemini')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
              aiMode === 'gemini'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <KeyIcon className="w-4 h-4" />
            Gemini API (Cloud)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {aiMode === 'gemini' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="api-key" className="block text-xs font-semibold text-gray-400 uppercase mb-2">
                  Google Gemini API Key
                </label>
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-between items-center text-xs">
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                >
                  Get a key from Google AI Studio &rarr;
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="local-host" className="block text-xs font-semibold text-gray-400 uppercase">
                    Ollama Host URL
                  </label>
                  <button
                    type="button"
                    onClick={() => fetchInstalledModels(localHost)}
                    disabled={isFetchingModels || isStartingOllama}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors font-medium"
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
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label htmlFor="local-model" className="block text-xs font-semibold text-gray-400 uppercase mb-2">
                  Select Ollama Model
                </label>
                {isFetchingModels ? (
                  <div className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs text-gray-400 flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24">
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
                      className="w-full bg-gray-800 border border-cyan-600/60 rounded-lg p-2.5 text-xs text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none font-semibold cursor-pointer pr-8"
                    >
                      {installedModels.map((modelName) => (
                        <option key={modelName} value={modelName} className="bg-gray-900 text-white font-normal">
                          {modelName}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-cyan-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      id="local-model"
                      type="text"
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      placeholder="e.g. llama3, mistral, qwen..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    
                    {fetchModelsError && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-2">
                        <p className="text-amber-400 font-medium flex items-center gap-1.5">
                          <span>⚠️ {fetchModelsError}</span>
                        </p>
                        <button
                          type="button"
                          onClick={handleStartOllamaServer}
                          disabled={isStartingOllama}
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow"
                        >
                          {isStartingOllama ? (
                            <>
                              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Starting Ollama Server...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Start Ollama Server Automatically
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {installedModels.length > 0 && (
                  <p className="text-[10px] text-green-400 mt-1.5 flex items-center gap-1 font-medium">
                    <span>✓ Detected {installedModels.length} installed model{installedModels.length > 1 ? 's' : ''} in Ollama</span>
                  </p>
                )}
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={connectionStatus.type === 'testing'}
                  className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white font-semibold py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center gap-2"
                >
                  {connectionStatus.type === 'testing' && (
                    <svg className="animate-spin h-3.5 w-3.5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  Test Ollama Connection
                </button>

                {connectionStatus.type !== 'idle' && (
                  <div className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                    connectionStatus.type === 'success' 
                      ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                      : connectionStatus.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : connectionStatus.type === 'testing'
                      ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    {connectionStatus.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MTG Arena Installation Path (Optional) */}
          <div className="pt-3 border-t border-gray-800 space-y-2">
            <label htmlFor="mtga-path" className="block text-xs font-semibold text-gray-400 uppercase">
              MTG Arena Folder Path (Optional)
            </label>
            <input
              id="mtga-path"
              type="text"
              value={mtgaPath}
              onChange={(e) => setMtgaPath(e.target.value)}
              placeholder="e.g. C:\Program Files\Wizards of the Coast\MTG Arena"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="text-[10px] text-gray-500 leading-relaxed">
              If left blank, standard Windows paths will be checked automatically. If MTG Arena is not installed, collection features will be cleanly disabled.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-800 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 px-4 rounded-lg text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={aiMode === 'gemini' && !apiKey.trim()}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save & Start
            </button>
          </div>
        </form>
        
        <div className="mt-3 pt-3 border-t border-gray-800 text-center">
          <p className="text-[10px] text-gray-500">
            {aiMode === 'gemini' 
              ? "Your API key is stored locally in your browser."
              : "Local mode routes requests to your local Ollama server."
            }
          </p>
        </div>
      </div>
    </div>
  );
};
