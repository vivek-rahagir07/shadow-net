const { useState, useEffect, useRef, useCallback } = React;

// --- Data ---
const ASL_ALPHABET = [
    { letter: 'A', name: 'Alpha', emoji: '✊' }, { letter: 'B', name: 'Bravo', emoji: '✋' }, { letter: 'C', name: 'Charlie', emoji: '↪️' },
    { letter: 'D', name: 'Delta', emoji: '☝️' }, { letter: 'E', name: 'Echo', emoji: '✊' }, { letter: 'F', name: 'Foxtrot', emoji: '👌' },
    { letter: 'G', name: 'Golf', emoji: '👈' }, { letter: 'H', name: 'Hotel', emoji: '👉' }, { letter: 'I', name: 'India', emoji: '🤙' },
    { letter: 'J', name: 'Juliet', emoji: '⤴️' }, { letter: 'K', name: 'Kilo', emoji: '🖖' }, { letter: 'L', name: 'Lima', emoji: '🤟' },
    { letter: 'M', name: 'Mike', emoji: '🤚' }, { letter: 'N', name: 'November', emoji: '👋' }, { letter: 'O', name: 'Oscar', emoji: '👌' },
    { letter: 'P', name: 'Papa', emoji: '👇' }, { letter: 'Q', name: 'Quebec', emoji: '🤏' }, { letter: 'R', name: 'Romeo', emoji: '🤞' },
    { letter: 'S', name: 'Sierra', emoji: '👊' }, { letter: 'T', name: 'Tango', emoji: '🤛' }, { letter: 'U', name: 'Uniform', emoji: '✌️' },
    { letter: 'V', name: 'Victor', emoji: '✌️' }, { letter: 'W', name: 'Whiskey', emoji: '🤟' }, { letter: 'X', name: 'X-ray', emoji: '☝️' },
    { letter: 'Y', name: 'Yankee', emoji: '🤙' }, { letter: 'Z', name: 'Zulu', emoji: '☝️' }
];

const TUTORIAL_LEVELS = [
    { title: "Level 1: Letter by Letter", description: "Learn the alphabet sequentially with emoji guides.", type: "sequence", data: ASL_ALPHABET },
    { title: "Level 2: Random Recall", description: "Match random letters to test your memory.", type: "random_letters", count: 10 },
    { title: "Level 3: Word Builder", description: "Standard words for daily use.", type: "words", data: ["HELLO", "PLEASE", "THANK", "HELP", "YES", "NO"] }
];

const REFERENCE_IMAGE = "https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8?auto=format&fit=crop&q=80&w=1200";

// --- Utility Components ---

const Button = ({ onClick, children, className = "", variant = "primary", iconName }) => {
    const btnRef = useRef(null);
    useEffect(() => {
        if (window.lucide && iconName && btnRef.current) {
            window.lucide.createIcons({ root: btnRef.current, nameAttr: 'data-lucide' });
        }
    });

    const variantClass = variant === "primary" ? "btn-primary" : variant === "accent" ? "btn-accent" : "bg-white/5 hover:bg-white/10 text-white border border-white/10";

    return (
        <button ref={btnRef} onClick={onClick} className={`btn-premium ${variantClass} ${className}`}>
            {iconName && <i data-lucide={iconName} className="w-5 h-5"></i>}
            {children}
        </button>
    );
};

const Loader = ({ text }) => (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-entrance">
        <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-4 border-2 border-cyan-500 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        </div>
        <p className="text-cyan-400 font-bold tracking-[0.4em] text-[10px] uppercase animate-pulse">{text}</p>
    </div>
);

// --- Shared Logic ---

const speak = (text) => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
};

