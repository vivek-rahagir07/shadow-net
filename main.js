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
    { title: "Level 3: Word Builder", description: "Standard words for daily use.", type: "words", data: ["HELLO", "PLEASE", "THANK", "HELP", "YES", "NO"] },
    { title: "Level 4: Speed Challenge", description: "Random words against the clock.", type: "timed_words", time: 30 },
    { title: "Level 5: Expression", description: "Constructing simple sentences using signs.", type: "sentences", data: ["I NEED HELP", "THANK YOU", "HOW ARE YOU"] }
];

// Reference Image Path from User Upload
const REFERENCE_IMAGE = "file:///Users/vivek/.gemini/antigravity/brain/3b3acdd0-ad6f-47f5-b978-a313d396fcd6/uploaded_media_1769823992073.png";

// --- Utility Components ---

const Button = ({ onClick, children, className = "", variant = "primary", iconName }) => {
    const btnRef = useRef(null);
    useEffect(() => {
        if (window.lucide && iconName && btnRef.current) {
            window.lucide.createIcons({ root: btnRef.current, nameAttr: 'data-lucide' });
        }
    });
    const baseStyle = "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 active:scale-95";
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20",
        secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700",
        danger: "bg-red-500 hover:bg-red-400 text-white shadow-xl shadow-red-500/20",
        accent: "bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-xl shadow-cyan-500/20",
        success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-500/20",
        warning: "bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-xl shadow-amber-500/20"
    };
    return (
        <button ref={btnRef} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
            {iconName && <i data-lucide={iconName} className="w-5 h-5"></i>}
            {children}
        </button>
    );
};

const Loader = ({ text }) => (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-cyan-400 animate-pulse font-mono tracking-widest text-sm uppercase">{text}</p>
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
    const count = fingers.filter(f => f).length;

    // Numbers (0-10)
    if (mode === 'numbers') {
        if (count === 4 && thumbOut) return "5";
        if (count === 4 && !thumbOut) return "4";
        if (pinches[3] && index && middle && ring) return "6";
        if (pinches[2] && index && middle && pinky) return "7";
        if (pinches[1] && index && ring && pinky) return "8";
        if (pinches[0] && middle && ring && pinky) return "9";
        if (index && middle && !ring && !pinky && thumbOut) return "3";
        if (index && middle && !ring && !pinky) return "2";
        if (index && !middle && !ring && !pinky) return "1";
        if (!index && !middle && !ring && !pinky && thumbUp) return "10";
        if (!index && !middle && !ring && !pinky) return "0";
    }

    // Letters (A-Z) - Enhanced Recognition Logic
    // A: Closed fist, thumb alongside (thumbUp actually means thumb is top side here)
    if (!index && !middle && !ring && !pinky) {
        if (thumbUp) return "A";
        return "S";
    }

    // B: All fingers extended and together
    if (index && middle && ring && pinky && !thumbOut) return "B";

    // C: Curved fingers (hard to detect perfectly, but can estimate)
    if (index && middle && ring && pinky && thumbOut) return "C";

    // D: Index extended, others pinched
    if (index && !middle && !ring && !pinky && pinches[1]) return "D";

    // L: Index and Thumb extended
    if (index && !middle && !ring && !pinky && thumbOut) return "L";

    // V: Index and Middle spread
    if (index && middle && !ring && !pinky && indexMiddleDistance > 50) return "V";

    // U: Index and Middle together
    if (index && middle && !ring && !pinky && indexMiddleDistance < 30) return "U";

    // W: Index, Middle, Ring extended
    if (index && middle && ring && !pinky) return "W";

    // F: Thumb and Index touch, others extended
    if (pinches[0] && middle && ring && pinky) return "F";

    // R: Index and Middle crossed
    if (index && middle && !ring && !pinky && crossed) return "R";

    // Y: Thumb and Pinky extended
    if (!index && !middle && !ring && pinky && thumbOut) return "Y";

    // I: Only Pinky extended
    if (!index && !middle && !ring && pinky && !thumbOut) return "I";

    // ASL "I Love You" sign (🤟)
    if (index && pinky && !middle && !ring && thumbOut) return "🤟";

    return null;
};

