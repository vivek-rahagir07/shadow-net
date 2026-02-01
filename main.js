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
    const [navInstruction, setNavInstruction] = useState('PATH CLEAR');
    const lastSpeakTime = useRef(0);
    const lastNavSpeakTime = useRef(0);
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
        const color = isLocked ? '#6366f1' : 'rgba(148, 163, 184, 0.3)';
        ctx.strokeStyle = color;
        ctx.lineWidth = isLocked ? 2 : 1;
        ctx.setLineDash(isLocked ? [] : [4, 4]);

        // Clean Corner brackets
        const len = Math.min(w, h) * 0.1;
        ctx.lineJoin = 'round';

        // Top Left
        ctx.beginPath(); ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
        // Top Right
        ctx.beginPath(); ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len); ctx.stroke();
        // Bottom Left
        ctx.beginPath(); ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h); ctx.stroke();
        // Bottom Right
        ctx.beginPath(); ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len); ctx.stroke();

        if (isLocked) {
            // Minimal HUD Label
            ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
            const text = `${label.toUpperCase()} ${Math.round(confidence * 100)}%`;
            ctx.font = 'bold 11px Inter';
            const padding = 8;
            const textWidth = ctx.measureText(text).width;

            ctx.fillRect(x, y - 22, textWidth + (padding * 2), 22);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x + padding, y - 7);

            // Subtle selection glow
            ctx.fillStyle = 'rgba(99, 102, 241, 0.03)';
            ctx.fillRect(x, y, w, h);
        }
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

                // --- QGuide: Spatial Navigation Logic ---
                let primaryObstacle = null;
                highConfDetections.forEach(p => {
                    const [x, y, w, h] = p.bbox;
                    // Prioritize people or large objects as obstacles
                    if (p.class === 'person' || p.class === 'chair' || p.class === 'couch') {
                        if (!primaryObstacle || p.score > primaryObstacle.score) primaryObstacle = p;
                    }
                });

                let newNav = 'PATH CLEAR';
                if (primaryObstacle) {
                    const [x, y, w, h] = primaryObstacle.bbox;
                    const centerX = x + w / 2;
                    const vWidth = 1280; // Coordinate space of MobileNet V2 output

                    if (centerX > 480 && centerX < 800) {
                        newNav = `${primaryObstacle.class.toUpperCase()} AHEAD. STEER RIGHT.`;
                    } else if (centerX <= 480) {
                        newNav = `${primaryObstacle.class.toUpperCase()} ON LEFT. PATH CLEAR ON RIGHT.`;
                    } else {
                        newNav = `${primaryObstacle.class.toUpperCase()} ON RIGHT. PATH CLEAR ON LEFT.`;
                    }
                }

                if (newNav !== navInstruction) {
                    setNavInstruction(newNav);
                    // Critical navigation instructions have higher priority but longer cooldown
                    if (Date.now() - lastNavSpeakTime.current > 5000) {
                        speak(newNav);
                        lastNavSpeakTime.current = Date.now();
                    }
                }

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
            <header className="flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-4xl md:text-5xl font-black text-white font-heading tracking-tighter uppercase leading-none">
                        SHADOW<span className="text-accent-primary">NET</span>
                    </h2>
                    <div className="flex items-center gap-2 mt-3 text-text-muted font-bold text-[9px] uppercase tracking-[0.4em]">
                        <span className="w-2 h-2 rounded-full bg-accent-success animate-pulse"></span>
                        Neural Interface Active • Cluster: AX-90
                    </div>
                </div>
                <Button onClick={onBack} variant="secondary" iconName="power" className="px-8 bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white">Terminate</Button>
            </header>

            <div className="grid lg:grid-cols-12 gap-8 flex-1">
                <div className="lg:col-span-8 relative">
                    <div className="video-container glass border-white/5 h-full">
                        {loading && <div className="absolute inset-0 z-30 bg-bg-dark/95"><Loader text="Synchronizing Neural Cluster..." /></div>}
                        <div className="scan-line"></div>
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-[1.5rem]" />
                        <canvas ref={canvasRef} width="1280" height="720" className="absolute inset-0 pointer-events-none" />

                        <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
                            <div className="glass px-6 py-3 border-accent-primary/40 bg-accent-primary/10 backdrop-blur-2xl animate-entrance">
                                <p className="text-[10px] font-black text-accent-primary tracking-[0.4em] mb-2 uppercase">Q-Guide Assistance</p>
                                <p className="text-xl font-black text-white tracking-tight uppercase">{navInstruction}</p>
                            </div>
                        </div>

                        <div className="absolute bottom-6 left-6 flex gap-4 pointer-events-none">
                            <div className="glass px-4 py-2 flex items-center gap-3 border-white/10 backdrop-blur-xl">
                                <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">FPS</div>
                                <div className="text-sm font-black text-accent-success">30.2</div>
                            </div>
                            <div className="glass px-4 py-2 flex items-center gap-3 border-white/10 backdrop-blur-xl">
                                <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Threads</div>
                                <div className="text-sm font-black text-white">{detectedObjects.length}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-hidden">
                    <div className="glass p-8 flex-1 flex flex-col border-white/5 overflow-hidden">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                            <h3 className="text-[10px] font-black text-text-muted tracking-[0.4em] uppercase">Intelligence Stream</h3>
                            <div className="flex items-center gap-1.5 text-accent-primary">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent-primary"></div>
                                <span className="text-[9px] font-bold uppercase tracking-widest">Live</span>
                            </div>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                            {detectedObjects.length > 0 ? (
                                detectedObjects.map((obj, i) => (
                                    <div key={i} className="group p-5 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between animate-entrance hover:bg-white/[0.04] hover:border-accent-primary/20 transition-all">
                                        <div>
                                            <p className="text-white font-black text-lg tracking-tight uppercase leading-none">{obj.class}</p>
                                            <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-2 px-2 py-0.5 bg-accent-primary/10 rounded inline-block">Active Lock</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-accent-primary font-black text-xl">{Math.round(obj.score * 100)}%</p>
                                            <p className="text-[8px] text-text-muted font-bold uppercase tracking-tighter mt-1 opacity-50">Precision</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                                    <i data-lucide="radar" className="w-12 h-12 mb-4 animate-pulse"></i>
                                    <p className="text-[10px] font-bold tracking-[0.3em] uppercase">Scanning Environment...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="glass p-6 border-white/5 bg-white/[0.01]">
                        <h4 className="text-[8px] font-black text-text-muted uppercase tracking-[0.4em] mb-4">Registry Log</h4>
                        <div className="flex flex-wrap gap-2">
                            {history.map((h) => (
                                <span key={h.id} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold text-text-muted uppercase tracking-tighter animate-entrance hover:bg-white/10 transition-colors">
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
        <div className="min-h-screen p-6 md:p-10 animate-entrance flex flex-col max-w-[1600px] mx-auto">
            <AslReferenceDrawer isOpen={isGuideOpen} onClose={() => setGuideOpen(false)} />
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h2 className="text-4xl md:text-5xl font-black text-white font-heading tracking-tighter uppercase leading-none">
                        ASL<span className="text-accent-secondary">BRIDGE</span>
                    </h2>
                    <div className="flex items-center gap-2 mt-3 text-text-muted font-bold text-[9px] uppercase tracking-[0.4em]">
                        <span className="w-2 h-2 rounded-full bg-accent-secondary animate-pulse"></span>
                        Symmetric Gesture Synthesis Active
                    </div>
                </div>
                <div className="flex gap-4">
                    <Button onClick={() => setGuideOpen(true)} variant="secondary" iconName="book-open" className="px-6">Lexicon</Button>
                    <Button onClick={onBack} variant="secondary" iconName="power" className="px-6 bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white">Exit Lab</Button>
                </div>
            </header>

            <div className="grid lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
                <div className="lg:col-span-8 relative">
                    <div className="video-container glass border-white/5 h-full">
                        {loading && <div className="absolute inset-0 z-30 bg-bg-dark/95"><Loader text="Calibrating Neural Sensors..." /></div>}
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-[1.5rem]" />
                        <canvas ref={canvasRef} width="640" height="480" className="absolute inset-0 opacity-40 pointer-events-none" />

                        {currentGesture && (
                            <div className="absolute top-8 right-8 glass p-10 min-w-[180px] border-accent-secondary/40 text-center animate-entrance backdrop-blur-3xl bg-accent-secondary/5">
                                <p className="text-[10px] font-black text-accent-secondary uppercase tracking-[0.3em] mb-6">Interpreted</p>
                                <span className="text-9xl font-black text-white drop-shadow-[0_0_40px_rgba(14,165,233,0.4)]">{currentGesture}</span>
                                <div className="mt-10 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-accent-secondary transition-all duration-100" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="lg:col-span-4 flex flex-col gap-6 h-full justify-end">
                    <div className="glass p-10 border-white/5 bg-white/[0.01]">
                        <h4 className="text-[10px] font-black text-text-muted tracking-[0.4em] mb-10 text-center uppercase">Neural Calibration</h4>
                        <div className="flex gap-4 justify-center">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className={`w-2.5 h-2.5 rounded-full ${i === 1 ? 'bg-accent-secondary animate-pulse' : 'bg-white/5'}`}></div>
                            ))}
                        </div>
                        <p className="text-[9px] text-text-muted font-bold text-center mt-8 uppercase tracking-widest opacity-40 italic">Waiting for specific geometry...</p>
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
                <div className="min-h-screen flex flex-col items-center justify-center p-6 md:p-12 animate-entrance max-w-7xl mx-auto">
                    <header className="text-center mb-24 relative">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 glass border-accent-primary/20 rounded-full mb-8">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse"></div>
                            <span className="text-[10px] font-bold text-accent-primary uppercase tracking-[0.3em]">System v3.5 Stable</span>
                        </div>
                        <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter mb-6 leading-none">
                            AURORA<span className="text-accent-primary">.</span>OS
                        </h1>
                        <p className="text-text-muted text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                            Next-generation neural orchestration for situational intelligence and spatial interpretation.
                        </p>
                    </header>

                    <div className="grid md:grid-cols-2 gap-8 w-full">
                        {[
                            { id: 'shadow', title: 'Shadow Net', desc: 'Secure Environmental Analysis', icon: 'eye', status: 'Optimal', meta: 'Neural v2.5' },
                            { id: 'asl', title: 'ASL Bridge', desc: 'Symmetric Gesture Synthesis', icon: 'zap', status: 'Ready', meta: 'Handpose 4.0' }
                        ].map(module => (
                            <div key={module.id}
                                onClick={() => setMode(module.id)}
                                className="group glass p-10 cursor-pointer hover:border-accent-primary/40 hover:translate-y-[-4px] active:scale-95">
                                <div className="flex justify-between items-start mb-10">
                                    <div className="p-4 rounded-xl bg-accent-primary/10 text-accent-primary group-hover:bg-accent-primary group-hover:text-white transition-all">
                                        <i data-lucide={module.icon} className="w-8 h-8"></i>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-accent-success uppercase tracking-widest">{module.status}</span>
                                        <p className="text-[9px] text-text-muted font-bold uppercase mt-1 opacity-50">{module.meta}</p>
                                    </div>
                                </div>
                                <h2 className="text-3xl font-black text-white mb-2 tracking-tight uppercase">{module.title}</h2>
                                <p className="text-text-muted text-sm font-medium mb-8 leading-relaxed">{module.desc}</p>
                                <div className="flex items-center text-accent-primary text-xs font-bold uppercase tracking-widest gap-2">
                                    Initialize Interface <i data-lucide="chevron-right" className="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
                                </div>
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