const analyzeHand = (landmarks) => {
    const isExtended = (tipIdx, pipIdx) => landmarks[tipIdx][1] < landmarks[pipIdx][1];
    const fingers = [isExtended(8, 6), isExtended(12, 10), isExtended(16, 14), isExtended(20, 18)];
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    const thumbUp = thumbTip[1] < landmarks[3][1];
    const thumbOut = Math.abs(thumbTip[0] - thumbMcp[0]) > 40;
    const getDistance = (p1, p2) => Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    const pinches = [
        getDistance(thumbTip, landmarks[8]) < 45,
        getDistance(thumbTip, landmarks[12]) < 45,
        getDistance(thumbTip, landmarks[16]) < 45,
        getDistance(thumbTip, landmarks[20]) < 45
    ];
    const indexMiddleDistance = getDistance(landmarks[8], landmarks[12]);
    const crossed = (landmarks[8][0] > landmarks[12][0] && landmarks[6][0] < landmarks[10][0]) ||
        (landmarks[8][0] < landmarks[12][0] && landmarks[6][0] > landmarks[10][0]);
    return { fingers, thumbUp, thumbOut, pinches, indexMiddleDistance, crossed };
};

const recognize = (data, mode) => {
    const { fingers, thumbUp, thumbOut, pinches, indexMiddleDistance, crossed } = data;
    const [index, middle, ring, pinky] = fingers;

    if (mode === 'numbers') {
        const count = fingers.filter(f => f).length;
        if (count === 4 && thumbOut) return "5";
        if (count === 4 && !thumbOut) return "4";
        return "N";
    }

    if (!index && !middle && !ring && !pinky) { if (thumbUp) return "A"; return "S"; }
    if (index && middle && ring && pinky && !thumbOut) return "B";
    if (index && middle && ring && pinky && thumbOut) return "C";
    if (index && !middle && !ring && !pinky && thumbOut) return "L";
    if (index && middle && !ring && !pinky && indexMiddleDistance > 55) return "V";
    if (index && pinky && !middle && !ring && thumbOut) return "🤟";

    return null;
};

// --- Components ---

const AslReferenceDrawer = ({ isOpen, onClose }) => (
    <div className={`drawer glass ${isOpen ? 'open' : ''}`}>
        <div className="flex justify-between items-center mb-12">
            <h3 className="text-3xl font-black text-white tracking-tighter">LEXICON</h3>
            <button onClick={onClose} className="p-3 bg-white/5 rounded-full text-white hover:bg-white/10 transition-all hover:scale-110">
                <i data-lucide="x" className="w-6 h-6"></i>
            </button>
        </div>
        <div className="asl-grid">
            {ASL_ALPHABET.map((item) => (
                <div key={item.letter} className="asl-card group relative overflow-hidden">
                    <span className="letter z-10">{item.letter}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase mt-2 z-10">{item.name}</span>
                    <span className="absolute -bottom-2 -right-2 text-4xl opacity-5 group-hover:opacity-20 transition-opacity rotate-12">{item.emoji}</span>
                </div>
            ))}
        </div>
    </div>
);

// --- Main Views ---

