import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, RefreshCw, Library, ChevronRight, X, Check, Calendar, Bookmark, Tag, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

type Book = {
  title: string;
  author: string;
  year: string;
  edition: string;
  category: string;
  priceMin: number;
  priceMax: number;
  box2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1
};

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Swipe state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedBooks, setLikedBooks] = useState<Book[]>([]);
  const [dislikedBooks, setDislikedBooks] = useState<Book[]>([]);
  const [exitX, setExitX] = useState(0);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setBooks([]);
      setCurrentIndex(0);
      setLikedBooks([]);
      setDislikedBooks([]);
      setExitX(0);

      // Create a preview URL
      const objectUrl = URL.createObjectURL(file);
      setImage(objectUrl);

      // Convert to base64 for the API
      const base64 = await convertFileToBase64(file);
      const base64Data = base64.split(',')[1];

      await analyzeBookshelf(base64Data, file.type);
    } catch (err) {
      console.error(err);
      setError("Une erreur s'est produite lors de l'analyse de l'image.");
    } finally {
      setLoading(false);
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const analyzeBookshelf = async (base64Data: string, mimeType: string) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: "Analyse cette image d'une rangée de livres. Identifie chaque livre en lisant sa reliure (le dos du livre). Ensuite, trouve l'année de publication originale, l'édition (si possible, sinon laisse vide), la meilleure catégorie parmi cette liste : Policier / Thriller, Science-Fiction, Fantasy / Fantastique, Historique, BD / Manga, Biographie, Romance, Essai, Jeunesse, Roman Graphique, et une estimation du prix de revente en occasion sur le marché canadien en dollars canadiens (priceMin et priceMax en CAD). Pour chaque livre, fournis également 'box2d' : un tableau de 4 valeurs normalisées [ymin, xmin, ymax, xmax] entre 0 et 1, indiquant la position de la reliure du livre dans l'image. Retourne un tableau JSON d'objets avec les propriétés 'title', 'author', 'year', 'edition', 'category', 'priceMin', 'priceMax' et 'box2d'.",
            },
          ],
        },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "Le titre du livre.",
                },
                author: {
                  type: Type.STRING,
                  description: "L'auteur du livre.",
                },
                year: {
                  type: Type.STRING,
                  description: "L'année de publication originale.",
                },
                edition: {
                  type: Type.STRING,
                  description: "L'édition du livre.",
                },
                category: {
                  type: Type.STRING,
                  description: "La catégorie du livre parmi la liste fournie.",
                },
                priceMin: {
                  type: Type.NUMBER,
                  description: "Estimated minimum resale price in CAD for this book in used condition.",
                },
                priceMax: {
                  type: Type.NUMBER,
                  description: "Estimated maximum resale price in CAD for this book in used condition.",
                },
                box2d: {
                  type: Type.ARRAY,
                  description: "Bounding box of the book spine in the image, as [ymin, xmin, ymax, xmax] normalized between 0 and 1.",
                  items: { type: Type.NUMBER },
                },
              },
              required: ["title", "author", "year", "edition", "category", "priceMin", "priceMax", "box2d"],
            },
          },
        },
      });

      const resultText = response.text;
      if (resultText) {
        const parsedBooks = JSON.parse(resultText);
        setBooks(parsedBooks);
      } else {
        setError("Aucun livre n'a pu être identifié.");
      }
    } catch (err) {
      console.error("API Error:", err);
      setError("Erreur de communication avec l'IA. Veuillez réessayer.");
    }
  };

  const handleSwipeAction = (direction: 'left' | 'right') => {
    if (currentIndex >= books.length) return;

    setExitX(direction === 'left' ? -500 : 500);

    setTimeout(() => {
      if (direction === 'right') {
        setLikedBooks(prev => [...prev, books[currentIndex]]);
      } else {
        setDislikedBooks(prev => [...prev, books[currentIndex]]);
      }
      setCurrentIndex(prev => prev + 1);
      setExitX(0);
    }, 200);
  };

  const resetApp = () => {
    setImage(null);
    setBooks([]);
    setError(null);
    setCurrentIndex(0);
    setLikedBooks([]);
    setDislikedBooks([]);
    setExitX(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans selection:bg-emerald-300">
      {/* Header */}
      <header className="bg-white border-b-2 border-stone-300 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-700 p-2 rounded-xl text-white shadow-sm border border-emerald-800">
              <Library size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">BiblioScan</h1>
          </div>
          {image && (
            <button
              onClick={resetApp}
              className="text-sm font-bold text-stone-700 hover:text-stone-900 hover:bg-stone-100 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-stone-300 shadow-sm"
            >
              <RefreshCw size={18} strokeWidth={2.5} />
              <span className="hidden sm:inline">Nouvelle photo</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {!image ? (
            <motion.div
              key="upload-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900 mb-4 drop-shadow-sm">
                  Numérisez votre bibliothèque en un clin d'œil
                </h2>
                <p className="text-lg font-medium text-stone-700 max-w-2xl mx-auto">
                  Prenez en photo une rangée de livres. Notre IA lira les reliures, trouvera les prix et années, et vous permettra de les trier.
                </p>
              </div>

              <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-md border-2 border-stone-300 text-center">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-4 border-dashed border-stone-300 hover:border-emerald-600 hover:bg-emerald-50 focus:ring-4 focus:ring-emerald-200 focus:outline-none transition-all group shadow-sm"
                  >
                    <div className="bg-stone-200 group-hover:bg-emerald-200 p-5 rounded-full text-stone-700 group-hover:text-emerald-800 transition-colors border border-stone-300 group-hover:border-emerald-400">
                      <Upload size={36} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="block font-bold text-lg text-stone-900 mb-1">Importer une photo</span>
                      <span className="text-sm font-medium text-stone-600">JPG, PNG depuis votre appareil</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute('capture', 'environment');
                        fileInputRef.current.click();
                        setTimeout(() => fileInputRef.current?.removeAttribute('capture'), 100);
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-4 border-dashed border-stone-300 hover:border-emerald-600 hover:bg-emerald-50 focus:ring-4 focus:ring-emerald-200 focus:outline-none transition-all group shadow-sm"
                  >
                    <div className="bg-stone-200 group-hover:bg-emerald-200 p-5 rounded-full text-stone-700 group-hover:text-emerald-800 transition-colors border border-stone-300 group-hover:border-emerald-400">
                      <Camera size={36} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="block font-bold text-lg text-stone-900 mb-1">Prendre une photo</span>
                      <span className="text-sm font-medium text-stone-600">Utiliser l'appareil photo</span>
                    </div>
                  </button>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                <div className="p-6 bg-white rounded-2xl shadow-sm border-2 border-stone-200">
                  <div className="bg-stone-800 text-white w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md border-2 border-stone-900">
                    <span className="font-bold text-xl">1</span>
                  </div>
                  <h3 className="font-bold text-lg text-stone-900 mb-2">Alignez les livres</h3>
                  <p className="text-base font-medium text-stone-600">Assurez-vous que les reliures sont bien visibles.</p>
                </div>
                <div className="p-6 bg-white rounded-2xl shadow-sm border-2 border-stone-200">
                  <div className="bg-stone-800 text-white w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md border-2 border-stone-900">
                    <span className="font-bold text-xl">2</span>
                  </div>
                  <h3 className="font-bold text-lg text-stone-900 mb-2">Prenez la photo</h3>
                  <p className="text-base font-medium text-stone-600">Une seule photo pour toute la rangée.</p>
                </div>
                <div className="p-6 bg-white rounded-2xl shadow-sm border-2 border-stone-200">
                  <div className="bg-stone-800 text-white w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md border-2 border-stone-900">
                    <span className="font-bold text-xl">3</span>
                  </div>
                  <h3 className="font-bold text-lg text-stone-900 mb-2">Triez et découvrez</h3>
                  <p className="text-base font-medium text-stone-600">Swipez pour trier et découvrez les catégories.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start"
            >
              {/* Image Preview Column — width = half screen, height = natural image height */}
              <div>
                <div className="bg-white p-3 rounded-3xl shadow-md border-2 border-stone-300 sticky top-24">
                  {/* Container matches the image exactly — no letterboxing, bounding boxes align perfectly */}
                  <div className="relative rounded-2xl overflow-hidden bg-stone-200 border border-stone-300">
                    <img
                      src={image}
                      alt="Rangée de livres"
                      className="w-full h-auto block"
                    />
                    {!loading && books.length > 0 && currentIndex < books.length && books[currentIndex].box2d && (
                      <motion.div
                        layoutId="highlight-box"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, type: "spring" }}
                        className="absolute bg-emerald-500/40 border-4 border-emerald-400 rounded-xl shadow-[0_0_20px_rgba(52,211,153,0.6)] z-10 pointer-events-none"
                        style={{
                          top: `${books[currentIndex].box2d![0] * 100}%`,
                          left: `${books[currentIndex].box2d![1] * 100}%`,
                          height: `${(books[currentIndex].box2d![2] - books[currentIndex].box2d![0]) * 100}%`,
                          width: `${(books[currentIndex].box2d![3] - books[currentIndex].box2d![1]) * 100}%`,
                        }}
                      />
                    )}
                    {loading && (
                      <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-md flex flex-col items-center justify-center text-white">
                        <Loader2 size={56} className="animate-spin mb-6 text-emerald-400" strokeWidth={3} />
                        <p className="font-bold text-2xl mb-2">Analyse en cours...</p>
                        <p className="text-base font-medium opacity-90">Recherche des informations...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Results Column */}
              <div>
                <div className="bg-white rounded-3xl shadow-md border-2 border-stone-300 overflow-hidden min-h-[600px] flex flex-col">
                  <div className="p-6 sm:p-8 border-b-2 border-stone-200 flex items-center justify-between bg-stone-100">
                    <div>
                      <h2 className="text-3xl font-extrabold text-stone-900">Découverte</h2>
                      <p className="text-stone-700 font-medium mt-2 text-lg">
                        {loading ? "Recherche en cours..." : books.length > 0 && currentIndex < books.length ? `Livre ${currentIndex + 1} sur ${books.length}` : "Tri terminé"}
                      </p>
                    </div>
                    {!loading && books.length > 0 && currentIndex < books.length && (
                      <div className="bg-stone-800 text-white px-4 py-2 rounded-full text-base font-bold shadow-sm border border-stone-900">
                        Swipez !
                      </div>
                    )}
                  </div>

                  <div className="p-6 sm:p-8 flex-1 flex flex-col bg-stone-50">
                    {loading ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-stone-500 space-y-6 py-12">
                        <div className="w-20 h-20 rounded-full bg-stone-200 flex items-center justify-center animate-pulse border-2 border-stone-300">
                          <BookOpen size={40} className="text-stone-600" />
                        </div>
                        <div className="space-y-3 w-full max-w-sm">
                          <div className="h-3 bg-stone-300 rounded-full w-full animate-pulse"></div>
                          <div className="h-3 bg-stone-300 rounded-full w-4/5 animate-pulse mx-auto"></div>
                          <div className="h-3 bg-stone-300 rounded-full w-2/3 animate-pulse mx-auto"></div>
                        </div>
                      </div>
                    ) : error ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4">
                        <div className="bg-red-100 text-red-700 p-5 rounded-2xl inline-block mb-6 border-2 border-red-200 shadow-sm">
                          <BookOpen size={40} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-2xl font-bold text-stone-900 mb-3">Oups !</h3>
                        <p className="text-lg font-medium text-stone-700 mb-8 max-w-md">{error}</p>
                        <button
                          onClick={resetApp}
                          className="bg-stone-900 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-stone-800 focus:ring-4 focus:ring-stone-300 transition-all shadow-md"
                        >
                          Essayer avec une autre photo
                        </button>
                      </div>
                    ) : books.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4">
                        <div className="bg-stone-200 text-stone-600 p-5 rounded-2xl inline-block mb-6 border-2 border-stone-300 shadow-sm">
                          <BookOpen size={40} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-2xl font-bold text-stone-900 mb-3">Aucun livre trouvé</h3>
                        <p className="text-lg font-medium text-stone-700 mb-8 max-w-md">Nous n'avons pas pu identifier de livres sur cette image. Assurez-vous que les reliures sont bien éclairées et lisibles.</p>
                      </div>
                    ) : currentIndex < books.length ? (
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="relative w-full max-w-sm mx-auto h-[420px]">
                          <AnimatePresence mode="popLayout">
                            <motion.div
                              key={currentIndex}
                              initial={{ scale: 0.9, opacity: 0, y: 20 }}
                              animate={{ scale: 1, opacity: 1, y: 0, x: 0, rotate: 0 }}
                              exit={{ x: exitX, opacity: 0, rotate: exitX > 0 ? 15 : -15 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              drag="x"
                              dragConstraints={{ left: 0, right: 0 }}
                              onDragEnd={(e, info) => {
                                if (info.offset.x > 100) {
                                  handleSwipeAction('right');
                                } else if (info.offset.x < -100) {
                                  handleSwipeAction('left');
                                }
                              }}
                              className="absolute inset-0 bg-white rounded-3xl shadow-2xl border-2 border-stone-300 p-8 flex flex-col justify-between cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
                                <div className="inline-flex items-center justify-center gap-2 text-emerald-800 bg-emerald-100 px-4 py-2 rounded-2xl border-2 border-emerald-200 mb-2 shadow-sm">
                                  <Tag size={24} strokeWidth={3} />
                                  <h2 className="text-2xl font-extrabold leading-tight uppercase tracking-wide">
                                    {books[currentIndex].category || "Catégorie inconnue"}
                                  </h2>
                                </div>
                                <h3 className="text-3xl font-extrabold text-stone-900 leading-tight drop-shadow-sm line-clamp-3">{books[currentIndex].title || "Titre inconnu"}</h3>
                                <p className="text-xl font-bold text-stone-600 line-clamp-2">{books[currentIndex].author || "Auteur inconnu"}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t-2 border-stone-200">
                                <div className="flex flex-col items-center text-center bg-stone-100 p-3 rounded-xl border border-stone-200">
                                  <span className="text-xs text-stone-600 uppercase tracking-wider font-bold mb-2">Année</span>
                                  <span className="font-bold text-stone-900 flex items-center gap-1 text-sm">
                                    <Calendar size={16} className="text-stone-700" />
                                    {books[currentIndex].year || "N/A"}
                                  </span>
                                </div>
                                <div className="flex flex-col items-center text-center bg-stone-100 p-3 rounded-xl border border-stone-200">
                                  <span className="text-xs text-stone-600 uppercase tracking-wider font-bold mb-2">Édition</span>
                                  <span className="font-bold text-stone-900 flex items-center gap-1 text-sm">
                                    <Bookmark size={16} className="text-stone-700" />
                                    {books[currentIndex].edition || "N/A"}
                                  </span>
                                </div>
                              </div>
                              {(books[currentIndex].priceMin != null || books[currentIndex].priceMax != null) && (
                                <div className="mt-3 flex items-center justify-center gap-2 bg-emerald-50 border-2 border-emerald-200 rounded-xl px-4 py-2.5">
                                  <span className="text-emerald-700 text-lg"></span>
                                  <span className="font-extrabold text-emerald-800 text-base">
                                    {books[currentIndex].priceMin ?? '?'}$ – {books[currentIndex].priceMax ?? '?'}$ CAD
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        <div className="flex justify-center gap-8 mt-10">
                          <button
                            onClick={() => handleSwipeAction('left')}
                            className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center text-red-600 hover:bg-red-50 hover:scale-105 focus:ring-4 focus:ring-red-200 transition-all border-2 border-red-200"
                            aria-label="Ignorer ce livre"
                          >
                            <X size={40} strokeWidth={3} />
                          </button>
                          <button
                            onClick={() => handleSwipeAction('right')}
                            className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 hover:scale-105 focus:ring-4 focus:ring-emerald-200 transition-all border-2 border-emerald-200"
                            aria-label="Retenir ce livre"
                          >
                            <Check size={40} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-2 bg-white p-6 rounded-2xl border-2 border-stone-200 shadow-sm">
                          <h3 className="text-3xl font-extrabold text-stone-900 mb-2">Terminé !</h3>
                          <p className="text-lg font-medium text-stone-700">Vous avez trié tous les livres de cette rangée.</p>
                        </div>

                        <div className="space-y-8 overflow-y-auto pr-2 custom-scrollbar pb-4">
                          {likedBooks.length > 0 && (
                            <div className="bg-emerald-50 rounded-3xl p-6 border-2 border-emerald-200 shadow-sm">
                              <h4 className="font-extrabold text-xl text-emerald-900 mb-5 flex items-center gap-3 border-b-2 border-emerald-200 pb-3">
                                <div className="bg-emerald-200 p-2 rounded-full">
                                  <Check size={24} className="text-emerald-700" strokeWidth={3} />
                                </div>
                                Livres retenus ({likedBooks.length})
                              </h4>
                              <div className="space-y-4">
                                {likedBooks.map((book, i) => (
                                  <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border-2 border-emerald-100 flex justify-between items-center hover:shadow-md transition-shadow">
                                    <div className="min-w-0 pr-4">
                                      <p className="font-bold text-lg text-stone-900 truncate mb-1">{book.title}</p>
                                      <p className="text-base font-medium text-stone-600 truncate">{book.author}</p>
                                    </div>
                                    <div className="text-right shrink-0 bg-stone-50 p-3 rounded-xl border border-stone-200">
                                      <p className="font-bold text-stone-800 text-sm mb-1">{book.category}</p>
                                      <p className="text-sm font-medium text-stone-500">{book.year} {book.edition ? `• ${book.edition}` : ''}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {dislikedBooks.length > 0 && (
                            <div className="bg-red-50 rounded-3xl p-6 border-2 border-red-200 shadow-sm">
                              <h4 className="font-extrabold text-xl text-red-900 mb-5 flex items-center gap-3 border-b-2 border-red-200 pb-3">
                                <div className="bg-red-200 p-2 rounded-full">
                                  <X size={24} className="text-red-700" strokeWidth={3} />
                                </div>
                                Livres ignorés ({dislikedBooks.length})
                              </h4>
                              <div className="space-y-4">
                                {dislikedBooks.map((book, i) => (
                                  <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border-2 border-red-100 flex justify-between items-center opacity-90 hover:opacity-100 transition-opacity">
                                    <div className="min-w-0 pr-4">
                                      <p className="font-bold text-lg text-stone-900 truncate mb-1">{book.title}</p>
                                      <p className="text-base font-medium text-stone-600 truncate">{book.author}</p>
                                    </div>
                                    <div className="text-right shrink-0 bg-stone-50 p-3 rounded-xl border border-stone-200">
                                      <p className="font-bold text-stone-800 text-sm mb-1">{book.category}</p>
                                      <p className="text-sm font-medium text-stone-500">{book.year} {book.edition ? `• ${book.edition}` : ''}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 pt-6 border-t-2 border-stone-200 flex justify-center">
                          <button
                            onClick={resetApp}
                            className="bg-stone-900 text-white px-10 py-4 rounded-full font-bold text-xl hover:bg-stone-800 focus:ring-4 focus:ring-stone-300 transition-all shadow-lg flex items-center gap-3 hover:scale-105"
                          >
                            Suivant <ChevronRight size={24} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
