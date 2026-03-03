import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Search,
  MapPin,
  Users,
  Briefcase,
  Star,
  Building2,
  Globe,
  TrendingUp,
  X,
  SlidersHorizontal,
  ArrowUpRight,
  Sparkles,
  ChevronRight,
  Filter,
} from "lucide-react";

/* ─── Fonts ─────────────────────────────────────────────── */
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&family=DM+Sans:wght@300;400;500;600;700&display=swap');`;

/* ─── Mock data ──────────────────────────────────────────── */
const COMPANIES = [
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
    tags: ["AI", "Spatial Computing", "WebGL"],
    palette: { from: "#0f172a", to: "#1e3a5f", accent: "#6366f1" },
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
    tags: ["Python", "IoT", "Data Science"],
    palette: { from: "#052e16", to: "#14532d", accent: "#22c55e" },
  },
  {
    id: "3",
    name: "Pulse Finance",
    industry: "FinTech",
    size: "501–1000",
    location: "New York, NY",
    openRoles: 22,
    rating: 4.4,
    reviews: 512,
    founded: "2016",
    tagline: "Real-time financial infrastructure for modern banks",
    tags: ["Go", "Kafka", "React"],
    palette: { from: "#1e1b4b", to: "#312e81", accent: "#8b5cf6" },
  },
  {
    id: "4",
    name: "Aether Design",
    industry: "Design & Creative",
    size: "11–50",
    location: "Remote",
    openRoles: 6,
    rating: 4.9,
    reviews: 94,
    founded: "2021",
    tagline: "Product design studio for ambitious startups",
    tags: ["Figma", "Framer", "Brand"],
    palette: { from: "#4a044e", to: "#701a75", accent: "#e879f9" },
  },
  {
    id: "5",
    name: "Forge Robotics",
    industry: "Robotics & Hardware",
    size: "101–200",
    location: "Boston, MA",
    openRoles: 17,
    rating: 4.7,
    reviews: 231,
    founded: "2019",
    tagline: "Autonomous machines for industrial environments",
    tags: ["Rust", "C++", "ROS"],
    palette: { from: "#431407", to: "#7c2d12", accent: "#f97316" },
  },
  {
    id: "6",
    name: "Nimbus Cloud",
    industry: "Cloud Infrastructure",
    size: "1001–5000",
    location: "Seattle, WA",
    openRoles: 41,
    rating: 4.3,
    reviews: 1280,
    founded: "2014",
    tagline: "Developer-first cloud platform at any scale",
    tags: ["Kubernetes", "Terraform", "AWS"],
    palette: { from: "#0c1445", to: "#1e3a8a", accent: "#3b82f6" },
  },
  {
    id: "7",
    name: "Mira Health",
    industry: "HealthTech",
    size: "51–200",
    location: "Chicago, IL",
    openRoles: 11,
    rating: 4.5,
    reviews: 163,
    founded: "2019",
    tagline: "AI diagnostics bringing healthcare to everyone",
    tags: ["Python", "FHIR", "ML"],
    palette: { from: "#042f2e", to: "#134e4a", accent: "#14b8a6" },
  },
  {
    id: "8",
    name: "Stratum Security",
    industry: "Cybersecurity",
    size: "51–200",
    location: "Washington, DC",
    openRoles: 8,
    rating: 4.6,
    reviews: 145,
    founded: "2017",
    tagline: "Zero-trust security infrastructure for enterprises",
    tags: ["Rust", "Zero Trust", "SOC2"],
    palette: { from: "#1c1917", to: "#292524", accent: "#f59e0b" },
  },
  {
    id: "9",
    name: "Luma Commerce",
    industry: "E-commerce",
    size: "201–500",
    location: "Los Angeles, CA",
    openRoles: 19,
    rating: 4.2,
    reviews: 398,
    founded: "2018",
    tagline: "Headless commerce platform powering 10k+ stores",
    tags: ["Next.js", "GraphQL", "Shopify"],
    palette: { from: "#1a0533", to: "#3b0764", accent: "#a855f7" },
  },
];

const INDUSTRIES = [...new Set(COMPANIES.map((c) => c.industry))];
const SIZES = [...new Set(COMPANIES.map((c) => c.size))];

/* ─── Helpers ───────────────────────────────────────────── */
const getInitials = (name) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* ─── Animated stat counter ─────────────────────────────── */
const StatCounter = ({ end, suffix = "", label }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useState(() => {
    if (!inView) return;
    let c = 0;
    const step = end / 50;
    const t = setInterval(() => {
      c += step;
      if (c >= end) {
        setCount(end);
        clearInterval(t);
      } else setCount(Math.floor(c));
    }, 20);
    return () => clearInterval(t);
  });

  return (
    <div ref={ref} className="text-center">
      <div
        className="text-3xl font-bold text-slate-900"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="text-sm text-slate-500 mt-1 font-medium">{label}</div>
    </div>
  );
};