// --- Components ---

const AslReferenceDrawer = ({ isOpen, onClose }) => (
    <div className={`drawer ${isOpen ? 'open' : ''}`}>
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">ASL Guide</h3>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                <i data-lucide="x" className="w-6 h-6"></i>
            </button>
        </div>
        <div className="flex flex-col gap-4 mb-8">
            <img src={REFERENCE_IMAGE} alt="ASL Reference" className="w-full rounded-xl border border-slate-700 shadow-lg" />
            <p className="text-slate-400 text-xs italic">Use the visual guide above to match your hand signs.</p>
        </div>
        <div className="asl-grid">
            {ASL_ALPHABET.map((item) => (
                <div key={item.letter} className="asl-card shadow-lg group">
                    <span className="text-2xl mb-1 block group-hover:scale-125 transition-transform">{item.emoji}</span>
                    <span className="letter">{item.letter}</span>
                    <span className="name">{item.name}</span>
                </div>
            ))}
        </div>
        <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <h4 className="text-amber-400 font-bold text-xs uppercase tracking-widest mb-2">Simplified Gestures</h4>
            <div className="space-y-2">
                <p className="text-slate-400 text-xs">👏 <b>Clap/Close Hands</b>: Clear message</p>
                <p className="text-slate-400 text-xs">👍👍 <b>Both Thumbs Up</b>: Confirm/Yes</p>
                <p className="text-slate-400 text-xs">✋✋ <b>Both Palms Out</b>: Stop/Need Help</p>
            </div>
        </div>
    </div>
);

// --- Main Views ---

