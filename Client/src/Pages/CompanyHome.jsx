import { useState, useEffect, useRef, useMemo } from "react";
import { MoveRight, Youtube } from "lucide-react";

const FEATURES = [
  {
    icon: "🤖",
    title: "AI-Powered Interviews",
    desc: "Our conversational AI conducts structured interviews 24/7, evaluating candidates on skills, communication, and cultural fit.",
  },
  {
    icon: "📊",
    title: "Smart Analytics",
    desc: "Deep insights on every candidate with sentiment analysis, skill scoring, and comparative benchmarks across your pipeline.",
  },
  {
    icon: "⚡",
    title: "10x Faster Hiring",
    desc: "Screen hundreds of candidates simultaneously — no scheduling conflicts, no waiting, just ranked results in real time.",
  },
  {
    icon: "🌍",
    title: "Global & Multilingual",
    desc: "Hire across borders with support for 30+ languages and region-specific interview formats built in.",
  },
  {
    icon: "🔒",
    title: "Bias-Free Process",
    desc: "Structured interviews with consistent scoring ensure fair, equitable evaluation for every single candidate.",
  },
  {
    icon: "🔗",
    title: "ATS Integrations",
    desc: "Seamlessly connect with your existing HR stack — Workday, Greenhouse, Lever, and more out of the box.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Create Your Job",
    desc: "Define the role, required skills, and interview parameters. Our AI builds the perfect question set automatically.",
    color: "from-blue-50 to-indigo-50",
    accent: "#4F6EF7",
  },
  {
    num: "02",
    title: "Invite Candidates",
    desc: "Share a link or integrate with your ATS. Candidates complete AI interviews at their convenience — any time, anywhere.",
    color: "from-violet-50 to-purple-50",
    accent: "#7C3AED",
  },
  {
    num: "03",
    title: "Review & Decide",
    desc: "Get ranked shortlists with video recordings, transcripts, and AI scores. Make confident hiring decisions fast.",
    color: "from-emerald-50 to-teal-50",
    accent: "#059669",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    desc: "Perfect for small teams and startups beginning their AI hiring journey.",
    features: [
      "10 interviews/month",
      "Basic AI scoring",
      "Email support",
      "1 job posting",
      "Video recordings",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$149",
    period: "/mo",
    desc: "For scaling teams that need more power and deeper insights.",
    features: [
      "100 interviews/month",
      "Advanced AI analytics",
      "Priority support",
      "Unlimited job postings",
      "ATS integrations",
      "Custom branding",
      "Team collaboration",
    ],
    cta: "Get Started",
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "Full-scale hiring automation for large organizations.",
    features: [
      "Unlimited interviews",
      "Custom AI models",
      "Dedicated CSM",
      "SSO & SAML",
      "SLA guarantee",
      "White-label option",
      "API access",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "How does the AI interview process work?",
    a: "Candidates receive a link to join an AI-moderated interview. The AI asks role-specific questions, listens to responses, follows up intelligently, and evaluates answers in real-time using NLP and ML models trained on millions of successful hires.",
  },
  {
    q: "Can candidates tell they're talking to AI?",
    a: "Yes — we believe in transparency. Candidates are informed they're interacting with an AI system. This actually reduces interview anxiety and produces more authentic responses.",
  },
  {
    q: "How accurate is AI candidate scoring?",
    a: "Our scoring models achieve 89% correlation with human expert evaluations, with continuous improvement through feedback loops and regular model updates.",
  },
  {
    q: "Is candidate data safe and compliant?",
    a: "Absolutely. We're SOC 2 Type II certified, GDPR compliant, and follow EEOC guidelines. All data is encrypted at rest and in transit, with configurable data retention policies.",
  },
  {
    q: "Can I customize the interview questions?",
    a: "Yes. You can use our AI-generated question sets, customize them, or build entirely from scratch. You can also create question banks for different roles and departments.",
  },
];

const LOGOS = [
  "Stripe",
  "Notion",
  "Figma",
  "Airbnb",
  "Shopify",
  "Atlassian",
  "HubSpot",
  "Zoom",
];

// ── Shared hooks & primitives ────────────────────────────────────────────────

function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.12 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

function AnimatedSection({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(30px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Hero sub-components ──────────────────────────────────────────────────────

function FloatingOrb({ style, delay = 0 }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        animation: `floatOrb 6s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        ...style,
      }}
    />
  );
}

function Counter({ target, suffix = "" }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const isDecimal = target % 1 !== 0;
    const steps = 60;
    const increment = target / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const current = Math.min(target, increment * step);
      setCount(
        isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current),
      );
      if (step >= steps) clearInterval(timer);
    }, 1800 / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

function TypingText({ text, delay = 0 }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, 28);
    return () => clearInterval(timer);
  }, [started, text]);

  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse">|</span>}
    </span>
  );
}

function Particle({ style }) {
  return (
    <div
      className="absolute rounded-full bg-indigo-400 pointer-events-none"
      style={style}
    />
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const sectionRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        style: {
          width: `${2 + Math.random() * 4}px`,
          height: `${2 + Math.random() * 4}px`,
          left: `${5 + Math.random() * 90}%`,
          top: `${5 + Math.random() * 90}%`,
          opacity: 0.15 + Math.random() * 0.25,
          animation: `particleDrift ${8 + Math.random() * 8}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 6}s`,
        },
      })),
    [],
  );

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-16"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-200 h-200 rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, #4F6EF7 0%, transparent 65%)",
            transform: `translate(${30 + mousePos.x * 0.4}%, ${-30 + mousePos.y * 0.4}%)`,
            transition: "transform 0.15s ease-out",
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-150 h-150 rounded-full opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, #7C3AED 0%, transparent 65%)",
            transform: `translate(${-30 + mousePos.x * -0.3}%, ${30 + mousePos.y * -0.3}%)`,
            transition: "transform 0.15s ease-out",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-100 h-100 rounded-full opacity-[0.04]"
          style={{
            background: "radial-gradient(circle, #06B6D4 0%, transparent 70%)",
            transform: `translate(${-50 + mousePos.x * 0.2}%, ${-50 + mousePos.y * 0.2}%)`,
            transition: "transform 0.2s ease-out",
          }}
        />

        <FloatingOrb
          delay={0}
          style={{
            width: 12,
            height: 12,
            top: "18%",
            left: "8%",
            background: "linear-gradient(135deg, #4F6EF7, #7C3AED)",
            opacity: 0.35,
            filter: "blur(1px)",
          }}
        />
        <FloatingOrb
          delay={1.5}
          style={{
            width: 8,
            height: 8,
            top: "65%",
            left: "5%",
            background: "#06B6D4",
            opacity: 0.3,
            filter: "blur(1px)",
          }}
        />
        <FloatingOrb
          delay={0.8}
          style={{
            width: 16,
            height: 16,
            top: "25%",
            right: "7%",
            background: "linear-gradient(135deg, #7C3AED, #EC4899)",
            opacity: 0.25,
            filter: "blur(2px)",
          }}
        />
        <FloatingOrb
          delay={2}
          style={{
            width: 10,
            height: 10,
            top: "75%",
            right: "10%",
            background: "#4F6EF7",
            opacity: 0.3,
            filter: "blur(1px)",
          }}
        />
        <FloatingOrb
          delay={3}
          style={{
            width: 6,
            height: 6,
            top: "45%",
            left: "12%",
            background: "#059669",
            opacity: 0.4,
          }}
        />
        <FloatingOrb
          delay={1}
          style={{
            width: 20,
            height: 20,
            bottom: "20%",
            left: "22%",
            background: "linear-gradient(135deg, #4F6EF7, #06B6D4)",
            opacity: 0.15,
            filter: "blur(3px)",
          }}
        />

        {particles.map((p) => (
          <Particle key={p.id} style={p.style} />
        ))}

        <svg
          className="absolute inset-0 w-full h-full opacity-[0.06]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="#4F6EF7"
                strokeWidth="0.8"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-6 text-center">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8"
          style={{
            background: "linear-gradient(135deg, #EEF2FF, #F5F3FF)",
            color: "#4F6EF7",
            border: "1px solid #C7D2FE",
            animation: "fadeInDown 0.7s cubic-bezier(0.16,1,0.3,1) both",
            boxShadow: "0 2px 12px rgba(79,110,247,0.12)",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <TypingText
            text="AI-Powered Hiring Platform · Trusted by 2,000+ Companies"
            delay={600}
          />
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-7xl font-black text-gray-900 leading-tight mb-6"
          style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            letterSpacing: "-2px",
          }}
        >
          <span
            className="block"
            style={{
              animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s both",
            }}
          >
            Hire Smarter,
          </span>

          <span
            className="block"
            style={{
              background:
                "linear-gradient(135deg, #4F6EF7 0%, #7C3AED 35%, #EC4899 65%, #4F6EF7 100%)",
              backgroundSize: "300% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation:
                "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.28s both, gradientShift 4s linear infinite 1.5s",
            }}
          >
            Not Harder.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{
            animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s both",
          }}
        >
          Talk2Hire automates your entire interview process with AI. Screen
          hundreds of candidates simultaneously, get deep insights, and make
          confident hiring decisions — in a fraction of the time.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          style={{
            animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.52s both",
          }}
        >
          <button
            className="group relative px-8 py-4 rounded-xl text-white font-bold text-base transition-all hover:scale-105 flex items-center gap-2 overflow-hidden hover:cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #4F6EF7, #7C3AED)",
              boxShadow: "0 8px 30px rgba(79,110,247,0.4)",
            }}
          >
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background:
                  "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
                animation: "shimmer 1.2s ease infinite",
              }}
            />
            <span className="relative z-10 flex items-center gap-2">
              Start Hiring for Free
              <span className="group-hover:translate-x-1.5 transition-transform duration-200">
                <MoveRight />
              </span>
            </span>
          </button>
          <button className="group px-8 py-4 rounded-xl text-gray-700 font-bold text-base border-2 border-gray-200 hover:border-red-300 hover:cursor-pointer transition-all flex items-center gap-2 bg-white hover:bg-red-50 hover:shadow-lg">
            <span className="w-8 h-8 rounded-full bg-gray-200 group-hover:bg-red-600 flex items-center justify-center transition-all duration-300">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 fill-gray-400 group-hover:fill-white transition-colors duration-300"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="group-hover:text-red-600 transition-colors duration-300">
              Watch Demo
            </span>
          </button>
        </div>

        {/* Stats */}
        <div
          className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mb-16"
          style={{
            animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.64s both",
          }}
        >
          {[
            { val: 10, suffix: "x", label: "Faster Screening" },
            { val: 89, suffix: "%", label: "Scoring Accuracy" },
            { val: 2, suffix: "M+", label: "Interviews Conducted" },
          ].map(({ val, suffix, label }) => (
            <div key={label} className="text-center group">
              <div
                className="text-3xl font-black mb-1 transition-transform group-hover:scale-110"
                style={{
                  background: "linear-gradient(135deg, #4F6EF7, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontFamily: "Georgia, serif",
                }}
              >
                <Counter target={val} suffix={suffix} />
              </div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Dashboard mockup */}
        <AnimatedSection delay={200}>
          <div
            className="mx-auto max-w-7xl rounded-2xl overflow-hidden"
            style={{
              boxShadow:
                "0 40px 120px rgba(79,110,247,0.18), 0 0 0 1px #E8ECFF",
              animation: "floatCard 6s ease-in-out infinite 1s",
            }}
          >
            <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-4">
                <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400 text-left max-w-xs">
                  talk2hire.com/dashboard
                </div>
              </div>
            </div>
            <div className="bg-white p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  {
                    label: "Active Jobs",
                    val: "12",
                    change: "+3",
                    color: "#4F6EF7",
                  },
                  {
                    label: "Candidates Today",
                    val: "47",
                    change: "+12",
                    color: "#7C3AED",
                  },
                  {
                    label: "Avg. Score",
                    val: "8.4",
                    change: "+0.3",
                    color: "#059669",
                  },
                ].map(({ label, val, change, color }, i) => (
                  <div
                    key={label}
                    className="bg-gray-50 rounded-xl p-4 text-left hover:shadow-md transition-shadow"
                    style={{
                      animation: `slideInCard 0.5s cubic-bezier(0.16,1,0.3,1) ${0.8 + i * 0.1}s both`,
                    }}
                  >
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div
                      className="text-2xl font-black text-gray-900"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {val}
                    </div>
                    <div
                      className="text-xs font-semibold mt-1"
                      style={{ color }}
                    >
                      {change} this week
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  {
                    name: "Sarah Chen",
                    role: "Senior Frontend Engineer",
                    score: 92,
                    status: "Shortlisted",
                  },
                  {
                    name: "Marcus Johnson",
                    role: "Product Manager",
                    score: 87,
                    status: "In Review",
                  },
                  {
                    name: "Priya Nair",
                    role: "Data Scientist",
                    score: 95,
                    status: "Shortlisted",
                  },
                  {
                    name: "Alex Rivera",
                    role: "Backend Engineer",
                    score: 79,
                    status: "Pending",
                  },
                ].map(({ name, role, score, status }, i) => (
                  <div
                    key={name}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-indigo-100 hover:shadow-sm transition-all"
                    style={{
                      animation: `slideInRow 0.45s cubic-bezier(0.16,1,0.3,1) ${1.0 + i * 0.08}s both`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{
                          background:
                            "linear-gradient(135deg, #4F6EF7, #7C3AED)",
                        }}
                      >
                        {name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {name}
                        </div>
                        <div className="text-xs text-gray-500">{role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {score}
                        </div>
                        <div className="text-xs text-gray-500">AI Score</div>
                      </div>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${score}%`,
                            background:
                              score >= 90
                                ? "#059669"
                                : score >= 80
                                  ? "#4F6EF7"
                                  : "#F59E0B",
                            animation: `growBar 0.8s ease ${1.2 + i * 0.08}s both`,
                          }}
                        />
                      </div>
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          background:
                            status === "Shortlisted"
                              ? "#DCFCE7"
                              : status === "In Review"
                                ? "#EEF2FF"
                                : "#FEF9C3",
                          color:
                            status === "Shortlisted"
                              ? "#16A34A"
                              : status === "In Review"
                                ? "#4F6EF7"
                                : "#B45309",
                        }}
                      >
                        {status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>

      <style>{`
        @keyframes fadeInUp    { from { opacity:0; transform:translateY(28px); }  to { opacity:1; transform:translateY(0); } }
        @keyframes fadeInDown  { from { opacity:0; transform:translateY(-18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes floatOrb    { 0%,100% { transform:translateY(0) scale(1); }    50% { transform:translateY(-18px) scale(1.08); } }
        @keyframes floatCard   { 0%,100% { transform:translateY(0); }             50% { transform:translateY(-6px); } }
        @keyframes particleDrift {
          0%,100% { transform:translate(0,0) scale(1);      opacity:0.2;  }
          33%     { transform:translate(12px,-16px) scale(1.3); opacity:0.35; }
          66%     { transform:translate(-8px,10px) scale(0.8);  opacity:0.15; }
        }
        /* FIX 5: linear + 300% 100% backgroundSize = smooth continuous sweep */
        @keyframes gradientShift { 0% { background-position:0% 50%; } 100% { background-position:100% 50%; } }
        @keyframes shimmer       { 0% { transform:translateX(-100%); } 100% { transform:translateX(200%); } }
        @keyframes slideInCard   { from { opacity:0; transform:translateY(16px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes slideInRow    { from { opacity:0; transform:translateX(-12px); }            to { opacity:1; transform:translateX(0); } }
        @keyframes growBar       { from { width:0%; } }
      `}</style>
    </section>
  );
}

