import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useInView,
} from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Users,
  Globe,
  Calendar,
  Star,
  ExternalLink,
  Briefcase,
  Heart,
  Zap,
  Shield,
  Coffee,
  TrendingUp,
  Award,
  ChevronRight,
  Twitter,
  Linkedin,
  Github,
  Building2,
  Clock,
  GraduationCap,
  Tag,
  ArrowUpRight,
  Sparkles,
  Check,
} from "lucide-react";

/* ─── Fonts ─────────────────────────────────────────────── */
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&family=DM+Sans:wght@300;400;500;600;700&display=swap');`;

/* ─── Data ───────────────────────────────────────────────── */
const ALL_COMPANIES = [
  {
    id: "1",
    name: "Horizon Labs",
    industry: "Deep Technology",
    size: "201–500",
    location: "San Francisco, CA",
    openRoles: 14,
    rating: 4.8,
    reviews: 342,
    founded: "2018",
    tagline: "Building the future of human-computer interaction",
    description:
      "Horizon Labs is a deep-tech company pioneering next-generation interfaces that blur the boundary between humans and machines. Our work spans spatial computing, neural interfaces, and ambient AI — all in service of making technology invisible, intuitive, and empowering.",
    website: "https://horizonlabs.io",
    twitter: "horizonlabs",
    linkedin: "horizon-labs",
    github: "horizonlabs",
    tech: ["React", "Rust", "Python", "WebGL", "WASM", "Go", "Kubernetes"],
    palette: { from: "#0f172a", to: "#1e3a5f", accent: "#6366f1" },
    values: [
      {
        icon: Zap,
        title: "Move with intention",
        desc: "We move fast but never recklessly. Every decision is deliberate.",
        color: "#f59e0b",
        bg: "bg-amber-50",
        border: "border-amber-200",
      },
      {
        icon: Heart,
        title: "Care deeply",
        desc: "About users, teammates, and the long-term impact of what we build.",
        color: "#e11d48",
        bg: "bg-rose-50",
        border: "border-rose-200",
      },
      {
        icon: Shield,
        title: "Build with trust",
        desc: "Security, privacy, and honesty are non-negotiable foundations.",
        color: "#0ea5e9",
        bg: "bg-sky-50",
        border: "border-sky-200",
      },
      {
        icon: TrendingUp,
        title: "Compound growth",
        desc: "We invest in each other's growth with the same rigor as our products.",
        color: "#10b981",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
      },
      {
        icon: Coffee,
        title: "Rest & recharge",
        desc: "Sustainable pace matters. Burnout is a bug, not a feature.",
        color: "#8b5cf6",
        bg: "bg-violet-50",
        border: "border-violet-200",
      },
      {
        icon: Award,
        title: "Own outcomes",
        desc: "We hire adults who take end-to-end responsibility for commitments.",
        color: "#f97316",
        bg: "bg-orange-50",
        border: "border-orange-200",
      },
    ],
    perks: [
      { icon: "💰", label: "Competitive salary", sub: "Top 10% market rate" },
      {
        icon: "🏥",
        label: "Full health coverage",
        sub: "Medical, dental, vision",
      },
      { icon: "🌴", label: "Unlimited PTO", sub: "Minimum 20 days encouraged" },
      { icon: "🎓", label: "Learning budget", sub: "$3,000 / year" },
      { icon: "🏠", label: "Remote-friendly", sub: "Flexible hybrid model" },
      { icon: "📈", label: "Equity package", sub: "Competitive options" },
      { icon: "🍽️", label: "Daily catered lunch", sub: "SF HQ perks" },
      { icon: "🏋️", label: "Wellness stipend", sub: "$150 / month" },
    ],
    jobs: [
      {
        id: "j1",
        title: "Senior Frontend Engineer",
        type: "Full-time",
        department: "Engineering",
        location: "Remote / SF",
        salary: "$180–220k",
        experience: "4-6 years",
        posted: new Date(Date.now() - 2 * 86400000).toISOString(),
        skills: ["React", "TypeScript", "WebGL"],
      },
      {
        id: "j2",
        title: "ML Infrastructure Engineer",
        type: "Full-time",
        department: "Engineering",
        location: "San Francisco",
        salary: "$200–240k",
        experience: "5+ years",
        posted: new Date(Date.now() - 5 * 86400000).toISOString(),
        skills: ["Python", "Kubernetes", "CUDA"],
      },
      {
        id: "j3",
        title: "Product Designer",
        type: "Full-time",
        department: "Design",
        location: "Remote",
        salary: "$150–180k",
        experience: "3-5 years",
        posted: new Date(Date.now() - 1 * 86400000).toISOString(),
        skills: ["Figma", "Prototyping", "Design Systems"],
      },
      {
        id: "j4",
        title: "Developer Advocate",
        type: "Full-time",
        department: "Marketing",
        location: "Remote",
        salary: "$130–160k",
        experience: "2-4 years",
        posted: new Date(Date.now() - 7 * 86400000).toISOString(),
        skills: ["React", "Writing", "Public Speaking"],
      },
      {
        id: "j5",
        title: "Staff Backend Engineer",
        type: "Full-time",
        department: "Engineering",
        location: "San Francisco",
        salary: "$220–270k",
        experience: "7+ years",
        posted: new Date(Date.now() - 3 * 86400000).toISOString(),
        skills: ["Rust", "Go", "Distributed Systems"],
      },
    ],
  },
  {
    id: "2",
    name: "Verdant Systems",
    industry: "Climate Tech",
    size: "51–200",
    location: "Austin, TX",
    openRoles: 9,
    rating: 4.6,
    reviews: 187,
    founded: "2020",
    tagline: "Carbon intelligence for a net-zero world",
    description:
      "Verdant Systems builds AI-powered carbon management tools that help enterprises measure, reduce, and offset their environmental footprint. We work with Fortune 500 companies to make sustainability a competitive advantage.",
    website: "https://verdantsystems.io",
    twitter: "verdantsystems",
    linkedin: "verdant-systems",
    github: "verdantsystems",
    tech: ["Python", "Django", "React", "PostgreSQL", "IoT", "Data Science"],
    palette: { from: "#052e16", to: "#14532d", accent: "#22c55e" },
    values: [
      {
        icon: TrendingUp,
        title: "Planet first",
        desc: "Every product decision is filtered through its environmental impact.",
        color: "#22c55e",
        bg: "bg-green-50",
        border: "border-green-200",
      },
      {
        icon: Shield,
        title: "Data integrity",
        desc: "Carbon data must be accurate and auditable.",
        color: "#0ea5e9",
        bg: "bg-sky-50",
        border: "border-sky-200",
      },
      {
        icon: Award,
        title: "Bold thinking",
        desc: "The climate crisis demands bold solutions.",
        color: "#f97316",
        bg: "bg-orange-50",
        border: "border-orange-200",
      },
      {
        icon: Heart,
        title: "Radical transparency",
        desc: "Open source our research, open source our salary bands.",
        color: "#e11d48",
        bg: "bg-rose-50",
        border: "border-rose-200",
      },
    ],
    perks: [
      {
        icon: "🌱",
        label: "Climate offset stipend",
        sub: "We offset your footprint",
      },
      {
        icon: "🏥",
        label: "Full health coverage",
        sub: "Medical, dental, vision",
      },
      { icon: "🌴", label: "Flexible PTO", sub: "Take what you need" },
      { icon: "🎓", label: "Conference budget", sub: "$2,000 / year" },
      { icon: "🚲", label: "Commute stipend", sub: "Green transit only" },
      { icon: "📈", label: "Equity package", sub: "Meaningful ownership" },
    ],
    jobs: [
      {
        id: "j1",
        title: "Climate Data Scientist",
        type: "Full-time",
        department: "Data",
        location: "Austin / Remote",
        salary: "$140–170k",
        experience: "3-5 years",
        posted: new Date(Date.now() - 3 * 86400000).toISOString(),
        skills: ["Python", "SQL", "ML"],
      },
      {
        id: "j2",
        title: "Backend Engineer",
        type: "Full-time",
        department: "Engineering",
        location: "Remote",
        salary: "$130–160k",
        experience: "2-4 years",
        posted: new Date(Date.now() - 6 * 86400000).toISOString(),
        skills: ["Django", "PostgreSQL", "Docker"],
      },
      {
        id: "j3",
        title: "IoT Platform Engineer",
        type: "Full-time",
        department: "Engineering",
        location: "Austin, TX",
        salary: "$150–180k",
        experience: "4-6 years",
        posted: new Date(Date.now() - 2 * 86400000).toISOString(),
        skills: ["IoT", "Embedded", "Python"],
      },
    ],
  },
];

