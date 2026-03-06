import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, Loader2, Image as ImageIcon, RefreshCw, AlertCircle, Tag, Info, CheckCircle2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeToys, ToyAnalysisResult } from './services/geminiService';

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<ToyAnalysisResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, 'good' | 'bad'>>({});
  const [exitX, setExitX] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

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
      setError("Could not access the camera. Please check permissions or upload a photo instead.");
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  }, [stream]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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
    setDecisions({});
    setExitX(0);

    try {
      // Extract base64 data from data URL
      const base64Data = imageSrc.split(',')[1];
      const analysisResults = await analyzeToys(base64Data, mimeType);
      setResults(analysisResults);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Failed to analyze the image. Please try again.");
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
    setDecisions({});
    setExitX(0);
    stopCamera();
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    setDecisions(prev => ({ ...prev, [currentIndex]: direction === 'right' ? 'good' : 'bad' }));
    setCurrentIndex(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Tag size={18} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Toy Classifier</h1>
          </div>
          {imageSrc && !isAnalyzing && (
            <button
              onClick={reset}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={16} />
              Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start">

          {/* Left Column: Image Input / Preview */}
          <div className="space-y-6 md:sticky md:top-24">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {!imageSrc && !isCameraActive ? (
                <div className="p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-4">
                    <ImageIcon size={32} />
                  </div>
                  <h2 className="text-lg font-medium text-slate-900 mb-2">Add a photo of toys</h2>
                  <p className="text-sm text-slate-500 mb-8 max-w-[250px]">
                    Take a picture of toys on a table or upload an existing photo to identify them.
                  </p>

                  <div className="flex flex-col w-full gap-3 sm:flex-row sm:justify-center">
                    <button
                      onClick={startCamera}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <Camera size={18} />
                      Take Photo
                    </button>

                    <label className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-sm">
                      <Upload size={18} />
                      Upload Photo
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
                      Cancel
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
                <div className="flex justify-center bg-slate-100 w-full overflow-hidden">
                  <div className="relative inline-block max-w-full">
                    <img
                      src={imageSrc!}
                      alt="Captured toys"
                      className="w-auto h-auto max-w-full max-h-[50vh] md:max-h-[calc(100vh-16rem)] block"
                    />
                    {results && !isAnalyzing && currentIndex < results.length && results[currentIndex].box2d && results[currentIndex].box2d.length === 4 && (
                      <motion.div
                        layoutId="highlight-box"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, type: "spring" }}
                        className="absolute bg-emerald-500/40 border-4 border-emerald-400 rounded-xl shadow-[0_0_20px_rgba(52,211,153,0.6)] z-10 pointer-events-none"
                        style={{
                          top: `${results[currentIndex].box2d![0] * 100}%`,
                          left: `${results[currentIndex].box2d![1] * 100}%`,
                          height: `${(results[currentIndex].box2d![2] - results[currentIndex].box2d![0]) * 100}%`,
                          width: `${(results[currentIndex].box2d![3] - results[currentIndex].box2d![1]) * 100}%`,
                        }}
                      />
                    )}
                    {!results && !isAnalyzing && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={reset}>
                        <button
                          className="px-4 py-2 bg-white text-slate-900 rounded-lg text-sm font-medium shadow-lg pointer-events-none"
                        >
                          Change Photo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hidden canvas for capturing video frames */}
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
                Analyze Toys
              </motion.button>
            )}
          </div>

          {/* Right Column: Results */}
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
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Analyzing your toys...</h3>
                  <p className="text-sm text-slate-500 max-w-[280px]">
                    Our AI is scanning the image to identify each toy and categorize it. This might take a few seconds.
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
                      Found {results.length} {results.length === 1 ? 'Toy' : 'Toys'}
                    </h2>
                  </div>

                  {results.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
                        <Info size={24} />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 mb-1">No toys detected</h3>
                      <p className="text-sm text-slate-500">
                        We couldn't clearly identify any toys in this image. Try taking a clearer photo with better lighting.
                      </p>
                    </div>
                  ) : currentIndex < results.length ? (
                    <div className="flex flex-col items-center justify-center w-full mt-2 md:mt-4">
                      <div className="relative w-full max-w-sm h-[350px] md:h-[400px]">
                        <AnimatePresence mode="popLayout">
                          <motion.div
                            key={currentIndex}
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ x: exitX, opacity: 0, rotate: exitX > 0 ? 15 : -15 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-white rounded-3xl shadow-xl border border-slate-200 p-6 flex flex-col cursor-grab active:cursor-grabbing"
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            onDragEnd={(e, info) => {
                              if (info.offset.x > 100) {
                                setExitX(200);
                                setTimeout(() => handleSwipe('right'), 200);
                              } else if (info.offset.x < -100) {
                                setExitX(-200);
                                setTimeout(() => handleSwipe('left'), 200);
                              }
                            }}
                          >
                            <div className="flex-1 overflow-y-auto pr-2">
                              <div className="mb-3 md:mb-4">
                                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-0.5">Catégorie</p>
                                <h3 className="text-xl md:text-2xl font-bold text-indigo-600 leading-tight">
                                  {results[currentIndex].category}
                                </h3>
                              </div>
                              <div className="border-t border-slate-100 pt-3 md:pt-4 mb-3 md:mb-4">
                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Objet</p>
                                <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">
                                  {results[currentIndex].name}
                                </h3>
                              </div>
                              <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                                {results[currentIndex].description}
                              </p>
                            </div>

                            <div className="mt-4 pt-4 flex items-center justify-between border-t border-slate-100 shrink-0">
                              <div className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                                <CheckCircle2 size={16} className={
                                  results[currentIndex].confidence === 'High' ? 'text-emerald-500' :
                                    results[currentIndex].confidence === 'Medium' ? 'text-amber-500' : 'text-red-500'
                                } />
                                {results[currentIndex].confidence} Confidence
                              </div>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      <div className="flex justify-center gap-6 mt-6 md:mt-8 mb-4">
                        <button
                          onClick={() => {
                            setExitX(-200);
                            setTimeout(() => handleSwipe('left'), 200);
                          }}
                          className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-red-500 hover:bg-red-50 hover:scale-110 transition-all"
                        >
                          <X size={28} strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => {
                            setExitX(200);
                            setTimeout(() => handleSwipe('right'), 200);
                          }}
                          className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 hover:scale-110 transition-all"
                        >
                          <Check size={28} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4">
                        <Check size={32} strokeWidth={3} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">Review Complete!</h3>
                      <div className="space-y-3">
                        {results.map((toy, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div>
                              <h4 className="font-semibold text-slate-900">{toy.name}</h4>
                              <p className="text-sm text-slate-500">{toy.category}</p>
                            </div>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${decisions[idx] === 'good' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                              }`}>
                              {decisions[idx] === 'good' ? <Check size={20} /> : <X size={20} />}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={reset}
                        className="mt-8 w-full py-3.5 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors"
                      >
                        Start New Analysis
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
                    <h3 className="text-base font-medium text-slate-900 mb-1">Ready to analyze</h3>
                    <p className="text-sm text-slate-500">
                      Take a photo or upload an image to see the identified toys and their categories here.
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