const ShadowNet = ({ onBack }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastSpoken, setLastSpoken] = useState("");
    const [detections, setDetections] = useState([]);
    const lastSpeakTime = useRef(0);

    const speakWithThrottle = (text) => {
        const now = Date.now();
        if (now - lastSpeakTime.current < 2500) return;
        speak(text);
        setLastSpoken(text);
        lastSpeakTime.current = now;
    };

    useEffect(() => {
        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                if (videoRef.current) videoRef.current.srcObject = stream;
                const loadedModel = await cocoSsd.load();
                setModel(loadedModel);
                setLoading(false);
                speak("Shadow Net activated. I am now your eyes.");
            } catch (err) { console.error(err); }
        };
        init();
        return () => {
            if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        };
    }, []);

    useEffect(() => {
        if (!model || loading) return;
        let animationId;
        const detect = async () => {
            if (videoRef.current?.readyState === 4) {
                const predictions = await model.detect(videoRef.current);
                setDetections(predictions);
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, 640, 480);

                let prominent = null;
                predictions.forEach(p => {
                    const [x, y, w, h] = p.bbox;
                    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
                    if (!prominent || (w * h > prominent.bbox[2] * prominent.bbox[3])) prominent = p;
                });

                if (prominent) {
                    const area = prominent.bbox[2] * prominent.bbox[3];
                    const dist = area / (640 * 480) > 0.4 ? "very close" : "nearby";
                    speakWithThrottle(`${prominent.class} detected ${dist}`);
                }
            }
            animationId = requestAnimationFrame(detect);
        };
        detect();
        return () => cancelAnimationFrame(animationId);
    }, [model, loading]);

    return (
        <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 md:p-8 animate-fade-in">
            <div className="flex justify-between w-full items-center mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-cyan-400 flex items-center gap-3">
                        <i data-lucide="eye" className="animate-pulse"></i> Shadow Net
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Real-time object detection & voice guidance.</p>
                </div>
                <Button onClick={onBack} variant="secondary" iconName="arrow-left">Exit Scanner</Button>
            </div>
            <div className="grid lg:grid-cols-3 gap-8 w-full">
                <div className="lg:col-span-2 relative video-container group">
                    {loading && <div className="absolute inset-0 z-20 bg-slate-950/90"><Loader text="Initializing neural engine..." /></div>}
                    <div className="scan-line"></div>
                    <video ref={videoRef} autoPlay playsInline muted width="640" height="480" />
                    <canvas ref={canvasRef} width="640" height="480" className="opacity-80" />
                </div>
                <div className="glass p-8 rounded-3xl flex flex-col gap-6 shadow-2xl border-cyan-500/20">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
                        <h3 className="text-cyan-400 font-bold text-xs uppercase tracking-widest">Live Neural Insights</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <p className="text-3xl text-white font-black leading-tight tracking-tight">
                            {lastSpoken || "Searching for objects..."}
                        </p>
                    </div>
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
                        <p className="text-xs text-cyan-500/80 font-medium">Using COCO-SSD Model for reliable spatial awareness.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AslBridge = ({ onBack, initialTab = 'bridge' }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(initialTab);
    const [isGuideOpen, setGuideOpen] = useState(false);

    const [sentence, setSentence] = useState([]);
    const [currentGesture, setCurrentGesture] = useState(null);
    const [progress, setProgress] = useState(0);

    const [levelIndex, setLevelIndex] = useState(0);
    const [targetIndex, setTargetIndex] = useState(0);
    const [successFeedback, setSuccessFeedback] = useState(false);

    const gestureRef = useRef({ start: 0, last: null });
    const animationFrameRef = useRef(null);

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
        return () => {
            if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    useEffect(() => {
        if (!model || loading) return;
        const loop = async () => {
            if (videoRef.current?.readyState === 4) {
                const predictions = await model.estimateHands(videoRef.current);
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, 640, 480);

                if (predictions.length > 0) {
                    predictions.forEach(hand => {
                        hand.landmarks.forEach(pt => {
                            ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, 2 * Math.PI);
                            ctx.fillStyle = "#fbbf24"; ctx.fill();
                        });
                    });

                    // TWO HAND GESTURES
                    if (predictions.length === 2) {
                        const h1 = analyzeHand(predictions[0].landmarks);
                        const h2 = analyzeHand(predictions[1].landmarks);

                        // Clap / Close Palms
                        const dist = Math.abs(predictions[0].landmarks[0][0] - predictions[1].landmarks[0][0]);
                        if (dist < 100) {
                            setSentence([]); speak("Cleared");
                            return;
                        }

                        // Double Thumbs Up (YES)
                        if (h1.thumbUp && !h1.fingers[0] && h2.thumbUp && !h2.fingers[0]) {
                            setCurrentGesture("YES 👍👍");
                            updateProgress("YES");
                            return;
                        }

                        // Double Palms Out (HELP)
                        if (h1.fingers.every(f => f) && h2.fingers.every(f => f)) {
                            setCurrentGesture("HELP ✋✋");
                            updateProgress("HELP");
                            return;
                        }
                    }

                    // Single Hand
                    const handData = analyzeHand(predictions[0].landmarks);
                    const gesture = recognize(handData, tab === 'bridge' ? 'letters' : 'tutorial');

                    if (gesture) {
                        if (gesture === gestureRef.current.last) {
                            const duration = Date.now() - gestureRef.current.start;
                            const p = Math.min((duration / 1000) * 100, 100);
                            setProgress(p);

                            if (duration > 1000) {
                                handleConfirm(gesture);
                                gestureRef.current.start = Date.now();
                                setProgress(0);
                            }
                        } else {
                            gestureRef.current = { start: Date.now(), last: gesture };
                            setProgress(0);
                        }
                        setCurrentGesture(gesture);
                    } else {
                        setCurrentGesture(null); setProgress(0); gestureRef.current.last = null;
                    }
                }
            }
            animationFrameRef.current = requestAnimationFrame(loop);
        };
        loop();
    }, [model, loading, tab, levelIndex, targetIndex]);

    const updateProgress = (gesture) => {
        if (gesture === gestureRef.current.last) {
            const duration = Date.now() - gestureRef.current.start;
            setProgress(Math.min((duration / 1000) * 100, 100));
            if (duration > 1000) {
                handleConfirm(gesture);
                gestureRef.current.start = Date.now();
                setProgress(0);
            }
        } else {
            gestureRef.current = { start: Date.now(), last: gesture };
            setProgress(0);
        }
    };

    const handleConfirm = (gesture) => {
        if (tab === 'bridge') {
            setSentence(prev => [...prev, gesture]);
            speak(gesture);
        } else {
            const target = getTarget().id;
            if (gesture === target) {
                setSuccessFeedback(true);
                speak("Success!");
                setTimeout(() => {
                    setSuccessFeedback(false);
                    advanceTutorial();
                }, 800);
            }
        }
    };

    const getTarget = () => {
        const level = TUTORIAL_LEVELS[levelIndex];
        if (level.type === 'sequence') {
            const item = level.data[targetIndex % level.data.length];
            return { id: item.letter, emoji: item.emoji };
        }
        if (level.type === 'random_letters') {
            const charCode = 65 + (targetIndex % 26);
            const letter = String.fromCharCode(charCode);
            const emoji = ASL_ALPHABET.find(a => a.letter === letter)?.emoji || "❓";
            return { id: letter, emoji };
        }
        const word = level.data[targetIndex % level.data.length];
        return { id: word, emoji: "📝" };
    };

    const advanceTutorial = () => {
        setTargetIndex(prev => prev + 1);
        if (targetIndex >= 4) {
            setLevelIndex(prev => Math.min(prev + 1, TUTORIAL_LEVELS.length - 1));
            setTargetIndex(0);
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 md:p-8 animate-fade-in pb-24 relative">
            <AslReferenceDrawer isOpen={isGuideOpen} onClose={() => setGuideOpen(false)} />

            <div className="flex justify-between w-full items-center mb-8">
                <h2 className="text-3xl font-extrabold text-amber-400 flex items-center gap-3"><i data-lucide="hand"></i> {tab === 'bridge' ? 'ASL Bridge' : 'ASL Academy'}</h2>
                <div className="flex gap-4">
                    <Button onClick={() => setGuideOpen(true)} variant="warning" iconName="book-open">Open Guide</Button>
                    <Button onClick={onBack} variant="secondary" iconName="arrow-left">Exit</Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-5 gap-8 w-full">
                <div className="lg:col-span-3 space-y-6">
                    <div className="flex bg-slate-800/50 p-1.5 rounded-2xl glass">
                        <button onClick={() => setTab('bridge')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${tab === 'bridge' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400'}`}>Real-time Bridge</button>
                        <button onClick={() => setTab('learn')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${tab === 'learn' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400'}`}>Learning Mode</button>
                    </div>

                    <div className="video-container relative border-amber-500/20 shadow-2xl">
                        {loading && <div className="absolute inset-0 z-20 bg-slate-950/90"><Loader text="Initializing neural engine..." /></div>}
                        {successFeedback && <div className="success-swipe"></div>}

                        {tab === 'learn' && (
                            <div className="learning-target flex flex-col items-center gap-2">
                                <span className="text-8xl">{getTarget().id}</span>
                                <span className="text-4xl opacity-80">{getTarget().emoji}</span>
                            </div>
                        )}

                        <video ref={videoRef} autoPlay playsInline muted width="640" height="480" />
                        <canvas ref={canvasRef} width="640" height="480" />

                        {currentGesture && (
                            <div className="absolute top-6 right-6 glass px-6 py-4 rounded-3xl border border-amber-500/50 flex flex-col items-center min-w-[120px] shadow-xl animate-scale-in">
                                <span className="text-5xl font-black text-amber-400 tracking-tighter">{currentGesture}</span>
                                <div className="w-full h-2 bg-slate-700/50 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 transition-all duration-100" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {tab === 'bridge' ? (
                        <div className="glass p-6 rounded-3xl space-y-4 shadow-xl">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Message</h3>
                            <div className="min-h-[150px] bg-slate-950/50 rounded-2xl p-4 flex flex-wrap gap-2 content-start border border-slate-800">
                                {sentence.length === 0 && <span className="text-slate-700 italic">Sign letters to build a message...</span>}
                                {sentence.map((w, i) => <span key={i} className="bg-amber-500/10 text-amber-400 px-4 py-1.5 rounded-xl border border-amber-500/20 text-xl font-bold animate-fade-in">{w}</span>)}
                            </div>
                            <Button onClick={() => speak(sentence.join(""))} variant="success" iconName="volume-2" className="w-full py-4 text-lg">Speak Message</Button>
                        </div>
                    ) : (
                        <div className="glass p-6 rounded-3xl space-y-6 shadow-xl">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Level Progress</h3>
                            <div className="tutorial-stepper">
                                {TUTORIAL_LEVELS.map((L, i) => (
                                    <div key={i} className={`step-dot ${i === levelIndex ? 'active' : i < levelIndex ? 'completed' : ''}`} />
                                ))}
                            </div>
                            <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
                                <h4 className="text-xl font-bold text-white mb-2">{TUTORIAL_LEVELS[levelIndex].title}</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">{TUTORIAL_LEVELS[levelIndex].description}</p>
                            </div>
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center space-y-4">
                                <div className="flex items-center justify-center gap-4">
                                    <span className="text-4xl text-white font-black">{getTarget().id}</span>
                                    <span className="text-4xl">{getTarget().emoji}</span>
                                </div>
                                <p className="text-slate-500 text-xs italic font-medium">Hold index fingerprint pattern for 1s</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- App Entry ---

const App = () => {
    const [mode, setMode] = useState('home');
    useEffect(() => { if (window.lucide) window.lucide.createIcons(); }, [mode]);

    if (mode === 'shadow') return <ShadowNet onBack={() => setMode('home')} />;
    if (mode === 'asl') return <AslBridge onBack={() => setMode('home')} />;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full"></div>
            <header className="mb-16 text-center z-10 animate-slide-up">
                <div className="inline-block px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-black uppercase tracking-[0.2em] mb-6 shadow-sm">Advanced Accessibility</div>
                <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-6 leading-none">Vision<span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">Assist</span></h1>
                <p className="text-slate-400 max-w-lg mx-auto text-lg font-medium leading-relaxed">Neural accessibility bridge for the deaf and visually impaired.</p>
            </header>
            <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl z-10">
                <div className="group glass p-10 rounded-[3rem] border-slate-800 hover:border-cyan-500/50 transition-all duration-500 animate-slide-up [animation-delay:100ms] hover:shadow-cyan-500/10">
                    <div className="w-20 h-20 bg-cyan-500/10 rounded-3xl flex items-center justify-center mb-8 text-cyan-400 group-hover:scale-110 transition-transform"><i data-lucide="eye" className="w-10 h-10"></i></div>
                    <h2 className="text-3xl font-black text-white mb-4">Shadow Net</h2>
                    <p className="text-slate-400 mb-8 font-medium">AI eyes for environmental awareness and real-time guidance.</p>
                    <Button onClick={() => setMode('shadow')} variant="accent" className="w-full py-4 rounded-[2rem]">Launch Scanner</Button>
                </div>
                <div className="group glass p-10 rounded-[3rem] border-slate-800 hover:border-amber-500/50 transition-all duration-500 animate-slide-up [animation-delay:200ms] hover:shadow-amber-500/10">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-8 text-amber-400 group-hover:scale-110 transition-transform"><i data-lucide="hand" className="w-10 h-10"></i></div>
                    <h2 className="text-3xl font-black text-white mb-4">ASL Bridge</h2>
                    <p className="text-slate-400 mb-8 font-medium">Gesture academy and real-time sign language synthesis.</p>
                    <Button onClick={() => setMode('asl')} variant="warning" className="w-full py-4 rounded-[2rem]">Enter Academy</Button>
                </div>
            </div>
            <footer className="mt-20 text-slate-600 text-sm font-bold uppercase tracking-widest z-10">&copy; 2026 VisionAssist AI • Version 2.0 Project Reorganization</footer>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
