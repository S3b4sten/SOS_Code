import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, Loader2, Image as ImageIcon, RefreshCw, AlertCircle, Tag, Info, CheckCircle2, X, Check, Package, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeToys, ToyAnalysisResult } from './services/geminiService';
import { addItem, listItems, updateQuantity, getStats, type InventoryItem } from './store/inventoryStore';
import { getCurrentRole, login, logout, onActivity, subscribe, type AuthRole } from './store/authStore';
import InventoryView from './views/InventoryView';

type ConfirmationDraft = Pick<ToyAnalysisResult, 'name' | 'category' | 'description' | 'priceMin' | 'priceMax'> & {
  quantity: number;
};

type ProcessedStatus = 'added' | 'skipped' | 'incremented';

function normalizeItemKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

export default function App() {
  const [role, setRole] = useState<AuthRole>(() => getCurrentRole());
  const [isPinOverlayOpen, setIsPinOverlayOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<ToyAnalysisResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editableItems, setEditableItems] = useState<ConfirmationDraft[]>([]);
  const [processedItems, setProcessedItems] = useState<Record<number, ProcessedStatus>>({});
  const [inventorySnapshot, setInventorySnapshot] = useState<InventoryItem[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentView, setCurrentView] = useState<'scanner' | 'inventory'>('scanner');
  const [, setInventoryVersion] = useState(0);

  const startCamera = async () => {
    try {
      setError(null);
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Impossible d'accéder à la caméra. Vérifiez les autorisations ou téléversez une photo à la place.");
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    return subscribe((nextRole, reason) => {
      setRole(nextRole);
      if (nextRole === 'operator') {
        setIsPinOverlayOpen(false);
        setPinValue('');
        setPinError(reason === 'timeout' ? 'Session gestionnaire expirée.' : null);
      } else {
        setPinError(null);
      }
    });
  }, []);

  useEffect(() => {
    if (role !== 'manager') {
      return;
    }

    const handleActivity = () => {
      onActivity();
    };

    window.addEventListener('pointerdown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [role]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImageSrc(dataUrl);
        setMimeType('image/jpeg');
        stopCamera();
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
        setMimeType(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!imageSrc || !mimeType) return;

    setIsAnalyzing(true);
    setError(null);
    setCurrentIndex(0);
    setEditableItems([]);
    setProcessedItems({});
    setInventorySnapshot([]);

    try {
      const base64Data = imageSrc.split(',')[1];
      const analysisResults = await analyzeToys(base64Data, mimeType);

      // Gemini sometimes returns coordinates on a 0–1000 scale instead of 0–1
      const normalized = analysisResults.map(item => {
        const b = item.box2d;
        const scale = b.some(v => v > 1) ? 1000 : 1;
        return { ...item, box2d: [b[0] / scale, b[1] / scale, b[2] / scale, b[3] / scale] as [number, number, number, number] };
      });
      console.log('[ToyScanner] box2d normalized:', normalized.map(r => ({ name: r.name, box2d: r.box2d })));

      const sorted = [...normalized].sort((a, b) => {
        const rowDiff = a.box2d[0] - b.box2d[0];
        if (Math.abs(rowDiff) > 0.15) return rowDiff;
        return a.box2d[1] - b.box2d[1];
      });

      setResults(sorted);
      setEditableItems(sorted.map(item => ({
        name: item.name,
        category: item.category,
        description: item.description,
        priceMin: item.priceMin,
        priceMax: item.priceMax,
        quantity: 1,
      })));
      setProcessedItems({});
      setInventorySnapshot(listItems());
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Échec de l'analyse de l'image. Veuillez réessayer.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImageSrc(null);
    setMimeType(null);
    setResults(null);
    setError(null);
    setCurrentIndex(0);
    setEditableItems([]);
    setProcessedItems({});
    setInventorySnapshot([]);
    stopCamera();
  };

  const inventoryStats = getStats();
  const refreshInventory = useCallback(() => setInventoryVersion((v: number) => v + 1), []);

  const updateDraftField = <K extends keyof ConfirmationDraft>(index: number, field: K, value: ConfirmationDraft[K]) => {
    setEditableItems(prev => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const syncInventorySnapshot = (nextItem: InventoryItem) => {
    setInventorySnapshot(prev => {
      const existingIndex = prev.findIndex(item => item.id === nextItem.id);
      if (existingIndex === -1) return [...prev, nextItem];
      return prev.map((item, index) => index === existingIndex ? nextItem : item);
    });
  };

  const goToNextItem = (status: ProcessedStatus) => {
    setProcessedItems(prev => ({ ...prev, [currentIndex]: status }));
    setCurrentIndex(prev => prev + 1);
  };

  const currentDraft = results ? editableItems[currentIndex] : undefined;
  const existingItem = currentDraft
    ? inventorySnapshot.find(item =>
      normalizeItemKey(item.name) === normalizeItemKey(currentDraft.name) &&
      normalizeItemKey(item.category) === normalizeItemKey(currentDraft.category)
    )
    : undefined;
  const hasInvalidQuantity = currentDraft ? currentDraft.quantity <= 0 : false;
  const currentBox = results && currentIndex < results.length ? results[currentIndex].box2d : null;
  const showBoundingBox = currentBox && currentBox.length === 4;
  const addedCount = Object.values(processedItems).filter(status => status === 'added' || status === 'incremented').length;
  const skippedCount = Object.values(processedItems).filter(status => status === 'skipped').length;

  const handleSkip = () => {
    goToNextItem('skipped');
  };

  const handleConfirmItem = () => {
    if (!currentDraft || hasInvalidQuantity) return;

    if (existingItem) {
      updateQuantity(existingItem.id, currentDraft.quantity);
      syncInventorySnapshot({
        ...existingItem,
        quantity: existingItem.quantity + currentDraft.quantity,
        lastMovementAt: Date.now(),
      });
      goToNextItem('incremented');
      refreshInventory();
      return;
    }

    const newItem = addItem({
      ...currentDraft,
      imageThumb: imageSrc ?? undefined,
    });
    syncInventorySnapshot(newItem);
    goToNextItem('added');
    refreshInventory();
  };

  const resetPinOverlay = useCallback(() => {
    setPinValue('');
    setPinError(null);
  }, []);

  const closePinOverlay = useCallback(() => {
    setIsPinOverlayOpen(false);
    resetPinOverlay();
  }, [resetPinOverlay]);

  const appendPinDigit = useCallback((digit: string) => {
    setPinValue((current) => {
      if (current.length >= 4) return current;
      return `${current}${digit}`;
    });
    setPinError(null);
  }, []);

  const removeLastPinDigit = useCallback(() => {
    setPinValue((current) => current.slice(0, -1));
    setPinError(null);
  }, []);

  const handlePinSubmit = useCallback(async () => {
    if (role === 'manager') {
      logout();
      return;
    }
    if (pinValue.length !== 4) {
      setPinError('Entrez un PIN à 4 chiffres.');
      return;
    }
    const didLogin = await login(pinValue);
    if (!didLogin) {
      setPinError('PIN incorrect.');
      setPinValue('');
      return;
    }
    setIsPinOverlayOpen(false);
    setPinValue('');
    setPinError(null);
  }, [pinValue, role]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Tag size={18} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Classificateur de Jouets</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setCurrentView('scanner')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'scanner'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Camera size={16} />
                Scanner
              </button>
              <button
                onClick={() => setCurrentView('inventory')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'inventory'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Package size={16} />
                Inventaire
                {inventoryStats.totalItems > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 px-1.5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center leading-none">
                    {inventoryStats.totalItems}
                  </span>
                )}
              </button>
            </div>
            {role === 'manager' && (
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Unlock size={14} />
                Gestionnaire
              </span>
            )}
            <button
              type="button"
              onClick={() => { setIsPinOverlayOpen(true); setPinError(null); }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
              aria-label={role === 'manager' ? 'Gérer la session gestionnaire' : 'Ouvrir la saisie du PIN gestionnaire'}
            >
              {role === 'manager' ? <Unlock size={18} /> : <Lock size={18} />}
            </button>
            {imageSrc && !isAnalyzing && currentView === 'scanner' && (
              <button
                onClick={reset}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw size={16} />
                Recommencer
              </button>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isPinOverlayOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
            onClick={closePinOverlay}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {role === 'manager' ? 'Session active' : 'Accès gestionnaire'}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">
                    {role === 'manager' ? 'Mode gestionnaire' : 'Entrer le PIN'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closePinOverlay}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fermer la fenêtre PIN"
                >
                  <X size={18} />
                </button>
              </div>

              {role === 'manager' ? (
                <div className="space-y-4">
                  <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Les permissions gestionnaire sont actives. La session reviendra automatiquement en mode Opérateur après 5 minutes d'inactivité.
                  </p>
                  <div className="flex gap-3">
                    <button type="button" onClick={closePinOverlay} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                      Fermer
                    </button>
                    <button type="button" onClick={handlePinSubmit} className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                      Revenir opérateur
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-center gap-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className={`h-3 w-3 rounded-full transition-colors ${index < pinValue.length ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                      ))}
                    </div>
                    <p className="mt-3 text-center text-xs text-slate-500">PIN à 4 chiffres</p>
                  </div>
                  {pinError && (
                    <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pinError}</p>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Effacer', '0', 'OK'].map((key) => {
                      const isActionKey = key === 'Effacer' || key === 'OK';
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (key === 'Effacer') { removeLastPinDigit(); return; }
                            if (key === 'OK') { void handlePinSubmit(); return; }
                            appendPinDigit(key);
                          }}
                          className={`rounded-2xl px-4 py-4 text-base font-semibold transition-colors ${isActionKey ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {currentView === 'scanner' ? (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start">
          <div className="space-y-6 md:sticky md:top-24">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {!imageSrc && !isCameraActive ? (
                <div className="p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                    <ImageIcon size={32} />
                  </div>
                  <h2 className="text-lg font-medium text-slate-900 mb-2">Ajouter une photo de jouets</h2>
                  <p className="text-sm text-slate-500 mb-8 max-w-[250px]">
                    Prenez une photo de jouets sur une table ou téléversez une photo existante pour les identifier.
                  </p>

                  <div className="flex flex-col w-full gap-3 sm:flex-row sm:justify-center">
                    <button
                      onClick={startCamera}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <Camera size={18} />
                      Prendre une photo
                    </button>

                    <label className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-sm">
                      <Upload size={18} />
                      Téléverser une photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : isCameraActive ? (
                <div className="relative bg-black aspect-[4/3] md:aspect-video flex flex-col">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-4">
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white backdrop-blur-md rounded-full text-sm font-medium transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={capturePhoto}
                      className="w-14 h-14 bg-white rounded-full border-4 border-slate-300 shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                      aria-label="Take photo"
                    >
                      <div className="w-12 h-12 rounded-full border border-slate-200"></div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center items-start bg-slate-100 w-full overflow-hidden">
                  <div className="relative inline-block max-w-full">
                    <img
                      src={imageSrc!}
                      alt="Captured toys"
                      className="w-auto h-auto max-w-full max-h-[50vh] md:max-h-[calc(100vh-16rem)] block"
                    />
                    {!isAnalyzing && showBoundingBox && currentBox && (
                      <div
                        className="absolute bg-emerald-500/40 border-4 border-emerald-400 rounded-xl z-10 pointer-events-none"
                        style={{
                          top: `${currentBox[0] * 100}%`,
                          left: `${currentBox[1] * 100}%`,
                          height: `${(currentBox[2] - currentBox[0]) * 100}%`,
                          width: `${(currentBox[3] - currentBox[1]) * 100}%`,
                        }}
                      />
                    )}
                    {!results && !isAnalyzing && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={reset}>
                        <button
                          className="px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-medium shadow-lg pointer-events-none"
                        >
                          Changer la photo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 text-red-800"
              >
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p className="text-sm">{error}</p>
              </motion.div>
            )}

            {imageSrc && !results && !isAnalyzing && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleAnalyze}
                className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-lg"
              >
                Analyser les jouets
              </motion.button>
            )}
          </div>

          <div className="flex flex-col h-full">
            <AnimatePresence mode="wait">
              {isAnalyzing ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full min-h-[400px] bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center p-8 text-center"
                >
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Analyse en cours...</h3>
                  <p className="text-sm text-slate-500 max-w-[280px]">
                    Notre IA analyse l'image pour identifier chaque jouet et le catégoriser. Cela peut prendre quelques secondes.
                  </p>
                </motion.div>
              ) : results ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-slate-900">
                      {results.length} {results.length === 1 ? 'Jouet trouvé' : 'Jouets trouvés'}
                    </h2>
                  </div>

                  {results.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
                        <Info size={24} />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 mb-1">Aucun jouet détecté</h3>
                      <p className="text-sm text-slate-500">
                        Nous n'avons pas pu identifier clairement de jouets dans cette image. Essayez une photo plus nette avec un meilleur éclairage.
                      </p>
                    </div>
                  ) : currentIndex < results.length ? (
                    <div className="flex flex-col items-center justify-center w-full mt-2 md:mt-4">
                      <div className="relative w-full max-w-sm min-h-[350px]">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={currentIndex}
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 flex flex-col"
                          >
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-1.5">
                                  Nom
                                </label>
                                <input
                                  type="text"
                                  value={currentDraft?.name ?? ''}
                                  onChange={(event) => updateDraftField(currentIndex, 'name', event.target.value)}
                                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-1.5">
                                  Catégorie
                                </label>
                                <input
                                  type="text"
                                  value={currentDraft?.category ?? ''}
                                  onChange={(event) => updateDraftField(currentIndex, 'category', event.target.value)}
                                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
                                    Prix min
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={currentDraft?.priceMin ?? 0}
                                    onChange={(event) => updateDraftField(currentIndex, 'priceMin', Number(event.target.value))}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
                                    Prix max
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={currentDraft?.priceMax ?? 0}
                                    onChange={(event) => updateDraftField(currentIndex, 'priceMax', Number(event.target.value))}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
                                  Quantité à ajouter
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={currentDraft?.quantity ?? 1}
                                  onChange={(event) => updateDraftField(currentIndex, 'quantity', Number(event.target.value))}
                                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                                {hasInvalidQuantity && (
                                  <p className="mt-2 text-sm text-red-600">La quantité doit être supérieure à 0.</p>
                                )}
                              </div>

                              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                                  Description
                                </p>
                                <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                                  {results[currentIndex].description}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 shrink-0 space-y-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                                  <CheckCircle2
                                    size={16}
                                    className={
                                      results[currentIndex].confidence === 'Élevée'
                                        ? 'text-emerald-500'
                                        : results[currentIndex].confidence === 'Moyenne'
                                          ? 'text-amber-500'
                                          : 'text-red-500'
                                    }
                                  />
                                  Confiance {results[currentIndex].confidence}
                                </div>
                                {(results[currentIndex].priceMin != null || results[currentIndex].priceMax != null) && (
                                  <div className="flex items-center gap-1.5 text-xs md:text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                                    Estimation Gemini {results[currentIndex].priceMin ?? '?'}$ - {results[currentIndex].priceMax ?? '?'}$ CAD
                                  </div>
                                )}
                              </div>

                              {existingItem && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                  Déjà en stock (qté : {existingItem.quantity}). La quantité saisie sera ajoutée au stock existant.
                                </div>
                              )}

                              <div className="flex gap-3">
                                <button
                                  onClick={handleSkip}
                                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  Ignorer
                                </button>
                                <button
                                  onClick={handleConfirmItem}
                                  disabled={hasInvalidQuantity}
                                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                                >
                                  {existingItem ? 'Incrémenter le stock' : 'Ajouter au stock'}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4">
                        <Check size={32} strokeWidth={3} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">Révision terminée !</h3>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                          <p className="text-sm text-emerald-700">Ajoutés</p>
                          <p className="text-3xl font-bold text-emerald-900">{addedCount}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                          <p className="text-sm text-slate-600">Ignorés</p>
                          <p className="text-3xl font-bold text-slate-900">{skippedCount}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {results.map((toy, idx) => {
                          const status = processedItems[idx];
                          const statusLabel = status === 'incremented'
                            ? 'Quantité incrémentée'
                            : status === 'added'
                              ? 'Ajouté'
                              : 'Ignoré';
                          const statusClasses = status === 'incremented'
                            ? 'bg-amber-100 text-amber-700'
                            : status === 'added'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-700';

                          return (
                            <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                              <div>
                                <h4 className="font-semibold text-slate-900">{editableItems[idx]?.name ?? toy.name}</h4>
                                <p className="text-sm text-slate-500">{editableItems[idx]?.category ?? toy.category}</p>
                              </div>
                              <div className={`px-3 py-2 rounded-lg text-sm font-medium shrink-0 ${statusClasses}`}>
                                {statusLabel}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={reset}
                        className="mt-8 w-full py-3.5 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors"
                      >
                        Nouvelle analyse
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="hidden lg:flex h-full min-h-[400px] bg-slate-100/50 rounded-2xl border border-slate-200 border-dashed items-center justify-center p-8 text-center">
                  <div className="max-w-[280px]">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4 shadow-sm">
                      <Tag size={24} />
                    </div>
                    <h3 className="text-base font-medium text-slate-900 mb-1">Prêt à analyser</h3>
                    <p className="text-sm text-slate-500">
                      Prenez une photo ou téléversez une image pour voir les jouets identifiés et leurs catégories ici.
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
      ) : (
        <InventoryView onMutate={refreshInventory} />
      )}

      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white border-t border-slate-200 z-20 flex items-stretch h-16">
        <button
          onClick={() => setCurrentView('scanner')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
            currentView === 'scanner' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Camera size={22} />
          Scanner
        </button>
        <button
          onClick={() => setCurrentView('inventory')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
            currentView === 'inventory' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <div className="relative">
            <Package size={22} />
            {inventoryStats.totalItems > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-indigo-600 text-white text-[10px] rounded-full flex items-center justify-center leading-none">
                {inventoryStats.totalItems}
              </span>
            )}
          </div>
          Inventaire
        </button>
      </nav>
    </div>
  );
}