const ShadowNet = ({ onBack }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detectedObjects, setDetectedObjects] = useState([]);
    const [history, setHistory] = useState([]);
    const lastSpeakTime = useRef(0);
    const historyRef = useRef([]);

    useEffect(() => {
        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: 1280, height: 720 }
                });
                if (videoRef.current) videoRef.current.srcObject = stream;
                // Load mobilenet_v2 for higher precision
                const loadedModel = await cocoSsd.load({ base: 'mobilenet_v2' });
                setModel(loadedModel);
                setLoading(false);
                speak("NEURAL ENGINE ONLINE. SCANNING ENVIRONMENT.");
            } catch (err) { console.error(err); }
        };
        init();
        return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    }, []);

    const drawARBox = (ctx, x, y, w, h, label, confidence, isLocked) => {
        const color = isLocked ? '#06b6d4' : 'rgba(255, 255, 255, 0.2)';
        ctx.strokeStyle = color;
        ctx.lineWidth = isLocked ? 3 : 1;
        ctx.setLineDash(isLocked ? [] : [5, 5]);

        // Corner brackets
        const len = Math.min(w, h) * 0.15;

        // Top Left
        ctx.beginPath();
        ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
        ctx.stroke();

        // Top Right
        ctx.beginPath();
        ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
        ctx.stroke();

        // Bottom Left
        ctx.beginPath();
        ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
        ctx.stroke();

        // Bottom Right
        ctx.beginPath();
        ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
        ctx.stroke();

        // Label Background
        ctx.fillStyle = 'rgba(6, 182, 212, 0.8)';
        const text = `${label.toUpperCase()} ${Math.round(confidence * 100)}%`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(x, y - 30, textWidth + 20, 30);

        // Label Text
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Outfit';
        ctx.fillText(text, x + 10, y - 10);

        // Subtle fill
        ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
        ctx.fillRect(x, y, w, h);
    };

    useEffect(() => {
        if (!model || loading) return;
        let animationId;
        const detectionCounts = {}; // Track stability over frames

        const detect = async () => {
            if (videoRef.current?.readyState === 4) {
                const predictions = await model.detect(videoRef.current);
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                // Update stability counts
                predictions.forEach(p => {
                    if (p.score > 0.4) {
                        detectionCounts[p.class] = (detectionCounts[p.class] || 0) + 1;
                    }
                });

                // Decay logic for missing objects
                Object.keys(detectionCounts).forEach(cls => {
                    if (!predictions.find(p => p.class === cls)) {
                        detectionCounts[cls] = Math.max(0, detectionCounts[cls] - 1);
                    }
                    if (detectionCounts[cls] > 15) detectionCounts[cls] = 15; // Cap stability
                });

                const highConfDetections = predictions.filter(p => {
                    const stability = detectionCounts[p.class] || 0;
                    // Hysteresis: Easier to stay confirmed than to become confirmed
                    const isStable = stability >= 5;
                    const threshold = isStable ? 0.45 : 0.7;
                    return p.score > threshold;
                });

                setDetectedObjects(highConfDetections);

                highConfDetections.forEach(p => {
                    const [x, y, w, h] = p.bbox;
                    const isLocked = (detectionCounts[p.class] || 0) >= 8;
                    drawARBox(ctx, x, y, w, h, p.class, p.score, isLocked);

                    if (isLocked && !historyRef.current.find(h => h.class === p.class && Date.now() - h.time < 10000)) {
                        const newEntry = { class: p.class, time: Date.now(), id: Math.random() };
                        historyRef.current = [newEntry, ...historyRef.current].slice(0, 5);
                        setHistory([...historyRef.current]);

                        if (Date.now() - lastSpeakTime.current > 4000) {
                            speak(`Confirmed ${p.class}`);
                            lastSpeakTime.current = Date.now();
                        }
                    }
                });
            }
            animationId = requestAnimationFrame(detect);
        };
        detect();
        return () => cancelAnimationFrame(animationId);
    }, [model, loading]);

    return (
        <div className="min-h-screen p-6 md:p-10 animate-entrance flex flex-col max-w-[1600px] mx-auto">
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-indigo-600 tracking-tighter uppercase">Shadow Net</h2>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <p className="text-slate-500 font-bold text-[10px] tracking-[0.4em] uppercase">Tactical Neural Interface • v3.0</p>
                    </div>
                </div>
                <Button onClick={onBack} variant="secondary" iconName="arrow-left" className="px-8">Terminate Session</Button>
            </header>

            <div className="grid lg:grid-cols-12 gap-8 flex-1">
                <div className="lg:col-span-8 relative">
                    <div className="video-container group overflow-hidden border-2 border-cyan-500/30">
                        {loading && <div className="absolute inset-0 z-30 bg-black/90"><Loader text="Synchronizing Neural Pathways..." /></div>}
                        <div className="scan-line"></div>
                        <video ref={videoRef} autoPlay playsInline muted width="1280" height="720" className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} width="1280" height="720" className="absolute inset-0 pointer-events-none" />

                        <div className="detection-meta">
                            <div className="flex gap-2">
                                <div className="detection-tag bg-cyan-500/20">Active Threads: {detectedObjects.length}</div>
                                <div className="detection-tag bg-indigo-500/20">Latency: 24ms</div>
                            </div>
                            <div className="detection-tag border-emerald-500 text-emerald-500">System Nominal</div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="glass p-8 flex-1 flex flex-col border-indigo-500/20">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xs font-black text-indigo-400 tracking-[0.4em] uppercase">Intelligence Stream</h3>
                            <i data-lucide="activity" className="w-4 h-4 text-indigo-400 animate-pulse"></i>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                            {detectedObjects.length > 0 ? (
                                detectedObjects.map((obj, i) => (
                                    <div key={i} className="object-card flex items-center justify-between animate-entrance" style={{ animationDelay: `${i * 0.1}s` }}>
                                        <div>
                                            <p className="text-white font-black text-xl tracking-tight uppercase">{obj.class}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Classification Confirmed</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-cyan-400 font-black text-lg">{Math.round(obj.score * 100)}%</p>
                                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Certainty</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                    <i data-lucide="scan" className="w-12 h-12 mb-4 animate-pulse"></i>
                                    <p className="text-sm font-bold tracking-widest uppercase">Awaiting environmental input...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="glass p-6 border-white/5 bg-white/[0.02]">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-4">Detection History</p>
                        <div className="flex flex-wrap gap-2">
                            {history.map((h) => (
                                <span key={h.id} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-tighter animate-entrance">
                                    {h.class}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AslAcademy = ({ onBack }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentGesture, setCurrentGesture] = useState(null);
    const [progress, setProgress] = useState(0);
    const [isGuideOpen, setGuideOpen] = useState(false);
    const gestureRef = useRef({ start: 0, last: null });

    useEffect(() => {
        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
                if (videoRef.current) videoRef.current.srcObject = stream;
                const loadedModel = await handpose.load();
                setModel(loadedModel);
                setLoading(false);
            } catch (err) { console.error(err); }
        };
        init();
        return () => videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    }, []);

    useEffect(() => {
        if (!model || loading) return;
        const loop = async () => {
            if (videoRef.current?.readyState === 4) {
                const predictions = await model.estimateHands(videoRef.current);
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, 640, 480);

                if (predictions.length > 0) {
                    predictions[0].landmarks.forEach(pt => {
                        ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, 2 * Math.PI);
                        ctx.fillStyle = "#ffab40"; ctx.fill();
                    });

                    const data = analyzeHand(predictions[0].landmarks);
                    const gesture = recognize(data, 'letters');

                    if (gesture) {
                        if (gesture === gestureRef.current.last) {
                            const duration = Date.now() - gestureRef.current.start;
                            const p = Math.min((duration / 1000) * 100, 100);
                            setProgress(p);
                            if (duration > 1000) { speak(gesture); gestureRef.current.start = Date.now(); }
                        } else {
                            gestureRef.current = { start: Date.now(), last: gesture };
                            setProgress(0);
                        }
                        setCurrentGesture(gesture);
                    } else { setCurrentGesture(null); setProgress(0); }
                }
            }
            requestAnimationFrame(loop);
        };
        loop();
    }, [model, loading]);

    return (
        <div className="min-h-screen p-10 animate-entrance flex flex-col max-w-7xl mx-auto">
            <AslReferenceDrawer isOpen={isGuideOpen} onClose={() => setGuideOpen(false)} />
            <header className="flex justify-between items-center mb-16 relative z-10">
                <div>
                    <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-500 tracking-tighter uppercase">ASL Bridge</h2>
                    <p className="text-slate-500 font-bold text-xs tracking-[0.3em] mt-2">GESTURE NEURAL LINK</p>
                </div>
                <div className="flex gap-6">
                    <Button onClick={() => setGuideOpen(true)} variant="secondary" iconName="book-open">Lexicon</Button>
                    <Button onClick={onBack} variant="secondary" iconName="arrow-left">Exit Lab</Button>
                </div>
            </header>

            <div className="grid lg:grid-cols-12 gap-12 flex-1 relative z-10">
                <div className="lg:col-span-8">
                    <div className="video-container border-amber-500/40">
                        {loading && <div className="absolute inset-0 z-20 bg-black/90"><Loader text="Calibrating Sensors..." /></div>}
                        <video ref={videoRef} autoPlay playsInline muted />
                        <canvas ref={canvasRef} width="640" height="480" className="opacity-60" />

                        {currentGesture && (
                            <div className="absolute top-10 right-10 glass p-10 min-w-[150px] border-amber-400/40 text-center animate-entrance">
                                <span className="text-8xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(255,171,64,0.4)]">{currentGesture}</span>
                                <div className="mt-8 h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 transition-all duration-100" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="lg:col-span-4 flex flex-col gap-8 justify-end">
                    <div className="glass p-12 border-white/5">
                        <h4 className="text-xs font-black text-slate-500 tracking-[0.4em] mb-10 text-center uppercase">Learning Progress</h4>
                        <div className="flex gap-3 justify-center">
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className={`w-3 h-3 rounded-full ${i === 1 ? 'bg-amber-400' : 'bg-white/10'}`}></div>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const [mode, setMode] = useState('home');
    useEffect(() => { if (window.lucide) window.lucide.createIcons(); }, [mode]);

    return (
        <div className="min-h-screen relative">
            <div className="super-aura"></div>

            {mode === 'home' && (
                <div className="min-h-screen flex flex-col items-center justify-center p-10 animate-entrance">
                    <header className="text-center mb-24 max-w-3xl">
                        <div className="inline-block px-6 py-2 glass border-indigo-500/40 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-[0.5em] mb-12 shadow-2xl">Hyper-Accessibility v2.5</div>
                        <h1 className="text-9xl md:text-[11.5rem] font-black text-white tracking-tighter mb-10 leading-[0.8] text-center drop-shadow-2xl">VISION<br /><span className="text-transparent bg-clip-text bg-gradient-to-tr from-indigo-600 via-indigo-400 to-cyan-400">ASSIST</span></h1>
                        <p className="text-slate-400 text-2xl font-medium leading-relaxed opacity-70 max-w-xl mx-auto">Bridging the gap through high-fidelity neural interpretation.</p>
                    </header>

                    <div className="grid md:grid-cols-2 gap-12 w-full max-w-6xl">
                        {[
                            { id: 'shadow', title: 'SHADOW NET', desc: 'Situational Awareness Engine.', variant: 'accent', icon: 'eye' },
                            { id: 'asl', title: 'ASL BRIDGE', desc: 'Gesture Synthesis Laboratory.', variant: 'primary', icon: 'zap' }
                        ].map(module => (
                            <div key={module.id} className="group glass p-14 hover:scale-[1.03] hover:bg-white/[0.04] border-white/5 hover:border-white/10 transition-all duration-700">
                                <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 flex items-center justify-center mb-12 text-white group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all">
                                    <i data-lucide={module.icon} className="w-10 h-10"></i>
                                </div>
                                <h2 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase">{module.title}</h2>
                                <p className="text-slate-500 text-xl font-medium mb-12">{module.desc}</p>
                                <Button onClick={() => setMode(module.id)} variant={module.variant} className="w-full py-6 text-xl rounded-2xl">Initialize Link</Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {mode === 'shadow' && <ShadowNet onBack={() => setMode('home')} />}
            {mode === 'asl' && <AslAcademy onBack={() => setMode('home')} />}

            <footer className="fixed bottom-12 w-full text-center text-slate-800 text-[10px] font-black uppercase tracking-[0.6em] pointer-events-none opacity-50">
                PROXIMA NEURAL SYSTEMS • AURORA OS
            </footer>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