/* ─── Helpers ─────────────────────────────────────────────── */
const timeAgo = (d) => {
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
};
const getInitials = (name) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const TYPE_COLORS = {
  "Full-time": "bg-green-50 text-green-700 border-green-200",
  "Part-time": "bg-blue-50 text-blue-700 border-blue-200",
  Contract: "bg-amber-50 text-amber-700 border-amber-200",
  Remote: "bg-teal-50 text-teal-700 border-teal-200",
};

const Reveal = ({ children, delay = 0, className = "" }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ─── Job Card ────────────────────────────────────────────── */
const JobCard = ({ job, index, onClick, accent }) => {
  const tc =
    TYPE_COLORS[job.type] || "bg-slate-50 text-slate-600 border-slate-200";
  const skills = Array.isArray(job.skills) ? job.skills : [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{
        y: -4,
        boxShadow: "0 20px 48px -8px rgba(99,102,241,0.14)",
      }}
      onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer relative overflow-hidden transition-colors hover:border-indigo-300"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      <motion.div
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.25 }}
        className="absolute top-0 left-0 right-0 h-0.5 origin-left rounded-t-2xl"
        style={{
          background: `linear-gradient(90deg, ${accent}, #8b5cf6, #06b6d4)`,
        }}
      />
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors duration-200 leading-snug text-[15px]"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {job.title}
          </h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${tc}`}
            >
              {job.type}
            </span>
            {job.department && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                {job.department}
              </span>
            )}
          </div>
        </div>
        <motion.div
          whileHover={{ rotate: -45 }}
          transition={{ duration: 0.2 }}
          className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors"
        >
          <ArrowUpRight
            size={14}
            className="text-slate-400 group-hover:text-indigo-500 transition-colors"
          />
        </motion.div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {skills.slice(0, 4).map((sk) => (
          <span
            key={sk}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200"
          >
            <Tag size={8} /> {sk}
          </span>
        ))}
        {skills.length > 4 && (
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200">
            +{skills.length - 4}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin size={10} /> {job.location}
            </span>
          )}
          {job.experience && (
            <span className="flex items-center gap-1">
              <GraduationCap size={10} /> {job.experience}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {job.salary && (
            <span className="text-emerald-600 font-bold">{job.salary}</span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={10} /> {timeAgo(job.posted)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
const CompanyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setActiveTab("overview"); // reset tab when company changes
  }, [id]);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroBgY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);

  const company = ALL_COMPANIES.find((c) => c.id === id) || ALL_COMPANIES[0];
  const techPalettes = [
    "bg-indigo-50 text-indigo-600 border-indigo-200",
    "bg-green-50 text-green-600 border-green-200",
    "bg-orange-50 text-orange-600 border-orange-200",
    "bg-violet-50 text-violet-600 border-violet-200",
    "bg-sky-50 text-sky-600 border-sky-200",
  ];
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "jobs", label: `Open Roles (${company.jobs.length})` },
    { id: "culture", label: "Culture" },
    { id: "perks", label: "Perks" },
  ];

  return (
    <>
      {/* Basic SEO */}
      <title>
        {company.name} Careers & Open Jobs | Talk2Hire Careers Portal
      </title>

      <meta
        name="description"
        content={`${company.name} is hiring ${company.openRoles} roles in ${company.location}. Explore careers, company culture, tech stack, and open opportunities on Talk2Hire.`}
      />

      <link
        rel="canonical"
        href={`https://talk2hire.com/companies/${company.id}`}
      />

      {/* Open Graph */}
      <meta
        property="og:title"
        content={`${company.name} Careers | Talk2Hire`}
      />
      <meta
        property="og:description"
        content={`${company.tagline} • ${company.openRoles} open roles.`}
      />
      <meta
        property="og:url"
        content={`https://talk2hire.com/companies/${company.id}`}
      />
      <meta property="og:type" content="website" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={`${company.name} Jobs | Talk2Hire`} />
      <meta
        name="twitter:description"
        content={`${company.description.slice(0, 160)}`}
      />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: company.name,
          url: `https://talk2hire.com/companies/${company.id}`,
          logo: `https://talk2hire.com/talk2hirelogo.png`,
          description: company.description,
          foundingDate: company.founded,
          numberOfEmployees: company.size,
          sameAs: [
            `https://twitter.com/${company.twitter}`,
            `https://linkedin.com/company/${company.linkedin}`,
            `https://github.com/${company.github}`,
          ],
        })}
      </script>

      {/* Job List Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: company.jobs.map((job, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `https://talk2hire.com/jobs/${job.id}`,
          })),
        })}
      </script>

      <style>{FONT_IMPORT}</style>
      {/* Main page starts from here */}
      <div
        key={id}
        className="min-h-screen bg-slate-50"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* ══ HERO ══════════════════════════════════════════ */}
        <div ref={heroRef} className="relative h-80 overflow-hidden">
          <motion.div style={{ y: heroBgY }} className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${company.palette.from}, ${company.palette.to})`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-20 right-1/4 w-80 h-80 rounded-full"
              style={{
                background: `radial-gradient(circle, ${company.palette.accent}40 0%, transparent 70%)`,
              }}
            />
            <div
              className="absolute -bottom-10 left-1/4 w-48 h-48 rounded-full"
              style={{
                background: `radial-gradient(circle, ${company.palette.accent}25 0%, transparent 70%)`,
              }}
            />
          </motion.div>

          <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-b from-transparent to-slate-50 z-10" />

          {/* Back */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute top-6 left-6 z-20"
          >
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/companies")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white backdrop-blur-md"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <ArrowLeft size={14} /> Back
            </motion.button>
          </motion.div>

          {/* Socials */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="absolute top-6 right-6 z-20 flex gap-2"
          >
            {[
              { Icon: Twitter, url: `https://twitter.com/${company.twitter}` },
              {
                Icon: Linkedin,
                url: `https://linkedin.com/company/${company.linkedin}`,
              },
              { Icon: Github, url: `https://github.com/${company.github}` },
            ].map(({ Icon, url }) => (
              <motion.a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                whileHover={{ scale: 1.1 }}
                className="w-9 h-9 rounded-xl flex items-center justify-center backdrop-blur-sm"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                <Icon size={15} />
              </motion.a>
            ))}
          </motion.div>
        </div>

        {/* ══ IDENTITY STRIP ════════════════════════════════ */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between gap-5 -mt-14 relative z-20 flex-wrap pb-2">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-end gap-5"
            >
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center text-2xl font-bold shadow-xl shrink-0"
                style={{
                  background: "white",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 0 0 4px white",
                  fontFamily: "'Fraunces', serif",
                  color: company.palette.from,
                }}
              >
                {getInitials(company.name)}
              </div>
              <div className="pb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1
                    className="text-3xl text-slate-900 leading-tight"
                    style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
                  >
                    {company.name}
                  </h1>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-lg tracking-wide">
                    ✦ HIRING
                  </span>
                </div>
                <p className="text-slate-500 text-sm mt-1">{company.tagline}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="flex gap-2 pb-2 flex-wrap"
            >
              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                <Globe size={14} /> Website{" "}
                <ExternalLink size={11} className="text-slate-400" />
              </motion.a>
              <motion.button
                whileHover={{
                  scale: 1.02,
                  boxShadow: "0 8px 24px rgba(15,23,42,0.2)",
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab("jobs")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
                style={{ background: company.palette.from }}
              >
                <Briefcase size={14} /> {company.openRoles} Open Roles
              </motion.button>
            </motion.div>
          </div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22 }}
            className="mt-7 bg-white rounded-2xl border border-slate-200 overflow-hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-100"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          >
            {[
              { Icon: Users, label: "Employees", value: company.size },
              {
                Icon: Briefcase,
                label: "Open Roles",
                value: `${company.openRoles}`,
              },
              { Icon: Calendar, label: "Founded", value: company.founded },
              {
                Icon: MapPin,
                label: "Location",
                value: company.location.split(",")[0],
              },
              {
                Icon: Star,
                label: "Rating",
                value: `${company.rating} ★`,
                sub: `${company.reviews} reviews`,
              },
              {
                Icon: Building2,
                label: "Industry",
                value: company.industry.split(" ")[0],
              },
            ].map(({ Icon, label, value, sub }) => (
              <motion.div
                key={label}
                whileHover={{ background: "#FAFBFF" }}
                className="flex items-center gap-3 px-5 py-4 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {label}
                  </p>
                  <p
                    className="text-sm font-bold text-slate-800 truncate"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    {value}
                  </p>
                  {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Tab nav */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-7 flex gap-1 bg-white rounded-2xl p-1.5 border border-slate-200 w-fit"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative px-5 py-2.5 text-sm rounded-xl font-medium cursor-pointer transition-colors duration-150 whitespace-nowrap"
                style={{
                  color: activeTab === tab.id ? "#4F46E5" : "#64748b",
                  fontFamily: "'DM Sans', sans-serif",
                  background: "none",
                  border: "none",
                }}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="tabIndicator"
                    className="absolute inset-0 bg-indigo-50 rounded-xl border border-indigo-200"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </motion.div>

          {/* ══ TAB CONTENT ════════════════════════════════ */}
          <div className="mt-8 pb-24">
            <AnimatePresence mode="wait">
              {/* OVERVIEW */}
              {activeTab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-7"
                >
                  <div className="flex flex-col gap-6">
                    <Reveal>
                      <div
                        className="bg-white rounded-2xl border border-slate-200 p-8"
                        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                      >
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Building2 size={15} className="text-slate-500" />
                          </div>
                          <h2
                            className="text-xl text-slate-900"
                            style={{
                              fontFamily: "'Fraunces', serif",
                              fontWeight: 400,
                            }}
                          >
                            About {company.name}
                          </h2>
                        </div>
                        <p className="text-slate-500 text-[15px] leading-relaxed mb-5">
                          {company.description}
                        </p>
                        <motion.a
                          whileHover={{ x: 2 }}
                          href={company.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
                        >
                          Visit website <ExternalLink size={12} />
                        </motion.a>
                      </div>
                    </Reveal>

                    <Reveal delay={0.06}>
                      <div
                        className="bg-white rounded-2xl border border-slate-200 p-7"
                        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                      >
                        <h3
                          className="text-lg text-slate-900 mb-5"
                          style={{
                            fontFamily: "'Fraunces', serif",
                            fontWeight: 400,
                          }}
                        >
                          Tech Stack
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {company.tech.map((t, i) => (
                            <motion.span
                              key={t}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.04 + 0.1 }}
                              whileHover={{ scale: 1.05 }}
                              className={`text-sm font-semibold px-3.5 py-1.5 rounded-xl border ${techPalettes[i % techPalettes.length]}`}
                            >
                              {t}
                            </motion.span>
                          ))}
                        </div>
                      </div>
                    </Reveal>

                    <Reveal delay={0.1}>
                      <div
                        className="bg-white rounded-2xl border border-slate-200 p-7"
                        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                      >
                        <div className="flex items-center justify-between mb-5">
                          <h3
                            className="text-lg text-slate-900"
                            style={{
                              fontFamily: "'Fraunces', serif",
                              fontWeight: 400,
                            }}
                          >
                            Featured Openings
                          </h3>
                          <motion.button
                            whileHover={{ x: 2 }}
                            onClick={() => setActiveTab("jobs")}
                            className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors bg-transparent border-none cursor-pointer"
                          >
                            See all <ChevronRight size={14} />
                          </motion.button>
                        </div>
                        <div className="flex flex-col gap-2.5">
                          {company.jobs.slice(0, 3).map((job, i) => (
                            <motion.div
                              key={job.id}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.07 + 0.15 }}
                              whileHover={{
                                x: 4,
                                background: "#F8FAFF",
                                borderColor: "#C7D2FE",
                              }}
                              onClick={() => navigate(`/jobs/${job.id}`)}
                              className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-slate-100 cursor-pointer transition-all duration-200"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {job.title}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {job.department} · {job.location}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {job.salary && (
                                  <span className="text-xs font-bold text-emerald-600">
                                    {job.salary}
                                  </span>
                                )}
                                <ChevronRight
                                  size={14}
                                  className="text-slate-300"
                                />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </Reveal>
                  </div>

                  {/* Sidebar */}
                  <div className="flex flex-col gap-5 lg:sticky lg:top-24 self-start">
                    <Reveal delay={0.12}>
                      <div
                        className="bg-white rounded-2xl border border-slate-200 p-6"
                        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                      >
                        <h3
                          className="text-base text-slate-900 mb-5"
                          style={{
                            fontFamily: "'Fraunces', serif",
                            fontWeight: 400,
                          }}
                        >
                          Company Info
                        </h3>
                        <div className="flex flex-col">
                          {[
                            {
                              Icon: Building2,
                              label: "Industry",
                              value: company.industry,
                            },
                            {
                              Icon: Users,
                              label: "Size",
                              value: `${company.size} employees`,
                            },
                            {
                              Icon: Calendar,
                              label: "Founded",
                              value: company.founded,
                            },
                            {
                              Icon: MapPin,
                              label: "HQ",
                              value: company.location,
                            },
                          ].map(({ Icon, label, value }) => (
                            <div
                              key={label}
                              className="flex gap-3 items-start py-3 border-b border-slate-50 last:border-0"
                            >
                              <Icon
                                size={14}
                                className="text-slate-400 mt-0.5 shrink-0"
                              />
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {label}
                                </p>
                                <p className="text-sm font-medium text-slate-700 mt-0.5">
                                  {value}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Reveal>

                    <Reveal delay={0.16}>
                      <div
                        className="rounded-2xl p-6 text-white relative overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${company.palette.from}, ${company.palette.to})`,
                          border: "none",
                        }}
                      >
                        <div
                          className="absolute -top-8 -right-8 w-32 h-32 rounded-full"
                          style={{
                            background: `radial-gradient(circle, ${company.palette.accent}35, transparent 70%)`,
                          }}
                        />
                        <div className="flex items-center gap-2 mb-3">
                          <Star size={14} fill="#f59e0b" color="#f59e0b" />
                          <span className="text-xs font-semibold text-white/60">
                            Employee Rating
                          </span>
                        </div>
                        <p
                          className="text-5xl font-light text-white mb-2"
                          style={{ fontFamily: "'Fraunces', serif" }}
                        >
                          {company.rating}
                        </p>
                        <div className="flex gap-1 mb-2">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={13}
                              fill={
                                s <= Math.floor(company.rating)
                                  ? "#f59e0b"
                                  : "transparent"
                              }
                              color={
                                s <= Math.floor(company.rating)
                                  ? "#f59e0b"
                                  : "rgba(255,255,255,0.2)"
                              }
                            />
                          ))}
                        </div>
                        <p className="text-xs text-white/40">
                          Based on {company.reviews} reviews
                        </p>
                      </div>
                    </Reveal>

                    <Reveal delay={0.2}>
                      <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-5">
                        <Sparkles size={18} className="text-indigo-500 mb-3" />
                        <p className="text-sm font-bold text-indigo-800 mb-1.5">
                          Ready to join?
                        </p>
                        <p className="text-xs text-indigo-500 mb-4 leading-relaxed">
                          {company.openRoles} open positions waiting for you.
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setActiveTab("jobs")}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold"
                          style={{ background: company.palette.from }}
                        >
                          Browse Roles <ChevronRight size={14} />
                        </motion.button>
                      </div>
                    </Reveal>
                  </div>
                </motion.div>
              )}

              {/* JOBS */}
              {activeTab === "jobs" && (
                <motion.div
                  key="jobs"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                >
                  <div className="flex items-center justify-between mb-7 flex-wrap gap-3">
                    <div>
                      <h2
                        className="text-3xl text-slate-900"
                        style={{
                          fontFamily: "'Fraunces', serif",
                          fontWeight: 300,
                        }}
                      >
                        Open{" "}
                        <span
                          className="font-semibold"
                          style={{
                            background: `linear-gradient(135deg, ${company.palette.accent}, #8b5cf6)`,
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                          }}
                        >
                          Opportunities
                        </span>
                      </h2>
                      <p className="text-sm text-slate-400 mt-1">
                        {company.jobs.length} positions · actively hiring
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {company.jobs.map((job, i) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        index={i}
                        accent={company.palette.accent}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* CULTURE */}
              {activeTab === "culture" && (
                <motion.div
                  key="culture"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                >
                  <div className="text-center mb-14">
                    <Reveal>
                      <h2
                        className="text-4xl text-slate-900 mb-4"
                        style={{
                          fontFamily: "'Fraunces', serif",
                          fontWeight: 300,
                        }}
                      >
                        What we{" "}
                        <em
                          className="not-italic font-semibold"
                          style={{
                            background: `linear-gradient(135deg, ${company.palette.accent}, #8b5cf6)`,
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                          }}
                        >
                          believe in
                        </em>
                      </h2>
                      <p className="text-slate-500 text-base max-w-xl mx-auto leading-relaxed">
                        Our values aren't posters on a wall — they're the
                        operating principles behind every decision we make.
                      </p>
                    </Reveal>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {company.values.map((v, i) => (
                      <Reveal key={v.title} delay={i * 0.06}>
                        <motion.div
                          whileHover={{
                            y: -5,
                            boxShadow: `0 20px 48px -8px ${v.color}22`,
                          }}
                          transition={{ duration: 0.25 }}
                          className="bg-white rounded-2xl border border-slate-200 p-7"
                          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                        >
                          <div
                            className={`w-11 h-11 rounded-2xl ${v.bg} border ${v.border} flex items-center justify-center mb-5`}
                          >
                            <v.icon size={20} style={{ color: v.color }} />
                          </div>
                          <h3
                            className="text-base font-semibold text-slate-900 mb-2"
                            style={{ fontFamily: "'Fraunces', serif" }}
                          >
                            {v.title}
                          </h3>
                          <p className="text-sm text-slate-500 leading-relaxed">
                            {v.desc}
                          </p>
                        </motion.div>
                      </Reveal>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* PERKS */}
              {activeTab === "perks" && (
                <motion.div
                  key="perks"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                >
                  <div className="text-center mb-14">
                    <Reveal>
                      <h2
                        className="text-4xl text-slate-900 mb-4"
                        style={{
                          fontFamily: "'Fraunces', serif",
                          fontWeight: 300,
                        }}
                      >
                        Life at {company.name}
                      </h2>
                      <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                        We invest in the people who build our future.
                      </p>
                    </Reveal>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {company.perks.map((perk, i) => (
                      <Reveal key={perk.label} delay={i * 0.05}>
                        <motion.div
                          whileHover={{
                            y: -4,
                            boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
                          }}
                          className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4"
                          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                        >
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl shrink-0">
                            {perk.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800">
                              {perk.label}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {perk.sub}
                            </p>
                          </div>
                          <Check
                            size={15}
                            className="text-emerald-500 shrink-0 mt-0.5"
                          />
                        </motion.div>
                      </Reveal>
                    ))}
                  </div>
                  <Reveal delay={0.1} className="mt-10">
                    <div
                      className="rounded-3xl p-10 flex items-center justify-between gap-6 flex-wrap relative overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${company.palette.from}, ${company.palette.to})`,
                      }}
                    >
                      <div
                        className="absolute -top-10 right-16 w-48 h-48 rounded-full"
                        style={{
                          background: `radial-gradient(circle, ${company.palette.accent}30, transparent 70%)`,
                        }}
                      />
                      <div className="relative z-10">
                        <h3
                          className="text-2xl font-light text-white mb-2"
                          style={{ fontFamily: "'Fraunces', serif" }}
                        >
                          Ready to make an impact?
                        </h3>
                        <p className="text-white/50 text-sm">
                          {company.openRoles} open roles — and growing.
                        </p>
                      </div>
                      <motion.button
                        whileHover={{
                          scale: 1.03,
                          boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
                        }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setActiveTab("jobs")}
                        className="relative z-10 flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-slate-900 text-sm font-bold shrink-0"
                      >
                        <Briefcase size={15} /> Explore Open Roles
                      </motion.button>
                    </div>
                  </Reveal>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
};

export default CompanyDetail;
