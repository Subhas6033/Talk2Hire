import React, { useState, useRef, useMemo } from "react";
import {
  motion,
  AnimatePresence,
  useInView,
  useScroll,
  useTransform,
} from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  Clock,
  Users,
  Zap,
  Heart,
  Globe,
  Star,
  ChevronRight,
  Search,
  X,
  Briefcase,
  Code,
  Palette,
  BarChart3,
  Megaphone,
  Shield,
  Coffee,
  Laptop,
  Plane,
  BookOpen,
  Award,
  TrendingUp,
  CheckCircle,
  ArrowLeft,
  Send,
  Sparkles,
  Building2,
  Target,
  Brain,
  Mic,
  Camera,
  Headphones,
  Rocket,
  DollarSign,
  Calendar,
  Filter,
} from "lucide-react";

/* ══════════════════════════════════════════
   Design Tokens
══════════════════════════════════════════ */
const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

  :root {
    --c-cream:    #faf9f7;
    --c-white:    #ffffff;
    --c-ink:      #0d0d12;
    --c-ink-70:   rgba(13,13,18,0.70);
    --c-ink-40:   rgba(13,13,18,0.40);
    --c-ink-12:   rgba(13,13,18,0.08);
    --c-slate:    #1e2235;
    --c-slate-2:  #2d3352;
    --c-slate-3:  #3d4570;
    --c-amber:    #d97706;
    --c-amber-l:  #fef3c7;
    --c-amber-2:  #f59e0b;
    --c-amber-3:  #fde68a;
    --c-sage:     #059669;
    --c-sage-l:   #d1fae5;
    --c-violet:   #7c3aed;
    --c-violet-l: #ede9fe;
    --c-rose:     #e11d48;
    --c-rose-l:   #ffe4e6;
    --c-sky:      #0284c7;
    --c-sky-l:    #e0f2fe;
    --c-border:   rgba(13,13,18,0.09);
    --sh-sm:  0 1px 3px rgba(13,13,18,.07), 0 1px 2px rgba(13,13,18,.05);
    --sh-md:  0 4px 18px rgba(13,13,18,.08), 0 2px 6px rgba(13,13,18,.05);
    --sh-lg:  0 20px 60px rgba(13,13,18,.11), 0 8px 20px rgba(13,13,18,.07);
    --sh-xl:  0 32px 80px rgba(13,13,18,.15);
  }

  .careers-root { font-family: 'DM Sans', sans-serif; color: var(--c-ink); }
  .careers-root h1, .careers-root h2, .careers-root h3, .careers-root h4 {
    font-family: 'Playfair Display', Georgia, serif;
  }

  @keyframes floatA { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-14px) rotate(2deg)} }
  @keyframes floatB { 0%,100%{transform:translateY(0) rotate(1deg)}  50%{transform:translateY(-10px) rotate(-2deg)} }
  @keyframes floatC { 0%,100%{transform:translateY(0)}               50%{transform:translateY(-8px)} }
  @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

  .float-a { animation: floatA 6s ease-in-out infinite; }
  .float-b { animation: floatB 7.5s ease-in-out infinite 0.8s; }
  .float-c { animation: floatC 5s ease-in-out infinite 1.4s; }
  .ticker-track { animation: ticker 32s linear infinite; }
  .ticker-track:hover { animation-play-state: paused; }

  .search-inp { outline: none; }
  .search-inp::placeholder { color: var(--c-ink-40); }

  .modal-overlay { backdrop-filter: blur(12px); }

  .line-clamp-2 {
    display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden;
  }