// ── Remaining sections ───────────────────────────────────────────────────────

function LogoStrip() {
  return (
    <section className="py-12 bg-gray-50 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-sm text-gray-400 font-medium uppercase tracking-widest mb-8">
          Trusted by teams at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {LOGOS.map((logo) => (
            <span
              key={logo}
              className="text-lg font-bold text-gray-300 hover:text-gray-500 transition-colors cursor-default"
            >
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-20">
            <span className="text-sm font-bold uppercase tracking-widest text-indigo-500 mb-3 block">
              How It Works
            </span>
            <h2
              className="text-4xl md:text-5xl font-black text-gray-900 mb-4"
              style={{ fontFamily: "Georgia, serif", letterSpacing: "-1.5px" }}
            >
              Three steps to your
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #4F6EF7, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                perfect hire
              </span>
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              From job creation to candidate shortlist in minutes — not weeks.
            </p>
          </div>
        </AnimatedSection>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map(({ num, title, desc, color, accent }, i) => (
            <AnimatedSection key={num} delay={i * 150}>
              <div
                className={`relative p-8 rounded-2xl bg-linear-to-br ${color} border border-white hover:scale-105 transition-transform duration-300`}
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
              >
                <div
                  className="text-6xl font-black mb-4 leading-none"
                  style={{
                    color: accent,
                    opacity: 0.15,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  {num}
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-4 -mt-8"
                  style={{ background: accent }}
                >
                  {num}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {title}
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">{desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-20">
            <span className="text-sm font-bold uppercase tracking-widest text-indigo-500 mb-3 block">
              Features
            </span>
            <h2
              className="text-4xl md:text-5xl font-black text-gray-900 mb-4"
              style={{ fontFamily: "Georgia, serif", letterSpacing: "-1.5px" }}
            >
              Everything you need to
              <br />
              hire with confidence
            </h2>
          </div>
        </AnimatedSection>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon, title, desc }, i) => (
            <AnimatedSection key={title} delay={i * 80}>
              <div className="bg-white p-7 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all duration-300 group">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform"
                  style={{
                    background: "linear-gradient(135deg, #EEF2FF, #F5F3FF)",
                  }}
                >
                  {icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(false);
  return (
    <section id="pricing" className="py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-16">
            <span className="text-sm font-bold uppercase tracking-widest text-indigo-500 mb-3 block">
              Pricing
            </span>
            <h2
              className="text-4xl md:text-5xl font-black text-gray-900 mb-4"
              style={{ fontFamily: "Georgia, serif", letterSpacing: "-1.5px" }}
            >
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-gray-500 mb-8">
              No hidden fees. Cancel anytime.
            </p>
            <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${!annual ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${annual ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                Annual{" "}
                <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </AnimatedSection>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map(
            (
              { name, price, period, desc, features, cta, highlight, badge },
              i,
            ) => (
              <AnimatedSection key={name} delay={i * 120}>
                <div
                  className={`relative rounded-2xl p-8 transition-all duration-300 hover:scale-105 ${highlight ? "text-white" : "bg-white border border-gray-200 hover:border-indigo-200 hover:shadow-xl"}`}
                  style={
                    highlight
                      ? {
                          background:
                            "linear-gradient(135deg, #4F6EF7, #7C3AED)",
                          boxShadow: "0 20px 60px rgba(79,110,247,0.4)",
                        }
                      : {}
                  }
                >
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-linear-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                        {badge}
                      </span>
                    </div>
                  )}
                  <div
                    className={`text-sm font-bold uppercase tracking-widest mb-2 ${highlight ? "text-indigo-200" : "text-indigo-500"}`}
                  >
                    {name}
                  </div>
                  <div className="flex items-end gap-1 mb-2">
                    <span
                      className={`text-4xl font-black ${highlight ? "text-white" : "text-gray-900"}`}
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {price === "Custom"
                        ? "Custom"
                        : annual
                          ? `$${Math.round(parseInt(price.replace("$", "")) * 0.8)}`
                          : price}
                    </span>
                    {period && (
                      <span
                        className={`text-sm mb-1 ${highlight ? "text-indigo-200" : "text-gray-500"}`}
                      >
                        {period}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm mb-6 leading-relaxed ${highlight ? "text-indigo-100" : "text-gray-500"}`}
                  >
                    {desc}
                  </p>
                  <button
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all mb-8 ${highlight ? "bg-white text-indigo-600 hover:bg-indigo-50" : "text-white hover:opacity-90"}`}
                    style={
                      !highlight
                        ? {
                            background:
                              "linear-gradient(135deg, #4F6EF7, #7C3AED)",
                          }
                        : {}
                    }
                  >
                    {cta}
                  </button>
                  <ul className="space-y-3">
                    {features.map((f) => (
                      <li
                        key={f}
                        className={`flex items-center gap-3 text-sm ${highlight ? "text-indigo-100" : "text-gray-600"}`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${highlight ? "bg-white/20 text-white" : "bg-green-100 text-green-600"}`}
                        >
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimatedSection>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <section id="faq" className="py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-16">
            <span className="text-sm font-bold uppercase tracking-widest text-indigo-500 mb-3 block">
              FAQ
            </span>
            <h2
              className="text-4xl md:text-5xl font-black text-gray-900"
              style={{ fontFamily: "Georgia, serif", letterSpacing: "-1.5px" }}
            >
              Questions? Answered.
            </h2>
          </div>
        </AnimatedSection>
        <div className="space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <AnimatedSection key={q} delay={i * 60}>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-indigo-100 transition-colors">
                <button
                  className="w-full flex items-center justify-between p-6 text-left"
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span className="font-bold text-gray-900 pr-4">{q}</span>
                  <span
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-lg transition-transform"
                    style={{
                      background: "linear-gradient(135deg, #4F6EF7, #7C3AED)",
                      transform: open === i ? "rotate(45deg)" : "rotate(0)",
                    }}
                  >
                    +
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: open === i ? "300px" : "0",
                    overflow: "hidden",
                    transition: "max-height 0.35s ease",
                  }}
                >
                  <p className="px-6 pb-6 text-gray-500 leading-relaxed text-sm">
                    {a}
                  </p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <AnimatedSection>
          <div
            className="rounded-3xl p-16 text-center text-white relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #4F6EF7 0%, #7C3AED 100%)",
              boxShadow: "0 40px 120px rgba(79,110,247,0.35)",
            }}
          >
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern
                    id="ctogrid"
                    width="30"
                    height="30"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 30 0 L 0 0 0 30"
                      fill="none"
                      stroke="white"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#ctogrid)" />
              </svg>
            </div>
            <div className="relative">
              <h2
                className="text-4xl md:text-5xl font-black mb-4"
                style={{
                  fontFamily: "Georgia, serif",
                  letterSpacing: "-1.5px",
                }}
              >
                Ready to transform
                <br />
                your hiring?
              </h2>
              <p className="text-indigo-200 text-lg mb-10 max-w-lg mx-auto">
                Join 2,000+ companies using Talk2Hire to find and hire top
                talent faster than ever before.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button className="px-8 py-4 rounded-xl bg-white text-indigo-600 font-bold text-base hover:bg-indigo-50 transition-all hover:scale-105 shadow-lg">
                  Start Free — No Credit Card
                </button>
                <button className="px-8 py-4 rounded-xl border-2 border-white/40 text-white font-bold text-base hover:bg-white/10 transition-all">
                  Schedule a Demo
                </button>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <div className="font-sans antialiased">
      <Hero />
      <LogoStrip />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
    </div>
  );
}