/* ─── Company Card ───────────────────────────────────────── */
const CompanyCard = ({ company, index, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{
        duration: 0.45,
        delay: index * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{
        y: -6,
        transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
      }}
      onClick={onClick}
      className="group bg-white rounded-3xl border border-slate-200 cursor-pointer overflow-hidden flex flex-col"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
      //   whileHover={{ boxShadow: "0 24px 60px -12px rgba(0,0,0,0.14)" }}
    >
      {/* Cover strip */}
      <div
        className="relative h-24 overflow-hidden shrink-0"
        style={{
          background: `linear-gradient(135deg, ${company.palette.from}, ${company.palette.to})`,
        }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Glow */}
        <div
          className="absolute -top-6 -right-6 w-28 h-28 rounded-full"
          style={{
            background: `radial-gradient(circle, ${company.palette.accent}40 0%, transparent 70%)`,
          }}
        />
        {/* Open roles badge */}
        <div className="absolute top-3 right-3">
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.06 + 0.2 }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm"
            style={{
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "white",
            }}
          >
            <Briefcase size={9} />
            {company.openRoles} open
          </motion.span>
        </div>
        {/* Arrow */}
        <motion.div
          className="absolute bottom-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.25)",
          }}
          whileHover={{ rotate: -45, background: "rgba(255,255,255,0.3)" }}
          transition={{ duration: 0.2 }}
        >
          <ArrowUpRight size={13} color="white" />
        </motion.div>
      </div>

      {/* Logo overlap */}
      <div className="px-5 relative">
        <motion.div
          className="absolute -top-6 left-5 w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold shadow-lg"
          style={{
            background: "white",
            border: "2.5px solid white",
            boxShadow: `0 4px 16px ${company.palette.accent}30, 0 2px 8px rgba(0,0,0,0.1)`,
            color: company.palette.from,
            fontFamily: "'Fraunces', serif",
            fontSize: 14,
          }}
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.2 }}
        >
          {getInitials(company.name)}
        </motion.div>
      </div>

      {/* Body */}
      <div className="px-5 pt-9 pb-5 flex flex-col flex-1 gap-3">
        <div>
          <h3
            className="font-semibold text-slate-900 leading-tight text-base group-hover:text-indigo-600 transition-colors duration-200"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}
          >
            {company.name}
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {company.industry}
          </p>
        </div>

        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 flex-1">
          {company.tagline}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {company.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{
                background: `${company.palette.accent}18`,
                color: company.palette.accent,
                border: `1px solid ${company.palette.accent}30`,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <MapPin size={10} />
              {company.location}
            </span>
            <span className="flex items-center gap-1">
              <Users size={10} />
              {company.size}
            </span>
          </div>
          <span className="flex items-center gap-1 font-semibold text-amber-500">
            <Star size={10} fill="currentColor" />
            {company.rating}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Filter chip ────────────────────────────────────────── */
const FilterChip = ({ label, value, options, onChange, placeholder }) => {
  const active = !!value;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-xl text-sm font-medium outline-none cursor-pointer transition-all duration-150 appearance-none pr-8"
        style={{
          background: active ? "#EEF2FF" : "#F8FAFC",
          border: active ? "1.5px solid #C7D2FE" : "1.5px solid #E2E8F0",
          color: active ? "#4F46E5" : "#475569",
          fontFamily: "'DM Sans', sans-serif",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
const CompaniesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const totalRoles = COMPANIES.reduce((s, c) => s + c.openRoles, 0);

  const filtered = useMemo(() => {
    return COMPANIES.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q));
      return (
        matchSearch &&
        (!industry || c.industry === industry) &&
        (!size || c.size === size)
      );
    });
  }, [search, industry, size]);

  const hasFilters = search || industry || size;

  const clearAll = () => {
    setSearch("");
    setIndustry("");
    setSize("");
  };

  return (
    <>
      {/* Basic SEO */}
      <title>
        Companies Hiring Now | Explore Top Employers | Talk2Hire Careers Portal
      </title>

      <meta
        name="description"
        content="Browse top companies actively hiring across tech, finance, healthcare, climate tech, and more. Discover company culture, open roles, ratings, and apply directly on Talk2Hire."
      />

      <meta
        name="keywords"
        content="companies hiring, top employers, hiring companies, tech companies hiring, startups hiring, browse companies, company jobs"
      />

      <meta name="robots" content="index, follow" />

      <link rel="canonical" href="https://talk2hire.com/companies" />

      {/* Open Graph */}
      <meta property="og:title" content="Companies Hiring Now | Talk2Hire" />
      <meta
        property="og:description"
        content="Explore top companies actively hiring. Discover culture, ratings, and open roles."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://talk2hire.com/companies" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Companies Hiring Now | Talk2Hire" />
      <meta
        name="twitter:description"
        content="Discover top companies and explore open roles across industries."
      />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Companies Hiring on Talk2Hire",
          url: "https://talk2hire.com/companies",
          numberOfItems: 9,
          itemListElement: COMPANIES.map((company, index) => ({
            "@type": "Organization",
            position: index + 1,
            name: company.name,
            industry: company.industry,
            url: `https://talk2hire.com/companies`,
          })),
        })}
      </script>

      <style>{FONT_IMPORT}</style>

      <div
        className="min-h-screen bg-slate-50"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* ── Decorative BG ── */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div
            className="absolute -top-40 -right-40 w-150 h-150 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 65%)",
            }}
          />
          <div
            className="absolute -bottom-32 -left-32 w-125 h-125 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(14,165,233,0.04) 0%, transparent 65%)",
            }}
          />
        </div>

        {/* ══ HERO ══════════════════════════════════════════ */}
        <div className="relative z-10 pt-16 pb-12 px-6">
          <div className="max-w-7xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex justify-center mb-6"
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-bold tracking-wide uppercase">
                <Sparkles size={12} />
                {COMPANIES.length} Companies Hiring
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="text-center text-5xl md:text-6xl text-slate-900 mb-5 leading-tight"
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 300 }}
            >
              Find your{" "}
              <em
                className="not-italic font-semibold"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                dream company
              </em>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="text-center text-lg text-slate-500 max-w-2xl mx-auto mb-10 font-light leading-relaxed"
            >
              Explore {COMPANIES.length} top companies actively hiring. Discover
              their culture, tech stack, and open roles — all in one place.
            </motion.p>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22 }}
              className="flex justify-center gap-12 mb-12"
            >
              {[
                { end: COMPANIES.length, suffix: "+", label: "Companies" },
                { end: totalRoles, suffix: "+", label: "Open Roles" },
                { end: 12400, suffix: "+", label: "Hires Made" },
              ].map((s) => (
                <StatCounter key={s.label} {...s} />
              ))}
            </motion.div>

            {/* Search bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.28 }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-white rounded-2xl border border-slate-200 p-2 flex gap-2 shadow-lg shadow-slate-100">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by company, industry, or tech stack…"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-slate-400 font-medium"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                    >
                      <X size={11} className="text-slate-500" />
                    </button>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 border"
                  style={{
                    background: showFilters ? "#4F46E5" : "#F8FAFC",
                    borderColor: showFilters ? "#4F46E5" : "#E2E8F0",
                    color: showFilters ? "white" : "#475569",
                    boxShadow: showFilters
                      ? "0 4px 12px rgba(79,70,229,0.25)"
                      : "none",
                  }}
                >
                  <SlidersHorizontal size={15} />
                  <span className="hidden sm:inline">Filters</span>
                  {(industry || size) && (
                    <span className="w-4 h-4 rounded-full bg-white text-indigo-600 text-[10px] font-bold flex items-center justify-center">
                      {[industry, size].filter(Boolean).length}
                    </span>
                  )}
                </motion.button>
              </div>

              {/* Filter panel */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-2 gap-4 shadow-sm">
                      <FilterChip
                        label="Industry"
                        value={industry}
                        onChange={setIndustry}
                        options={INDUSTRIES}
                        placeholder="All Industries"
                      />
                      <FilterChip
                        label="Company size"
                        value={size}
                        onChange={setSize}
                        options={SIZES}
                        placeholder="Any Size"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        {/* ══ MAIN CONTENT ════════════════════════════════ */}
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-24">
          {/* Results bar */}
          <AnimatePresence mode="wait">
            <motion.div
              key={filtered.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between mb-6 flex-wrap gap-3"
            >
              <p className="text-sm text-slate-500 font-medium">
                Showing{" "}
                <span className="font-bold text-slate-800">
                  {filtered.length}
                </span>{" "}
                of{" "}
                <span className="font-bold text-slate-800">
                  {COMPANIES.length}
                </span>{" "}
                companies
                {hasFilters && (
                  <span className="text-indigo-500"> (filtered)</span>
                )}
              </p>
              {hasFilters && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={clearAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  <X size={12} /> Clear all
                </motion.button>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Grid */}
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-28 gap-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <Building2 size={28} className="text-slate-300" />
                </div>
                <div className="text-center">
                  <p
                    className="font-semibold text-slate-700 text-base mb-1"
                    style={{ fontFamily: "'Fraunces', serif" }}
                  >
                    No companies found
                  </p>
                  <p className="text-sm text-slate-400">
                    Try a different search or clear filters
                  </p>
                </div>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-100 transition-colors"
                >
                  <Sparkles size={13} /> Clear filters
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                <AnimatePresence>
                  {filtered.map((company, i) => (
                    <CompanyCard
                      key={company.id}
                      company={company}
                      index={i}
                      onClick={() => navigate(`/companies/${company.id}`)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </>
  );
};

export default CompaniesPage;