`;

/* ══════════════════════════════════════════
   Data
══════════════════════════════════════════ */
const DEPARTMENTS = [
  {
    id: "all",
    label: "All Roles",
    icon: Briefcase,
    color: "var(--c-slate)",
    bg: "var(--c-ink-12)",
  },
  {
    id: "eng",
    label: "Engineering",
    icon: Code,
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
  },
  {
    id: "design",
    label: "Design",
    icon: Palette,
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
  },
  {
    id: "ai",
    label: "AI / ML",
    icon: Brain,
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
  },
  {
    id: "growth",
    label: "Growth",
    icon: TrendingUp,
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
  },
  {
    id: "ops",
    label: "Operations",
    icon: BarChart3,
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
  },
];

const JOBS = [
  {
    id: 1,
    title: "Senior Full-Stack Engineer",
    dept: "eng",
    location: "Remote · Global",
    type: "Full-time",
    level: "Senior",
    salary: "$140k – $180k",
    posted: "2d ago",
    hot: true,
    description:
      "Build the core platform that helps 50k+ candidates land their dream jobs. Own critical features end-to-end, from API design to pixel-perfect UI.",
    responsibilities: [
      "Architect and build new product features across our React + Node.js stack",
      "Lead technical design reviews and mentor junior engineers",
      "Drive performance, reliability, and scalability improvements",
      "Collaborate with product and design on user-facing experiences",
    ],
    requirements: [
      "5+ years building production web applications",
      "Deep expertise in React, TypeScript, and Node.js",
      "Experience with PostgreSQL, Redis, and cloud infrastructure (AWS/GCP)",
      "Strong communication and ownership mentality",
    ],
    gradient: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
    iconColor: "var(--c-violet)",
  },
  {
    id: 2,
    title: "AI / ML Engineer",
    dept: "ai",
    location: "Remote · US / India",
    type: "Full-time",
    level: "Mid–Senior",
    salary: "$150k – $200k",
    posted: "1d ago",
    hot: true,
    description:
      "Shape the AI engine that powers our interview simulator. Work with LLMs, speech recognition, and real-time feedback models at scale.",
    responsibilities: [
      "Fine-tune and deploy LLMs for interview question generation and evaluation",
      "Build real-time speech analysis and scoring pipelines",
      "Design feedback models that improve candidate performance",
      "Partner with product to ship AI features users love",
    ],
    requirements: [
      "3+ years of applied ML/NLP experience",
      "Proficiency in Python, PyTorch or TensorFlow",
      "Experience with LLM fine-tuning (LoRA, RLHF, etc.)",
      "Strong fundamentals in statistics and model evaluation",
    ],
    gradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    iconColor: "var(--c-amber)",
  },
  {
    id: 3,
    title: "Product Designer",
    dept: "design",
    location: "Remote · Global",
    type: "Full-time",
    level: "Mid–Senior",
    salary: "$110k – $150k",
    posted: "3d ago",
    hot: false,
    description:
      "Design experiences that reduce anxiety and build confidence for job seekers. Every pixel you ship affects someone's career.",
    responsibilities: [
      "Own end-to-end design for key product areas — research to final polish",
      "Build and maintain the Talk2Hire design system",
      "Run user research and usability testing sessions",
      "Partner closely with engineers to ensure pixel-perfect implementation",
    ],
    requirements: [
      "4+ years of product design experience",
      "Mastery of Figma and prototyping tools",
      "Portfolio demonstrating complex UX problem-solving",
      "Experience designing for emotional, high-stakes user journeys",
    ],
    gradient: "linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)",
    iconColor: "var(--c-rose)",
  },
  {
    id: 4,
    title: "Growth Marketing Lead",
    dept: "growth",
    location: "Hybrid · Wilmington, DE",
    type: "Full-time",
    level: "Senior",
    salary: "$100k – $135k",
    posted: "5d ago",
    hot: false,
    description:
      "Drive user acquisition and retention for a platform that's already growing 40% month-over-month. Own the full funnel.",
    responsibilities: [
      "Build and execute multi-channel acquisition strategies (SEO, paid, content)",
      "Design and run growth experiments with rigorous A/B testing",
      "Own lifecycle marketing: email, push, and in-product campaigns",
      "Build dashboards and report on north-star growth metrics",
    ],
    requirements: [
      "5+ years in growth or performance marketing",
      "Deep expertise in SEO, SEM, and content marketing",
      "Data-driven mindset with SQL proficiency",
      "Experience at a high-growth B2C SaaS company",
    ],
    gradient: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
    iconColor: "var(--c-sage)",
  },
  {
    id: 5,
    title: "DevOps / Platform Engineer",
    dept: "eng",
    location: "Remote · Global",
    type: "Full-time",
    level: "Mid",
    salary: "$120k – $160k",
    posted: "6d ago",
    hot: false,
    description:
      "Keep our platform running fast and reliably for hundreds of thousands of interviews per month. Infrastructure is a product here.",
    responsibilities: [
      "Design and maintain Kubernetes-based infrastructure on AWS",
      "Build CI/CD pipelines and developer tooling",
      "Own observability: metrics, tracing, alerting, and on-call",
      "Improve deployment velocity while maintaining 99.9% uptime",
    ],
    requirements: [
      "3+ years in DevOps, SRE, or platform engineering",
      "Strong Kubernetes and AWS/GCP expertise",
      "Experience with Terraform, ArgoCD, or similar IaC/GitOps tools",
      "Security-first mindset",
    ],
    gradient: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
    iconColor: "var(--c-sky)",
  },
  {
    id: 6,
    title: "Head of Operations",
    dept: "ops",
    location: "Wilmington, DE",
    type: "Full-time",
    level: "Director",
    salary: "$130k – $170k",
    posted: "1w ago",
    hot: false,
    description:
      "Build the operational backbone of a fast-scaling startup. Own recruiting, vendor relationships, finance ops, and company culture.",
    responsibilities: [
      "Design and scale operational processes as headcount grows 3×",
      "Own talent acquisition and onboarding for all non-technical roles",
      "Manage vendor relationships, contracts, and budget planning",
      "Build a culture of efficiency, accountability, and joy",
    ],
    requirements: [
      "7+ years in operations, COO, or Chief of Staff roles",
      "Experience scaling a startup from seed to Series B+",
      "Financial modeling and budget management expertise",
      "Outstanding written and verbal communication",
    ],
    gradient: "linear-gradient(135deg, #faf9f7 0%, #f3f4f6 100%)",
    iconColor: "var(--c-slate)",
  },
];

const PERKS = [
  {
    icon: Laptop,
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
    title: "Top-tier equipment",
    desc: "MacBook Pro + $1,500 home office stipend on day one.",
  },
  {
    icon: Globe,
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
    title: "Work from anywhere",
    desc: "Fully remote-first with async-friendly culture.",
  },
  {
    icon: Plane,
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
    title: "Annual team retreat",
    desc: "Fly the whole team together once a year. No excuses.",
  },
  {
    icon: BookOpen,
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
    title: "$2,000 learning budget",
    desc: "Books, courses, conferences — invest in your growth.",
  },
  {
    icon: Heart,
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
    title: "Health & wellness",
    desc: "Full medical, dental, vision + $100/mo wellness credit.",
  },
  {
    icon: DollarSign,
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
    title: "Equity for everyone",
    desc: "Every full-time hire gets meaningful equity. You own what you build.",
  },
  {
    icon: Clock,
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
    title: "Flexible hours",
    desc: "Own your schedule. We care about output, not hours.",
  },
  {
    icon: Coffee,
    color: "var(--c-slate)",
    bg: "var(--c-ink-12)",
    title: "Unlimited PTO",
    desc: "Minimum 15 days enforced. We actually want you to rest.",
  },
];

const VALUES = [
  {
    icon: Target,
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
    title: "Mission first",
    desc: "Every decision runs through: does this help a candidate get hired? If yes, ship it.",
  },
  {
    icon: Rocket,
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
    title: "Move fast",
    desc: "We ship weekly. Perfect is the enemy of done. Learn fast, iterate faster.",
  },
  {
    icon: Users,
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
    title: "Radical honesty",
    desc: "We say what we mean. Feedback is a gift. We disagree directly and commit fully.",
  },
  {
    icon: Sparkles,
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
    title: "Own it deeply",
    desc: "No one waits to be told. We identify problems, own solutions, and see them through.",
  },
];

/* ══════════════════════════════════════════
   Shared primitives
══════════════════════════════════════════ */
const GridTexture = ({ opacity = 0.38 }) => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage:
        "linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px)",
      backgroundSize: "52px 52px",
      opacity,
    }}
  />
);

const DotGrid = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage:
        "radial-gradient(circle, var(--c-border) 1px, transparent 1px)",
      backgroundSize: "32px 32px",
      opacity: 0.3,
    }}
  />
);

const Ornament = ({ className = "" }) => (
  <div className={`flex items-center justify-center gap-3 ${className}`}>
    <div
      className="h-px w-14 rounded-full"
      style={{
        background: "linear-gradient(90deg, transparent, var(--c-amber))",
      }}
    />
    <span style={{ color: "var(--c-amber)", fontSize: 10 }}>✦</span>
    <div
      className="h-px w-14 rounded-full"
      style={{
        background: "linear-gradient(90deg, var(--c-amber), transparent)",
      }}
    />
  </div>
);

const SectionLabel = ({ children, center = false }) => (
  <p
    className={`text-xs uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 ${center ? "justify-center" : ""}`}
    style={{ color: "var(--c-amber)" }}
  >
    <span
      className="w-5 h-px inline-block"
      style={{ backgroundColor: "var(--c-amber)" }}
    />
    {children}
    <span
      className="w-5 h-px inline-block"
      style={{ backgroundColor: "var(--c-amber)" }}
    />
  </p>
);

const dept = (id) => DEPARTMENTS.find((d) => d.id === id);

/* ══════════════════════════════════════════
   Apply Modal
══════════════════════════════════════════ */
const ApplyModal = ({ job, onClose }) => {
  const [step, setStep] = useState(1); // 1 = form, 2 = success
  const [form, setForm] = useState({
    name: "",
    email: "",
    linkedin: "",
    why: "",
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email))
      e.email = "Valid email required";
    if (!form.why.trim()) e.why = "This field is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) setStep(2);
  };

  const inputCls =
    "w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200";
  const inputStyle = (field) => ({
    fontFamily: "'DM Sans', sans-serif",
    background: "var(--c-cream)",
    borderColor: errors[field] ? "#e11d48" : "var(--c-border)",
    color: "var(--c-ink)",
    boxShadow: errors[field] ? "0 0 0 3px rgba(225,29,72,0.08)" : "none",
  });

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(13,13,18,0.55)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="relative w-full max-w-lg rounded-3xl overflow-hidden"
          style={{ background: "var(--c-white)", boxShadow: "var(--sh-xl)" }}
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
        >
          {/* Top accent */}
          <div
            className="h-1"
            style={{
              background:
                "linear-gradient(90deg, var(--c-amber), var(--c-amber-2), var(--c-amber-3))",
            }}
          />

          <div className="p-8">
            {/* Close */}
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute top-5 right-5 w-8 h-8 rounded-xl border flex items-center justify-center cursor-pointer"
              style={{
                borderColor: "var(--c-border)",
                color: "var(--c-ink-40)",
              }}
            >
              <X size={14} />
            </motion.button>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {/* Header */}
                  <div className="mb-7">
                    <p
                      className="text-xs font-bold uppercase tracking-[0.2em] mb-1"
                      style={{ color: "var(--c-amber)" }}
                    >
                      Apply Now
                    </p>
                    <h2
                      className="text-2xl font-bold leading-snug mb-1"
                      style={{ color: "var(--c-ink)" }}
                    >
                      {job.title}
                    </h2>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "var(--c-ink-40)" }}
                      >
                        <MapPin size={10} /> {job.location}
                      </span>
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "var(--c-ink-40)" }}
                      >
                        <DollarSign size={10} /> {job.salary}
                      </span>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <label
                        className="block text-[11px] font-bold uppercase tracking-widest mb-2"
                        style={{ color: "var(--c-ink-70)" }}
                      >
                        Full Name *
                      </label>
                      <input
                        className={inputCls}
                        style={inputStyle("name")}
                        placeholder="Jane Smith"
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                      />
                      {errors.name && (
                        <p
                          className="text-xs mt-1.5"
                          style={{ color: "var(--c-rose)" }}
                        >
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        className="block text-[11px] font-bold uppercase tracking-widest mb-2"
                        style={{ color: "var(--c-ink-70)" }}
                      >
                        Email Address *
                      </label>
                      <input
                        className={inputCls}
                        style={inputStyle("email")}
                        placeholder="jane@example.com"
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                      />
                      {errors.email && (
                        <p
                          className="text-xs mt-1.5"
                          style={{ color: "var(--c-rose)" }}
                        >
                          {errors.email}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        className="block text-[11px] font-bold uppercase tracking-widest mb-2"
                        style={{ color: "var(--c-ink-70)" }}
                      >
                        LinkedIn / Portfolio URL
                      </label>
                      <input
                        className={inputCls}
                        style={{
                          ...inputStyle("linkedin"),
                          borderColor: "var(--c-border)",
                        }}
                        placeholder="https://linkedin.com/in/yourprofile"
                        value={form.linkedin}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, linkedin: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label
                        className="block text-[11px] font-bold uppercase tracking-widest mb-2"
                        style={{ color: "var(--c-ink-70)" }}
                      >
                        Why Talk2Hire? *
                      </label>
                      <textarea
                        rows={4}
                        className={inputCls}
                        style={{ ...inputStyle("why"), resize: "none" }}
                        placeholder="What excites you about this role and our mission?"
                        value={form.why}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, why: e.target.value }))
                        }
                      />
                      {errors.why && (
                        <p
                          className="text-xs mt-1.5"
                          style={{ color: "var(--c-rose)" }}
                        >
                          {errors.why}
                        </p>
                      )}
                    </div>
                  </div>

                  <motion.button
                    onClick={handleSubmit}
                    whileHover={{
                      boxShadow: "0 12px 36px rgba(30,34,53,0.28)",
                    }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full mt-6 py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 cursor-pointer"
                    style={{
                      background: "var(--c-slate)",
                      fontFamily: "'DM Sans', sans-serif",
                      boxShadow: "var(--sh-md)",
                    }}
                  >
                    <Send size={15} /> Submit Application
                  </motion.button>
                  <p
                    className="text-center text-[11px] mt-3"
                    style={{ color: "var(--c-ink-40)" }}
                  >
                    We respond to every application within 5 business days.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <motion.div
                    className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-6"
                    style={{ background: "var(--c-sage-l)" }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 280, delay: 0.1 }}
                  >
                    <CheckCircle size={36} style={{ color: "var(--c-sage)" }} />
                  </motion.div>
                  <h2
                    className="text-2xl font-bold mb-3"
                    style={{ color: "var(--c-ink)" }}
                  >
                    Application Sent!
                  </h2>
                  <p
                    className="text-sm leading-relaxed mb-6 max-w-sm mx-auto"
                    style={{ color: "var(--c-ink-70)" }}
                  >
                    Thanks <strong>{form.name.split(" ")[0]}</strong>! We've
                    received your application for <strong>{job.title}</strong>.
                    Expect to hear from us within 5 business days.
                  </p>
                  <Ornament className="mb-6" />
                  <motion.button
                    onClick={onClose}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    className="px-7 py-3 rounded-xl font-semibold text-sm border cursor-pointer"
                    style={{
                      background: "var(--c-white)",
                      borderColor: "var(--c-border)",
                      color: "var(--c-ink-70)",
                    }}
                  >
                    Back to Careers
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ══════════════════════════════════════════
   Job Detail Panel
══════════════════════════════════════════ */
const JobDetail = ({ job, onBack, onApply }) => {
  const d = dept(job.dept);
  const Icon = d?.icon || Briefcase;
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-24 rounded-3xl border overflow-hidden"
      style={{
        background: "var(--c-white)",
        borderColor: "var(--c-border)",
        boxShadow: "var(--sh-lg)",
        maxHeight: "calc(100vh - 7rem)",
        overflowY: "auto",
      }}
    >
      {/* Gradient header */}
      <div
        className="h-36 relative flex items-center justify-between px-8"
        style={{ background: job.gradient }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center border relative z-10"
          style={{
            background: "rgba(255,255,255,0.85)",
            borderColor: "rgba(255,255,255,0.6)",
          }}
        >
          <Icon size={24} style={{ color: job.iconColor }} />
        </div>
        {job.hot && (
          <div
            className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Zap size={11} style={{ color: "var(--c-amber)" }} />
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--c-amber)" }}
            >
              Hot Role
            </span>
          </div>
        )}
      </div>

      <div className="p-7">
        {/* Meta */}
        <span
          className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-4"
          style={{ background: d?.bg, color: d?.color }}
        >
          {d?.label}
        </span>
        <h2
          className="text-xl font-bold leading-snug mb-3"
          style={{ color: "var(--c-ink)" }}
        >
          {job.title}
        </h2>
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            { icon: MapPin, val: job.location },
            { icon: Clock, val: job.type },
            { icon: DollarSign, val: job.salary },
            { icon: Award, val: job.level },
          ].map(({ icon: Ic, val }) => (
            <span
              key={val}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border"
              style={{
                background: "var(--c-cream)",
                borderColor: "var(--c-border)",
                color: "var(--c-ink-70)",
              }}
            >
              <Ic size={11} style={{ color: "var(--c-ink-40)" }} /> {val}
            </span>
          ))}
        </div>

        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: "var(--c-ink-70)" }}
        >
          {job.description}
        </p>

        {/* Responsibilities */}
        <div className="mb-6">
          <h4
            className="text-sm font-bold mb-3"
            style={{ color: "var(--c-ink)" }}
          >
            What you'll do
          </h4>
          <ul className="flex flex-col gap-2.5">
            {job.responsibilities.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm"
                style={{ color: "var(--c-ink-70)" }}
              >
                <CheckCircle
                  size={14}
                  className="mt-0.5 shrink-0"
                  style={{ color: "var(--c-sage)" }}
                />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Requirements */}
        <div className="mb-7">
          <h4
            className="text-sm font-bold mb-3"
            style={{ color: "var(--c-ink)" }}
          >
            What you'll bring
          </h4>
          <ul className="flex flex-col gap-2.5">
            {job.requirements.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm"
                style={{ color: "var(--c-ink-70)" }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                  style={{ backgroundColor: "var(--c-amber)" }}
                />
                {r}
              </li>
            ))}
          </ul>
        </div>

        <motion.button
          onClick={() => onApply(job)}
          whileHover={{ boxShadow: "0 12px 36px rgba(30,34,53,0.28)" }}
          whileTap={{ scale: 0.97 }}
          className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 cursor-pointer"
          style={{
            background: "var(--c-slate)",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: "var(--sh-md)",
          }}
        >
          Apply for this Role <ArrowRight size={15} />
        </motion.button>
      </div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════
   Job Card
══════════════════════════════════════════ */
const JobCard = ({ job, selected, onSelect }) => {
  const d = dept(job.dept);
  const Icon = d?.icon || Briefcase;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      onClick={() => onSelect(job)}
      className="group relative overflow-hidden rounded-2xl border cursor-pointer p-5 flex flex-col gap-4 transition-all duration-200"
      style={{
        background: selected ? "var(--c-cream)" : "var(--c-white)",
        borderColor: selected ? "var(--c-amber)" : "var(--c-border)",
        boxShadow: selected
          ? "0 0 0 1px var(--c-amber), var(--sh-md)"
          : "var(--sh-sm)",
      }}
    >
      {/* Left accent line when selected */}
      {selected && (
        <motion.div
          className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full"
          style={{ background: "var(--c-amber)" }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: job.gradient }}
          >
            <Icon size={18} style={{ color: job.iconColor }} />
          </div>
          <div>
            <h3
              className="font-bold text-sm leading-snug"
              style={{ color: "var(--c-ink)" }}
            >
              {job.title}
            </h3>
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: d?.color }}
            >
              {d?.label}
            </span>
          </div>
        </div>
        {job.hot && (
          <span
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold shrink-0"
            style={{ background: "var(--c-amber-l)", color: "var(--c-amber)" }}
          >
            <Zap size={9} /> Hot
          </span>
        )}
      </div>

      <p
        className="text-xs leading-relaxed line-clamp-2"
        style={{ color: "var(--c-ink-70)" }}
      >
        {job.description}
      </p>

      <div
        className="flex flex-wrap items-center gap-2 pt-3 border-t"
        style={{ borderColor: "var(--c-border)" }}
      >
        <span
          className="flex items-center gap-1 text-[11px]"
          style={{ color: "var(--c-ink-40)" }}
        >
          <MapPin size={10} /> {job.location}
        </span>
        <span
          className="flex items-center gap-1 text-[11px] ml-auto"
          style={{ color: "var(--c-ink-40)" }}
        >
          <DollarSign size={10} /> {job.salary}
        </span>
        <span className="text-[11px]" style={{ color: "var(--c-ink-40)" }}>
          {job.posted}
        </span>
      </div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════
   Floating stat card (hero)
══════════════════════════════════════════ */
const FloatCard = ({
  floatClass,
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  delay,
}) => (
  <motion.div
    className={`${floatClass} flex items-center gap-3 px-4 py-3 rounded-2xl border`}
    style={{
      background: "var(--c-white)",
      borderColor: "var(--c-border)",
      boxShadow: "var(--sh-lg)",
    }}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, type: "spring", stiffness: 200 }}
  >
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center"
      style={{ background: iconBg }}
    >
      <Icon size={16} style={{ color: iconColor }} />
    </div>
    <div className="leading-none">
      <p
        className="text-sm font-black"
        style={{
          color: "var(--c-ink)",
          fontFamily: "'Playfair Display', serif",
        }}
      >
        {value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--c-ink-40)" }}>
        {label}
      </p>
    </div>
  </motion.div>
);

/* ══════════════════════════════════════════
   Values ticker
══════════════════════════════════════════ */
const phrases = [
  "Mission-driven",
  "Remote-first",
  "Fast-moving",
  "Equity for all",
  "Real ownership",
  "No bureaucracy",
  "Ship weekly",
  "Grow fast",
];
const Ticker = () => (
  <div
    className="relative overflow-hidden py-4 border-y"
    style={{ borderColor: "var(--c-border)" }}
  >
    <div
      className="pointer-events-none absolute inset-y-0 left-0 w-20 z-10"
      style={{
        background: "linear-gradient(to right, var(--c-white), transparent)",
      }}
    />
    <div
      className="pointer-events-none absolute inset-y-0 right-0 w-20 z-10"
      style={{
        background: "linear-gradient(to left, var(--c-white), transparent)",
      }}
    />
    <div className="ticker-track flex gap-8 w-max">
      {[...phrases, ...phrases].map((p, i) => (
        <div key={i} className="flex items-center gap-3 shrink-0">
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--c-ink-40)" }}
          >
            {p}
          </span>
          <span style={{ color: "var(--c-amber)", fontSize: 8 }}>✦</span>
        </div>
      ))}
    </div>
  </div>
);

/* ══════════════════════════════════════════
   Main Careers
══════════════════════════════════════════ */
const Careers = () => {
  const navigate = useNavigate();
  const [activeDept, setActiveDept] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyingJob, setApplyingJob] = useState(null);

  const heroRef = useRef(null);
  const perksRef = useRef(null);
  const perksInView = useInView(perksRef, { once: true, margin: "-60px" });
  const valuesRef = useRef(null);
  const valuesInView = useInView(valuesRef, { once: true, margin: "-60px" });

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const filtered = useMemo(() => {
    let jobs =
      activeDept === "all" ? JOBS : JOBS.filter((j) => j.dept === activeDept);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q) ||
          dept(j.dept)?.label.toLowerCase().includes(q),
      );
    }
    return jobs;
  }, [activeDept, searchQuery]);

  const handleSelect = (job) =>
    setSelectedJob((prev) => (prev?.id === job.id ? null : job));

  return (
    <>
      <title>Careers | Talk2Hire — Build the Future of Hiring</title>
      <meta
        name="description"
        content="Join Talk2Hire and help build the AI-powered platform that's changing how people get hired. Remote-first, equity for all, and a mission that matters."
      />
      <style>{TOKENS}</style>

      <div className="careers-root">
        {/* ══════════════════════════════════════
            HERO
        ══════════════════════════════════════ */}
        <section
          ref={heroRef}
          className="relative overflow-hidden min-h-[92vh] flex items-center"
          style={{ background: "var(--c-white)" }}
        >
          <GridTexture />

          {/* Glows */}
          <div
            className="absolute top-0 right-0 w-150 h-150 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 80% 15%, #fef3c7 0%, #fde68a 25%, transparent 65%)",
              opacity: 0.65,
              filter: "blur(80px)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-112.5 h-112.5 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 20% 85%, #ede9fe 0%, transparent 70%)",
              opacity: 0.4,
              filter: "blur(90px)",
            }}
          />

          {/* Rings */}
          <div
            className="absolute top-12 right-16 w-56 h-56 rounded-full border pointer-events-none"
            style={{ borderColor: "rgba(217,119,6,0.10)" }}
          />
          <div
            className="absolute top-24 right-28 w-32 h-32 rounded-full border pointer-events-none"
            style={{ borderColor: "rgba(217,119,6,0.07)" }}
          />
          <div
            className="absolute bottom-20 left-10 w-44 h-44 rounded-full border pointer-events-none"
            style={{ borderColor: "rgba(124,58,237,0.08)" }}
          />

          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="relative z-10 mx-auto max-w-7xl px-6 py-24 w-full"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {/* Left */}
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Pill */}
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-7"
                    style={{
                      background: "var(--c-amber-l)",
                      borderColor: "rgba(217,119,6,0.25)",
                    }}
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "var(--c-amber)" }}
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                    <span
                      className="text-xs font-bold uppercase tracking-[0.2em]"
                      style={{ color: "var(--c-amber)" }}
                    >
                      We're hiring · {JOBS.length} open roles
                    </span>
                  </motion.div>

                  <h1
                    className="leading-[1.05] tracking-tight mb-6"
                    style={{
                      fontSize: "clamp(40px, 6vw, 72px)",
                      fontWeight: 900,
                      color: "var(--c-ink)",
                    }}
                  >
                    Build the future
                    <br />
                    of{" "}
                    <span className="relative inline-block">
                      <span
                        style={{
                          fontStyle: "italic",
                          background:
                            "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-3) 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        hiring.
                      </span>
                      <svg
                        className="absolute -bottom-1 left-0 w-full"
                        viewBox="0 0 280 8"
                        fill="none"
                        preserveAspectRatio="none"
                      >
                        <motion.path
                          d="M4 5 Q70 1 140 5 Q210 9 276 4"
                          stroke="#d97706"
                          strokeWidth="3"
                          strokeLinecap="round"
                          fill="none"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{
                            delay: 1,
                            duration: 0.8,
                            ease: "easeOut",
                          }}
                        />
                      </svg>
                    </span>
                  </h1>

                  <p
                    className="text-base leading-relaxed mb-8 max-w-lg"
                    style={{ color: "var(--c-ink-70)", fontWeight: 300 }}
                  >
                    We're a small, mission-obsessed team building the platform
                    that helps people land jobs they love. Every line of code,
                    every design decision, and every feature ships to real
                    candidates navigating real stakes.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <motion.button
                      onClick={() =>
                        document
                          .getElementById("open-roles")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      whileHover={{
                        boxShadow: "0 12px 36px rgba(30,34,53,0.28)",
                      }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-sm text-white cursor-pointer border-0"
                      style={{
                        background: "var(--c-slate)",
                        fontFamily: "'DM Sans', sans-serif",
                        boxShadow: "var(--sh-md)",
                      }}
                    >
                      <Briefcase size={15} /> See Open Roles
                      <ChevronRight size={14} />
                    </motion.button>
                    <motion.button
                      onClick={() =>
                        document
                          .getElementById("perks")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-sm cursor-pointer border"
                      style={{
                        background: "var(--c-white)",
                        borderColor: "var(--c-border)",
                        color: "var(--c-ink-70)",
                        boxShadow: "var(--sh-sm)",
                      }}
                    >
                      Why Join Us
                    </motion.button>
                  </div>

                  {/* Trust */}
                  <motion.div
                    className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t"
                    style={{ borderColor: "var(--c-border)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    {[
                      { value: JOBS.length, label: "Open roles" },
                      { value: "Remote-first", label: "Work style" },
                      { value: "Equity", label: "For everyone" },
                    ].map((s) => (
                      <div key={s.label}>
                        <p
                          className="text-lg font-black"
                          style={{
                            fontFamily: "'Playfair Display', serif",
                            color: "var(--c-ink)",
                          }}
                        >
                          {s.value}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--c-ink-40)" }}
                        >
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </motion.div>
                </motion.div>
              </div>

              {/* Right — floating cards */}
              <div className="hidden lg:block relative h-115">
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Central glow orb */}
                  <div
                    className="absolute w-64 h-64 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(217,119,6,0.12), transparent 70%)",
                      filter: "blur(30px)",
                    }}
                  />

                  {/* Central card */}
                  <motion.div
                    className="float-a relative z-20 rounded-3xl border p-6 w-64"
                    style={{
                      background: "var(--c-white)",
                      borderColor: "var(--c-border)",
                      boxShadow: "var(--sh-xl)",
                    }}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                  >
                    <div
                      className="h-0.5 absolute top-0 left-5 right-5 rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, var(--c-amber), var(--c-amber-2), var(--c-amber-3))",
                      }}
                    />
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: "var(--c-amber-l)" }}
                      >
                        <Rocket size={18} style={{ color: "var(--c-amber)" }} />
                      </div>
                      <div>
                        <p
                          className="text-xs font-bold uppercase tracking-widest"
                          style={{ color: "var(--c-amber)" }}
                        >
                          Culture
                        </p>
                        <p
                          className="text-sm font-bold"
                          style={{ color: "var(--c-ink)" }}
                        >
                          Build. Ship. Grow.
                        </p>
                      </div>
                    </div>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--c-ink-70)" }}
                    >
                      We move fast and trust people to own their work
                      completely.
                    </p>
                    <div className="flex -space-x-2 mt-4">
                      {[
                        "#6366f1",
                        "#ec4899",
                        "#f59e0b",
                        "#10b981",
                        "#0ea5e9",
                      ].map((c, i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-full border-2 border-white"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div
                        className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold"
                        style={{
                          backgroundColor: "var(--c-cream)",
                          color: "var(--c-ink-70)",
                        }}
                      >
                        +8
                      </div>
                    </div>
                  </motion.div>

                  {/* Top-right floating stat */}
                  <div className="absolute top-4 right-4">
                    <FloatCard
                      floatClass="float-b"
                      icon={Globe}
                      iconColor="var(--c-sky)"
                      iconBg="var(--c-sky-l)"
                      label="Work from anywhere"
                      value="Remote-first"
                      delay={0.6}
                    />
                  </div>

                  {/* Bottom-left floating stat */}
                  <div className="absolute bottom-8 left-0">
                    <FloatCard
                      floatClass="float-c"
                      icon={DollarSign}
                      iconColor="var(--c-sage)"
                      iconBg="var(--c-sage-l)"
                      label="Every full-time hire"
                      value="Equity ✓"
                      delay={0.8}
                    />
                  </div>

                  {/* Top-left dept pill stack */}
                  <motion.div
                    className="float-b absolute top-8 -left-2.5 flex flex-col gap-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1, duration: 0.5 }}
                  >
                    {DEPARTMENTS.slice(1, 4).map((d, i) => {
                      const Ic = d.icon;
                      return (
                        <div
                          key={d.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                          style={{
                            background: "var(--c-white)",
                            borderColor: "var(--c-border)",
                            boxShadow: "var(--sh-sm)",
                          }}
                        >
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: d.bg }}
                          >
                            <Ic size={12} style={{ color: d.color }} />
                          </div>
                          <span
                            className="text-xs font-semibold"
                            style={{ color: "var(--c-ink-70)" }}
                          >
                            {d.label}
                          </span>
                        </div>
                      );
                    })}
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ══════════════════════════════════════
            TICKER
        ══════════════════════════════════════ */}
        <Ticker />

        {/* ══════════════════════════════════════
            VALUES
        ══════════════════════════════════════ */}
        <section
          ref={valuesRef}
          className="relative py-24 overflow-hidden"
          style={{ background: "var(--c-cream)" }}
        >
          <DotGrid />
          <div
            className="absolute top-0 right-0 w-100 h-100 rounded-full blur-[130px] opacity-25 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, var(--c-amber-l), transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="text-center mb-14">
              <SectionLabel center>How We Work</SectionLabel>
              <motion.h2
                className="text-4xl sm:text-5xl font-black tracking-tight mb-4"
                style={{ color: "var(--c-ink)" }}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                What we{" "}
                <em
                  style={{
                    fontStyle: "italic",
                    background:
                      "linear-gradient(135deg, var(--c-slate) 0%, var(--c-slate-3) 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  actually
                </em>{" "}
                believe.
              </motion.h2>
              <motion.p
                className="text-base max-w-md mx-auto"
                style={{ color: "var(--c-ink-70)" }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
              >
                Not marketing copy. These are the principles we make hard
                decisions against.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {VALUES.map((v, i) => {
                const Icon = v.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 28, scale: 0.97 }}
                    animate={valuesInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                    transition={{
                      delay: i * 0.1,
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    whileHover={{ y: -6, boxShadow: "var(--sh-lg)" }}
                    className="group relative overflow-hidden rounded-3xl border p-7 flex flex-col gap-4"
                    style={{
                      background: "var(--c-white)",
                      borderColor: "var(--c-border)",
                      boxShadow: "var(--sh-sm)",
                      transition: "box-shadow 0.3s",
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none"
                      style={{
                        background: `radial-gradient(ellipse at top left, ${v.bg} 0%, transparent 65%)`,
                      }}
                    />
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center relative group-hover:scale-110 transition-transform duration-300"
                      style={{ backgroundColor: v.bg }}
                    >
                      <Icon size={22} style={{ color: v.color }} />
                    </div>
                    <div className="relative">
                      <h3
                        className="font-bold text-base mb-2"
                        style={{ color: "var(--c-ink)" }}
                      >
                        {v.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--c-ink-70)" }}
                      >
                        {v.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            PERKS
        ══════════════════════════════════════ */}
        <section
          id="perks"
          ref={perksRef}
          className="relative py-28 overflow-hidden"
          style={{ background: "var(--c-white)" }}
        >
          <GridTexture />
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-175 h-75 rounded-full blur-[120px] opacity-15 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, var(--c-amber-l), transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-14">
              <div>
                <SectionLabel>Benefits & Perks</SectionLabel>
                <motion.h2
                  className="text-4xl sm:text-5xl font-black tracking-tight mb-3"
                  style={{ color: "var(--c-ink)" }}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  We take care
                  <br />
                  of our people.
                </motion.h2>
                <motion.p
                  className="text-base max-w-md"
                  style={{ color: "var(--c-ink-70)" }}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                >
                  Great work deserves great support. Here's what every full-time
                  hire gets from day one.
                </motion.p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {PERKS.map((perk, i) => {
                const Icon = perk.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    animate={perksInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      delay: i * 0.07,
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    whileHover={{ y: -5, boxShadow: "var(--sh-md)" }}
                    className="group p-6 rounded-2xl border flex flex-col gap-4"
                    style={{
                      background: "var(--c-cream)",
                      borderColor: "var(--c-border)",
                      boxShadow: "var(--sh-sm)",
                      transition: "box-shadow 0.25s",
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                      style={{ backgroundColor: perk.bg }}
                    >
                      <Icon size={20} style={{ color: perk.color }} />
                    </div>
                    <div>
                      <h3
                        className="font-bold text-sm mb-1.5"
                        style={{ color: "var(--c-ink)" }}
                      >
                        {perk.title}
                      </h3>
                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: "var(--c-ink-70)" }}
                      >
                        {perk.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            OPEN ROLES
        ══════════════════════════════════════ */}
        <section
          id="open-roles"
          className="relative py-28 overflow-hidden"
          style={{ background: "var(--c-cream)" }}
        >
          <DotGrid />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="mb-10">
              <SectionLabel>Open Positions</SectionLabel>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                <motion.h2
                  className="text-4xl sm:text-5xl font-black tracking-tight"
                  style={{ color: "var(--c-ink)" }}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  Find your role.
                </motion.h2>

                {/* Search */}
                <motion.div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border sm:w-72"
                  style={{
                    background: "var(--c-white)",
                    borderColor: "var(--c-border)",
                    boxShadow: "var(--sh-sm)",
                  }}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  whileFocusWithin={{
                    borderColor: "var(--c-amber)",
                    boxShadow: "0 0 0 3px rgba(217,119,6,0.10)",
                  }}
                >
                  <Search
                    size={15}
                    style={{ color: "var(--c-ink-40)", flexShrink: 0 }}
                  />
                  <input
                    className="search-inp flex-1 bg-transparent text-sm"
                    style={{
                      color: "var(--c-ink)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    placeholder="Search roles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      style={{ color: "var(--c-ink-40)" }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </motion.div>
              </div>
            </div>

            {/* Dept filter */}
            <div
              className="flex items-center gap-2.5 overflow-x-auto pb-1 mb-8"
              style={{ scrollbarWidth: "none" }}
            >
              {DEPARTMENTS.map((d) => {
                const Ic = d.icon;
                const active = activeDept === d.id;
                return (
                  <motion.button
                    key={d.id}
                    onClick={() => {
                      setActiveDept(d.id);
                      setSelectedJob(null);
                    }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest cursor-pointer shrink-0 transition-all duration-200"
                    style={{
                      background: active ? d.color : "var(--c-white)",
                      borderColor: active ? d.color : "var(--c-border)",
                      color: active ? "#fff" : "var(--c-ink-70)",
                      boxShadow: active ? "var(--sh-md)" : "var(--sh-sm)",
                    }}
                  >
                    <Ic size={12} /> {d.label}
                  </motion.button>
                );
              })}
            </div>

            {/* Jobs + detail panel */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Job list */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <AnimatePresence mode="wait">
                  {filtered.length > 0 ? (
                    <motion.div
                      key={activeDept + searchQuery}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col gap-4"
                    >
                      {filtered.map((job, i) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          selected={selectedJob?.id === job.id}
                          onSelect={handleSelect}
                        />
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center py-20 text-center"
                    >
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: "var(--c-amber-l)" }}
                      >
                        <Search size={22} style={{ color: "var(--c-amber)" }} />
                      </div>
                      <h3
                        className="text-lg font-bold mb-2"
                        style={{ color: "var(--c-ink)" }}
                      >
                        No roles found
                      </h3>
                      <p
                        className="text-sm mb-4"
                        style={{ color: "var(--c-ink-70)" }}
                      >
                        Try a different search or department.
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setActiveDept("all");
                        }}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                        style={{
                          background: "var(--c-white)",
                          borderColor: "var(--c-border)",
                          color: "var(--c-ink-70)",
                        }}
                      >
                        Clear filters
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Detail panel */}
              <div className="lg:col-span-3">
                <AnimatePresence mode="wait">
                  {selectedJob ? (
                    <JobDetail
                      key={selectedJob.id}
                      job={selectedJob}
                      onBack={() => setSelectedJob(null)}
                      onApply={(j) => setApplyingJob(j)}
                    />
                  ) : (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-3xl border flex flex-col items-center justify-center py-24 text-center"
                      style={{
                        background: "var(--c-white)",
                        borderColor: "var(--c-border)",
                        boxShadow: "var(--sh-sm)",
                      }}
                    >
                      <motion.div
                        className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5"
                        style={{ background: "var(--c-amber-l)" }}
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        <Briefcase
                          size={28}
                          style={{ color: "var(--c-amber)" }}
                        />
                      </motion.div>
                      <h3
                        className="text-xl font-bold mb-2"
                        style={{ color: "var(--c-ink)" }}
                      >
                        Select a role
                      </h3>
                      <p
                        className="text-sm max-w-xs"
                        style={{ color: "var(--c-ink-70)" }}
                      >
                        Click any job on the left to see the full description
                        and requirements.
                      </p>
                      <Ornament className="mt-6" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Didn't find anything? */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 p-8 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-6"
              style={{
                background: "var(--c-white)",
                borderColor: "var(--c-border)",
                boxShadow: "var(--sh-sm)",
              }}
            >
              <div>
                <h3
                  className="font-bold text-lg mb-1"
                  style={{ color: "var(--c-ink)" }}
                >
                  Don't see the right role?
                </h3>
                <p className="text-sm" style={{ color: "var(--c-ink-70)" }}>
                  We hire for talent, not just open reqs. Send us a note — we
                  read every message.
                </p>
              </div>
              <motion.a
                href="mailto:careers@talk2hire.com"
                whileHover={{ y: -2, boxShadow: "var(--sh-md)" }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border shrink-0 cursor-pointer"
                style={{
                  background: "var(--c-white)",
                  borderColor: "var(--c-border)",
                  color: "var(--c-ink)",
                  boxShadow: "var(--sh-sm)",
                }}
              >
                <Send size={14} /> Send Open Application
              </motion.a>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            CTA BANNER
        ══════════════════════════════════════ */}
        <section
          className="relative py-28 overflow-hidden"
          style={{ backgroundColor: "var(--c-slate)" }}
        >
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div
            className="absolute top-[-25%] left-1/2 -translate-x-1/2 w-150 h-100 rounded-full blur-[160px] opacity-20 pointer-events-none"
            style={{ backgroundColor: "var(--c-amber)" }}
          />
          <div
            className="absolute bottom-[-20%] right-[-5%] w-100 h-100 rounded-full blur-[120px] opacity-10 pointer-events-none"
            style={{ backgroundColor: "var(--c-violet)" }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative text-center px-6"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-7"
              style={{
                background: "var(--c-amber-l)",
                borderColor: "rgba(217,119,6,0.25)",
              }}
            >
              <Zap size={11} style={{ color: "var(--c-amber)" }} />
              <span
                className="text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--c-amber)" }}
              >
                Join us · {JOBS.length} open roles
              </span>
            </div>

            <h2 className="text-4xl sm:text-6xl font-black text-white mb-5 tracking-tight leading-[1.04]">
              Your work should
              <br />
              matter.
            </h2>
            <p className="text-white/50 mb-10 max-w-md mx-auto text-base leading-relaxed">
              At Talk2Hire, every engineer, designer, and marketer directly
              impacts the career trajectory of thousands of people. Come build
              something that matters.
            </p>

            <motion.button
              onClick={() =>
                document
                  .getElementById("open-roles")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 font-bold text-sm rounded-xl"
              style={{
                background: "var(--c-white)",
                color: "var(--c-slate)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              See All Open Roles <ArrowRight size={14} />
            </motion.button>

            <div className="mt-16 flex flex-wrap justify-center gap-12">
              {[
                { icon: Users, value: `${JOBS.length}`, label: "Open roles" },
                { icon: Globe, value: "Remote", label: "Work style" },
                { icon: Heart, value: "Equity", label: "For all hires" },
                { icon: Rocket, value: "Series A", label: "Stage" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Icon size={13} style={{ color: "var(--c-amber)" }} />
                    <p className="text-xl font-black text-white">{value}</p>
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>
      </div>

      {/* Apply Modal */}
      {applyingJob && (
        <ApplyModal job={applyingJob} onClose={() => setApplyingJob(null)} />
      )}
    </>
  );
};

export default Careers;
