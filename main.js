const { useState, useEffect, useRef, useCallback } = React;

// --- Utility Components ---

const Button = ({ onClick, children, className = "", variant = "primary", iconName }) => {
    const btnRef = useRef(null);

    useEffect(() => {
        if (window.lucide && iconName && btnRef.current) {
            window.lucide.createIcons({
                root: btnRef.current,
                nameAttr: 'data-lucide'
            });
        }
    });

    const baseStyle = "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 transform hover:scale-105 active:scale-95";
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/20",
        secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700",
        danger: "bg-red-500 hover:bg-red-400 text-white shadow-xl shadow-red-500/20",
        accent: "bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-xl shadow-cyan-500/20",
        success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-500/20"
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

// --- Shadow Net Component (Object Detection) ---

const ShadowNet = ({ onBack }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastSpoken, setLastSpoken] = useState("");
    const [detections, setDetections] = useState([]);
    const lastSpeakTime = useRef(0);

    const speak = (text) => {
        const now = Date.now();
        if (now - lastSpeakTime.current < 3000) return;

        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1;
            window.speechSynthesis.speak(utterance);
            setLastSpoken(text);
            lastSpeakTime.current = now;
        }
    };

    useEffect(() => {
        const setupCamera = async () => {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
                        audio: false,
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        return new Promise((resolve) => {
                            videoRef.current.onloadedmetadata = () => resolve(videoRef.current);
                        });
                    }
                } catch (e) {
                    alert("Camera access denied. This feature requires camera permissions.");
                }
            }
        };

        const loadModel = async () => {
            try {
                await setupCamera();
                const loadedModel = await cocoSsd.load();
                setModel(loadedModel);
                setLoading(false);
                speak("Shadow Net activated. I am now your eyes.");
            } catch (err) {
                console.error("Failed to load Shadow Net:", err);
            }
        };

        loadModel();

        return () => {
            window.speechSynthesis.cancel();
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (!model || loading) return;

        let animationId;
        const detectFrame = async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
                const predictions = await model.detect(videoRef.current);
                setDetections(predictions);

                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

                let prominentObject = null;
                let maxArea = 0;

                predictions.forEach(prediction => {
                    const [x, y, width, height] = prediction.bbox;
                    const area = width * height;

                    // Draw stylized bounding box
                    ctx.strokeStyle = '#22d3ee';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(x, y, width, height);
                    ctx.setLineDash([]);

                    // Corners
                    ctx.fillStyle = '#22d3ee';
                    const cornerSize = 15;
                    ctx.fillRect(x, y, cornerSize, 4);
                    ctx.fillRect(x, y, 4, cornerSize);
                    ctx.fillRect(x + width - cornerSize, y, cornerSize, 4);
                    ctx.fillRect(x + width - 4, y, 4, cornerSize);
                    ctx.fillRect(x, y + height - 4, cornerSize, 4);
                    ctx.fillRect(x, y + height - cornerSize, 4, cornerSize);
                    ctx.fillRect(x + width - cornerSize, y + height - 4, cornerSize, 4);
                    ctx.fillRect(x + width - 4, y + height - cornerSize, 4, cornerSize);

                    // Label
                    ctx.font = 'bold 14px Inter';
                    const label = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
                    const textWidth = ctx.measureText(label).width;
                    ctx.fillStyle = 'rgba(34, 211, 238, 0.9)';
                    ctx.fillRect(x, y - 25, textWidth + 20, 25);
                    ctx.fillStyle = '#000';
                    ctx.fillText(label, x + 10, y - 8);

                    if (area > maxArea) {
                        maxArea = area;
                        prominentObject = prediction;
                    }
                });

                if (prominentObject) {
                    const { class: className, bbox } = prominentObject;
                    const area = bbox[2] * bbox[3];
                    const screenArea = 640 * 480;
                    const ratio = area / screenArea;

                    let distanceMsg = "";
                    if (ratio > 0.5) distanceMsg = "very close";
                    else if (ratio > 0.2) distanceMsg = "nearby";
                    else distanceMsg = "in the distance";

                    speak(`${className} detected ${distanceMsg}`);
                }
            }
            animationId = requestAnimationFrame(detectFrame);
        };

        detectFrame();
        return () => cancelAnimationFrame(animationId);
    }, [model, loading]);

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">
            <div className="flex justify-between w-full items-center mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-cyan-400 flex items-center gap-3">
                        <i data-lucide="eye" className="w-8 h-8"></i> Shadow Net
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Real-time Environmental Awareness</p>
                </div>
                <Button onClick={onBack} variant="secondary" className="px-4 py-2 text-sm" iconName="arrow-left">Exit</Button>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 w-full">
                <div className="lg:col-span-2">
                    <div className="video-container group">
                        {loading && <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-sm"><Loader text="Syncing Neural Pathways..." /></div>}
                        <div className="scan-line"></div>
                        <video ref={videoRef} autoPlay playsInline muted width="640" height="480" />
                        <canvas ref={canvasRef} width="640" height="480" />
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="glass p-6 rounded-2xl border border-cyan-500/20">
                        <h3 className="text-cyan-400 font-bold uppercase tracking-widest text-xs mb-4">Latest Insight</h3>
                        <div className="text-2xl font-medium text-white min-h-[3em] flex items-center">
                            {lastSpoken ? (
                                <span className="animate-pulse">{lastSpoken}</span>
                            ) : (
                                <span className="text-slate-600 italic">Analyzing surroundings...</span>
                            )}
                        </div>
                    </div>

                    <div className="glass p-6 rounded-2xl border border-slate-700">
                        <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4">Detected Objects</h3>
                        <div className="flex flex-wrap gap-2">
                            {detections.length === 0 && <p className="text-slate-600 text-sm">No objects identified yet.</p>}
                            {Array.from(new Set(detections.map(d => d.class))).map(obj => (
                                <span key={obj} className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full text-sm font-medium">
                                    {obj}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- ASL Bridge Component (Gesture Recognition) ---

const AslBridge = ({ onBack }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recognitionMode, setRecognitionMode] = useState('letters');

    const [currentGesture, setCurrentGesture] = useState(null);
    const [sentence, setSentence] = useState([]);
    const [progress, setProgress] = useState(0);
    const [typedText, setTypedText] = useState("");

    const gestureStartTimeRef = useRef(0);
    const lastGestureRef = useRef(null);
    const animationFrameRef = useRef(null);

    const speak = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            window.speechSynthesis.speak(utterance);
        }
    };

    const analyzeHand = (landmarks) => {
        const isExtended = (tipIdx, pipIdx) => landmarks[tipIdx][1] < landmarks[pipIdx][1];
        const fingers = [
            isExtended(8, 6),
            isExtended(12, 10),
            isExtended(16, 14),
            isExtended(20, 18)
        ];

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

        if (mode === 'letters') {
            if (!index && !middle && !ring && !pinky) {
                if (thumbUp) return "A";
                return "S";
            }
            if (index && !middle && !ring && !pinky) {
                if (thumbOut) return "L";
                if (pinches[1]) return "D";
                return "Z";
            }
            if (!index && !middle && !ring && pinky) {
                if (thumbOut) return "Y";
                return "I";
            }
            if (index && middle && !ring && !pinky) {
                if (crossed) return "R";
                if (indexMiddleDistance > 50) return "V";
                return "U";
            }
            if (index && middle && ring && !pinky) return "W";
            if (pinches[0] && middle && ring && pinky) return "F";
            if (index && middle && ring && pinky) return "B";
            if (index && pinky && !middle && !ring && thumbOut) return "🤟";
        }

        return null;
    };

    useEffect(() => {
        const setupCamera = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 },
                audio: false,
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                return new Promise((resolve) => videoRef.current.onloadedmetadata = () => resolve(videoRef.current));
            }
        };

        const init = async () => {
            try {
                await setupCamera();
                const loadedModel = await handpose.load();
                setModel(loadedModel);
                setLoading(false);
            } catch (err) {
                console.error("Handpose load failed:", err);
            }
        };

        init();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    useEffect(() => {
        if (!model || loading) return;

        const loop = async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
                const predictions = await model.estimateHands(videoRef.current);
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

                if (predictions.length > 0) {
                    const landmarks = predictions[0].landmarks;

                    // Draw stylized skeleton
                    ctx.lineJoin = "round";
                    ctx.lineCap = "round";

                    const drawPath = (indices, color) => {
                        ctx.beginPath();
                        ctx.moveTo(landmarks[indices[0]][0], landmarks[indices[0]][1]);
                        for (let i = 1; i < indices.length; i++) {
                            ctx.lineTo(landmarks[indices[i]][0], landmarks[indices[i]][1]);
                        }
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 4;
                        ctx.stroke();
                    };

                    drawPath([0, 1, 2, 3, 4], "#fbbf24"); // Thumb
                    drawPath([0, 5, 6, 7, 8], "#fbbf24"); // Index
                    drawPath([0, 9, 10, 11, 12], "#fbbf24"); // Mid
                    drawPath([0, 13, 14, 15, 16], "#fbbf24"); // Ring
                    drawPath([0, 17, 18, 19, 20], "#fbbf24"); // Pinky

                    landmarks.forEach(point => {
                        ctx.beginPath();
                        ctx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
                        ctx.fillStyle = "#fff";
                        ctx.fill();
                    });

                    const handData = analyzeHand(landmarks);
                    const gestureResult = recognize(handData, recognitionMode);

                    if (gestureResult) {
                        if (gestureResult === lastGestureRef.current) {
                            const duration = Date.now() - gestureStartTimeRef.current;
                            const percentage = Math.min((duration / 1200) * 100, 100);
                            setProgress(percentage);

                            if (duration > 1200) {
                                setSentence(prev => [...prev, gestureResult]);
                                speak(gestureResult);
                                gestureStartTimeRef.current = Date.now();
                                setProgress(0);
                            }
                        } else {
                            lastGestureRef.current = gestureResult;
                            gestureStartTimeRef.current = Date.now();
                            setProgress(0);
                        }
                        setCurrentGesture(gestureResult);
                    } else {
                        setCurrentGesture(null);
                        setProgress(0);
                        lastGestureRef.current = null;
                    }
                }
            }
            animationFrameRef.current = requestAnimationFrame(loop);
        };

        loop();
    }, [model, loading, recognitionMode]);

    const quickPhrases = ["Hello", "Please", "Thank you", "Help me", "I'm okay", "Nice to meet you"];

    return (
        <div className="flex flex-col items-center w-full max-w-5xl mx-auto p-4 md:p-8 animate-fade-in pb-24">
            <div className="flex justify-between w-full items-center mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-amber-400 flex items-center gap-3">
                        <i data-lucide="hand" className="w-8 h-8"></i> ASL Bridge
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Bridging silence with technology</p>
                </div>
                <Button onClick={onBack} variant="secondary" className="px-4 py-2 text-sm" iconName="arrow-left">Exit</Button>
            </div>

            <div className="grid lg:grid-cols-5 gap-8 w-full">
                {/* Camera/Input Column */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="flex bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700 glass">
                        <button
                            onClick={() => setRecognitionMode('letters')}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${recognitionMode === 'letters' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            ABC Letters
                        </button>
                        <button
                            onClick={() => setRecognitionMode('numbers')}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${recognitionMode === 'numbers' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            123 Numbers
                        </button>
                    </div>

                    <div className="video-container border-amber-500/20 group">
                        {loading && <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-sm"><Loader text="Initializing Hand Tracking..." /></div>}
                        <video ref={videoRef} autoPlay playsInline muted width="640" height="480" />
                        <canvas ref={canvasRef} width="640" height="480" />

                        {currentGesture && (
                            <div className="absolute top-6 right-6 glass px-6 py-4 rounded-3xl border border-amber-500/50 flex flex-col items-center min-w-[100px] animate-scale-in">
                                <span className="text-5xl font-black text-amber-400 tracking-tighter">{currentGesture}</span>
                                <div className="w-full h-1.5 bg-slate-700/50 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 transition-all duration-100" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Interaction Column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass p-6 rounded-3xl space-y-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Message Builder</h3>
                        <div className="min-h-[120px] bg-slate-950/50 rounded-2xl p-4 flex flex-wrap gap-2 content-start border border-slate-800">
                            {sentence.length === 0 && <span className="text-slate-700 italic">Held gestures will appear here...</span>}
                            {sentence.map((word, idx) => (
                                <span key={idx} className="bg-amber-500/10 text-amber-400 px-4 py-1.5 rounded-xl border border-amber-500/20 text-xl font-bold">
                                    {word}
                                </span>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Button onClick={() => speak(sentence.join(" "))} variant="success" iconName="volume-2" className="py-4">Speak</Button>
                            <Button onClick={() => setSentence([])} variant="danger" iconName="trash-2" className="py-4">Clear</Button>
                        </div>
                    </div>

                    <div className="glass p-6 rounded-3xl">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Quick Phrases</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {quickPhrases.map(phrase => (
                                <button
                                    key={phrase}
                                    onClick={() => speak(phrase)}
                                    className="p-3 text-xs font-bold bg-slate-800/50 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300 hover:text-white transition-colors text-left"
                                >
                                    {phrase}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="glass p-6 rounded-3xl">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Speech Input</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={typedText}
                                onChange={(e) => setTypedText(e.target.value)}
                                placeholder="Type to speak..."
                                className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                            />
                            <button
                                onClick={() => { speak(typedText); setTypedText(""); }}
                                className="w-12 h-10 bg-amber-500 text-slate-900 rounded-xl flex items-center justify-center hover:bg-amber-400 transition-colors"
                            >
                                <i data-lucide="send" className="w-5 h-5"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---

const App = () => {
    const [mode, setMode] = useState('home');

    useEffect(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, [mode]);

    if (mode === 'shadow') return <ShadowNet onBack={() => setMode('home')} />;
    if (mode === 'asl') return <AslBridge onBack={() => setMode('home')} />;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full"></div>

            <header className="mb-16 text-center z-10 animate-slide-up">
                <div className="inline-block px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-black uppercase tracking-[0.2em] mb-6">
                    Next-Gen Accessibility
                </div>
                <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter mb-6 leading-none">
                    Vision<span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">Assist</span>
                </h1>
                <p className="text-slate-400 max-w-lg mx-auto text-lg font-medium leading-relaxed">
                    Empowering the future through browser-based neural networks.
                </p>
            </header>

            <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl z-10">
                {/* Shadow Net Card */}
                <div className="group glass p-10 rounded-[3rem] border-slate-800 hover:border-cyan-500/50 transition-all duration-500 hover:shadow-[0_0_80px_-15px_rgba(34,211,238,0.3)] animate-slide-up [animation-delay:100ms]">
                    <div className="w-20 h-20 bg-cyan-500/10 rounded-3xl flex items-center justify-center mb-8 text-cyan-400 group-hover:scale-110 transition-transform duration-500 rotate-3">
                        <i data-lucide="eye" className="w-10 h-10"></i>
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4">Shadow Net</h2>
                    <p className="text-slate-400 mb-8 leading-relaxed font-medium">
                        "Eyes for the blind." A real-time environmental scanner that describes surroundings and detects potential obstacles.
                    </p>
                    <Button onClick={() => setMode('shadow')} variant="accent" className="w-full py-4 rounded-2xl">
                        Launch Scanner
                    </Button>
                </div>

                {/* ASL Bridge Card */}
                <div className="group glass p-10 rounded-[3rem] border-slate-800 hover:border-amber-500/50 transition-all duration-500 hover:shadow-[0_0_80px_-15px_rgba(251,191,36,0.2)] animate-slide-up [animation-delay:200ms]">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-8 text-amber-400 group-hover:scale-110 transition-transform duration-500 -rotate-3">
                        <i data-lucide="hand" className="w-10 h-10"></i>
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4">ASL Bridge</h2>
                    <p className="text-slate-400 mb-8 leading-relaxed font-medium">
                        "Voice for the mute." An intelligent gesture translator that converts ASL signs into spoken words and text.
                    </p>
                    <Button onClick={() => setMode('asl')} variant="primary" className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-900 border-none">
                        Start Translator
                    </Button>
                </div>
            </div>

            <footer className="mt-20 text-slate-600 text-sm font-bold uppercase tracking-widest z-10">
                &copy; 2026 VisionAssist AI • Powered by ShadowNet Architecture
            </footer>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
