import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, Layers, BarChart3, Star, Download, LogIn, Calendar, ChevronLeft, ChevronRight, User } from 'lucide-react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { useRef } from 'react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('landing'); // landing, loading, wrapped
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [term, setTerm] = useState('medium_term');
  const [error, setError] = useState(null);
  const [lastView, setLastView] = useState('landing');

  useEffect(() => {
    // Check for token in URL (callback)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, "/");
      setView('loading');
      fetchStats(urlToken, term);
    }
  }, [token]);

  const fetchStats = async (t, selectedTerm = 'medium_term') => {
    try {
      const response = await axios.get(`http://127.0.0.1:5000/stats?term=${selectedTerm}`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      setStats(response.data);
      setLastView(view);
      setView('wrapped');
      // Refresh history after generating new stats
      fetchHistory(t);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        setError("User Not Whitelisted: Your Spotify account must be added to the 'User Management' section in your Spotify Developer Dashboard to access the API in Development Mode.");
      } else if (err.response?.status === 401) {
        localStorage.removeItem('token');
        setToken(null);
        setError("Session expired. Please log in again.");
      } else {
        setError("Failed to fetch statistics. Please check your connection.");
      }
      setView('landing');
    }
  };

  const fetchHistory = async (t) => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/history', {
        headers: { Authorization: `Bearer ${t}` }
      });
      setHistory(response.data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchHistory(token);
    }
  }, [token]);

  const loginWithSpotify = () => {
    window.location.href = 'http://127.0.0.1:5000/auth/login';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setStats(null);
    setError(null);
    setView('landing');
  };

  if (view === 'loading') {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white p-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Music size={64} className="text-green-500 mb-8" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-bold tracking-tight"
        >
          Analyzing your soundscape...
        </motion.h2>
        <p className="text-gray-400 mt-2">Connecting to Spotify API</p>
      </div>
    );
  }

  if (view === 'wrapped' && stats) {
    return <WrappedStory
      stats={stats}
      isDemo={!token}
      onLogout={() => {
        localStorage.removeItem('token');
        setToken(null);
        setView('landing');
      }}
      onClose={() => setView(lastView)}
    />;
  }

  if (view === 'history' && token) {
    return (
      <div className="min-h-screen w-full bg-black text-white relative overflow-hidden flex flex-col">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full" />

        <nav className="z-10 relative flex justify-between items-center px-8 py-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setView('landing')}>
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Music className="text-black" size={24} />
            </div>
            <span className="text-2xl font-black tracking-tighter">WRAPIFY</span>
          </div>
          <button
            onClick={() => setView('landing')}
            className="px-6 py-2 border border-white/20 text-white font-bold rounded-full hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <ChevronLeft size={20} /> Back
          </button>
        </nav>

        <main className="z-10 relative flex-1 max-w-4xl mx-auto w-full px-6 py-12">
          <h1 className="text-4xl font-black mb-8 italic uppercase tracking-tighter">History</h1>

          {history.length === 0 ? (
            <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
              <Calendar size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-xl text-gray-400 font-medium">No history found. Generate your first wrap!</p>
              <button
                onClick={() => setView('landing')}
                className="mt-6 px-8 py-3 bg-green-500 text-black font-bold rounded-2xl hover:scale-105 transition-transform"
              >
                Generate Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((item, i) => (
                <motion.div
                  key={item._id || i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => {
                    setStats(item.stats);
                    setLastView('history');
                    setView('wrapped');
                  }}
                  className="bg-white/5 p-6 rounded-3xl border border-white/10 hover:border-green-500/50 hover:bg-white/10 cursor-pointer transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-black text-white group-hover:text-green-400 transition-colors">
                        {new Date(0, item.month - 1).toLocaleString('default', { month: 'long' })} {item.year}
                      </h3>
                      <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-1">
                        {item.term === 'short_term' ? '4 Weeks' : item.term === 'medium_term' ? '6 Months' : '1 Year'} Trend
                      </p>
                    </div>
                    <div className="bg-green-500/20 p-2 rounded-xl group-hover:bg-green-500/40 transition-colors">
                      <Play size={20} className="text-green-500" fill="currentColor" />
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4 overflow-hidden">
                    {item.stats.topArtists?.slice(0, 3).map((artist, j) => (
                      <div key={j} className="w-8 h-8 rounded-full border border-white/20 overflow-hidden bg-gray-800">
                        {artist.image && <img src={artist.image} className="w-full h-full object-cover" alt="" />}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-end border-t border-white/5 pt-4">
                    <span className="text-green-400 font-black text-sm">{item.stats.personality}</span>
                    <span className="text-gray-600 text-[10px] font-bold">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black text-white relative overflow-hidden selection:bg-green-500/30">
      {/* Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-green-900/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full" />

      <nav className="z-10 relative flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setView('landing'); setError(null); }}>
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
            <Music className="text-black" size={24} />
          </div>
          <span className="text-2xl font-black tracking-tighter">WRAPIFY</span>
        </div>

        {token ? (
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setView('loading'); setError(null); fetchStats(token, term); }}
              className="px-6 py-2 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
            >
              Generate Now
            </button>
            <button
              onClick={() => setView('history')}
              className="px-6 py-2 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Calendar size={18} /> History
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-white/20 text-white/60 hover:text-white hover:border-white/40 font-bold rounded-full transition-all text-sm uppercase tracking-wider"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={loginWithSpotify}
            className="flex items-center gap-2 px-6 py-2 bg-[#1DB954] text-black font-bold rounded-full hover:scale-105 transition-transform"
          >
            <LogIn size={20} />
            Login
          </button>
        )}
      </nav>

      {error && (
        <div className="z-20 relative max-w-2xl mx-auto mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm font-medium flex items-center gap-3">
          <div className="bg-red-500/20 p-2 rounded-lg">⚠️</div>
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto hover:text-white">✕</button>
        </div>
      )}

      <main className="z-10 relative flex flex-col items-center justify-center h-[calc(100vh-140px)] text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <h1 className="text-6xl md:text-8xl font-black leading-[0.9] mb-4">
            YOUR MUSIC. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
              ANYTIME.
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-8 font-medium">
            Don't wait until December. Generate your Spotify Wrapped history for the last 4 weeks, 6 months, or 1 year.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            {['short_term', 'medium_term', 'long_term'].map((t) => (
              <button
                key={t}
                onClick={() => setTerm(t)}
                className={`px-4 py-2 rounded-xl border transition-all ${term === t
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-gray-400 border-gray-800 hover:border-gray-600'
                  }`}
              >
                {t === 'short_term' ? '4 Weeks' : t === 'medium_term' ? '6 Months' : '1 Year'}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {token ? (
              <button
                onClick={() => { setView('loading'); fetchStats(token, term); }}
                className="group relative px-8 py-4 bg-white text-black text-xl font-bold rounded-2xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10 flex items-center gap-2">
                  <Play fill="currentColor" size={24} />
                  GENERATE WRAPPED
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={loginWithSpotify}
                  className="px-8 py-4 bg-[#1DB954] text-black text-xl font-bold rounded-2xl hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_rgba(29,185,84,0.4)]"
                >
                  <Play fill="currentColor" size={24} />
                  CONNECT SPOTIFY
                </button>
                <button
                  onClick={() => {
                    setStats({
                      minutes: 42069,
                      topArtists: [
                        { name: 'The Weeknd', image: 'https://images.unsplash.com/photo-1619983081563-430f63602796?w=400&h=400&fit=crop' },
                        { name: 'Arctic Monkeys', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop' },
                        { name: 'Tame Impala', image: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&h=400&fit=crop' }
                      ],
                      topTracks: [
                        { name: 'Blinding Lights', artist: 'The Weeknd' },
                        { name: 'Do I Wanna Know?', artist: 'Arctic Monkeys' },
                        { name: 'The Less I Know The Better', artist: 'Tame Impala' }
                      ],
                      personality: 'Explorer',
                      topGenres: ['Synth-pop', 'Indie', 'R&B'],
                      valence: 0.75,
                      energy: 0.82
                    });
                    setView('wrapped');
                  }}
                  className="px-8 py-4 border border-white/20 text-white text-xl font-bold rounded-2xl hover:bg-white/10 transition-colors"
                >
                  TRY DEMO
                </button>
              </>
            )}
          </div>
        </motion.div>

        {/* Floating Icons for Aesthetic */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-1/4 right-20 hidden lg:block opacity-20"
        >
          <Star size={48} />
        </motion.div>
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute bottom-1/4 left-20 hidden lg:block opacity-20"
        >
          <Layers size={48} />
        </motion.div>
      </main>

      <footer className="z-10 relative py-8 text-center text-gray-600 text-sm font-medium">
        Powered by Spotify Web API • Not affiliated with Spotify AB.
      </footer>
    </div>
  );
}

function WrappedStory({ stats, onLogout, onClose, isDemo }) {
  const [slide, setSlide] = useState(0);
  const cardRef = useRef(null);

  const slides = [
    { type: 'intro', title: 'Ready to relive your sound?' },
    { type: 'minutes', title: 'You spent some serious time...', value: stats.minutes, sub: 'Minutes Listened' },
    { type: 'artists', title: 'Your Top Artists', items: stats.topArtists },
    { type: 'tracks', title: 'The songs on repeat', items: stats.topTracks },
    { type: 'personality', title: 'You are the...', value: stats.personality },
    { type: 'final', title: 'Share your Wrapify' }
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slide]);

  const nextSlide = () => {
    if (slide < slides.length - 1) setSlide(slide + 1);
  };

  const prevSlide = () => {
    if (slide > 0) setSlide(slide - 1);
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: '#121212',
      scale: 2
    });
    const link = document.createElement('a');
    link.download = 'wrapify-stats.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="h-screen w-full bg-[#121212] overflow-hidden flex flex-col">
      <div className="flex gap-1 p-2">
        {slides.map((_, i) => (
          <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: slide >= i ? '100%' : '0%' }}
              transition={{ duration: 0.5 }}
            />
          </div>
        ))}
      </div>

      <div className="flex-1 relative flex items-center justify-center p-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 1.1, x: -20 }}
            className="w-full max-w-md h-full flex flex-col justify-center items-center"
          >
            {renderSlide(slides[slide], cardRef, downloadCard, stats)}
          </motion.div>
        </AnimatePresence>

        {/* Interaction zones */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 cursor-pointer" onClick={prevSlide} />
          <div className="flex-1 cursor-pointer" onClick={nextSlide} />
        </div>

        {/* Navigation Arrows */}
        {slide > 0 && (
          <button
            onClick={prevSlide}
            className="absolute left-4 z-20 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <ChevronLeft size={32} />
          </button>
        )}
        {slide < slides.length - 1 && (
          <button
            onClick={nextSlide}
            className="absolute right-4 z-20 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>

      <div className="p-6 flex justify-between items-center">
        <div className="flex gap-6">
          <button onClick={onLogout} className="text-gray-500 font-bold hover:text-white transition-colors">LOGOUT</button>
          <button onClick={onClose} className="text-green-500 font-bold hover:text-green-400 transition-colors uppercase tracking-widest">
            {isDemo ? 'Exit Demo' : 'Close'}
          </button>
        </div>
        <div className="flex gap-4">
          <Music className="text-green-500" />
          <span className="font-black text-white">WRAPIFY</span>
        </div>
        <button onClick={downloadCard} className="bg-white p-2 rounded-full text-black">
          <Download size={20} />
        </button>
      </div>
    </div>
  );
}

function renderSlide(s, cardRef, onDownload, stats) {
  switch (s.type) {
    case 'intro':
      return (
        <div className="space-y-6 text-center">
          <Music size={80} className="mx-auto text-green-500" />
          <h1 className="text-5xl font-black text-white leading-tight">{s.title}</h1>
        </div>
      );
    case 'minutes':
      return (
        <div className="space-y-4 text-center">
          <span className="text-green-400 font-bold text-xl uppercase tracking-widest">{s.sub}</span>
          <motion.h2
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-8xl font-black text-white"
          >
            {s.value.toLocaleString()}
          </motion.h2>
          <p className="text-2xl text-gray-400 font-medium">That's musical excellence.</p>
        </div>
      );
    case 'artists':
      return (
        <div className="w-full space-y-8">
          <h2 className="text-4xl font-black text-white mb-8 text-center">{s.title}</h2>
          <div className="grid grid-cols-1 gap-4">
            {s.items.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10"
              >
                <div className="text-3xl font-black text-white/20 w-8">{i + 1}</div>
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shadow-lg border border-white/10">
                  {a.image ? (
                    <img
                      src={a.image}
                      className="w-full h-full object-cover"
                      alt={a.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="w-full h-full items-center justify-center text-gray-500"
                    style={{ display: a.image ? 'none' : 'flex' }}
                  >
                    <User size={24} />
                  </div>
                </div>
                <span className="text-xl font-bold text-white">{a.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      );
    case 'tracks':
      return (
        <div className="w-full space-y-8">
          <h2 className="text-4xl font-black text-white mb-8 text-center">{s.title}</h2>
          <div className="space-y-4">
            {s.items.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="text-left"
              >
                <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
                  <span className="text-xl font-bold text-white line-clamp-1">{t.name}</span>
                  <span className="text-green-400 font-black ml-4">#{i + 1}</span>
                </div>
                <p className="text-gray-400 text-sm font-medium mt-1 uppercase tracking-wider">{t.artist}</p>
              </motion.div>
            ))}
          </div>
        </div>
      );
    case 'personality':
      return (
        <div className="bg-gradient-to-b from-purple-900 to-black p-12 rounded-[3rem] border border-white/20 shadow-2xl text-center">
          <Star className="mx-auto text-yellow-400 mb-6" size={64} fill="currentColor" />
          <h2 className="text-2xl font-bold text-purple-200 mb-2">Listening Personality</h2>
          <h1 className="text-6xl font-black text-white uppercase tracking-tighter italic">{s.value}</h1>
          <p className="mt-6 text-purple-200/60 font-medium">You don't just listen, you explore the unknown depths of every genre.</p>
        </div>
      );
    case 'final':
      const score = Math.min(100, Math.floor((stats.minutes / 1000) + (stats.topArtists.length * 5)));
      const uniqueSound = stats.topGenres ? stats.topGenres[0] : "Eclectic";

      return (
        <div className="space-y-8 w-full">
          <div ref={cardRef} className="w-72 h-[450px] mx-auto bg-[#1DB954] rounded-[2rem] p-8 flex flex-col justify-between text-left shadow-2xl relative overflow-hidden">
            {/* Background Texture/Shade */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-black/10 rounded-full -mr-16 -mt-16 blur-2xl" />

            <div className="space-y-6 relative z-10">
              <div className="flex justify-between items-start">
                <Music size={40} className="text-black" />
                <div className="bg-black text-[#1DB954] px-3 py-1 rounded-full text-xs font-black uppercase tracking-tighter">
                  Ver. 2026.1
                </div>
              </div>

              <div>
                <h3 className="text-black font-black text-4xl leading-[0.8] mb-1">MUSIC IQ.</h3>
                <span className="text-black/60 text-sm font-bold uppercase tracking-widest">Global Ranking</span>
              </div>

              <div className="flex items-baseline gap-2 border-t-4 border-black pt-4">
                <span className="text-black text-7xl font-black tracking-tighter leading-none">{score}</span>
                <span className="text-black font-black text-xl italic opacity-50">PTS</span>
              </div>

              <div className="space-y-1">
                <p className="text-black/50 text-xs font-black uppercase tracking-widest">Unique Sound</p>
                <p className="text-black font-black text-2xl uppercase tracking-tighter truncate">{uniqueSound}</p>
              </div>
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-black font-black text-lg uppercase tracking-tighter">WRAPIFY</p>
                  <p className="text-black/60 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Generated Anytime Trend</p>
                </div>
                <BarChart3 size={24} className="text-black opacity-30" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-black text-white text-center italic uppercase tracking-widest">{s.title}</h2>
            <button onClick={onDownload} className="w-full py-4 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-xl">
              <Download size={24} />
              DOWNLOAD CARD
            </button>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export default App;
