import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Clock,
  ArrowRight,
  BookOpen,
  TrendingUp,
  Tag,
  ChevronRight,
  X,
  Star,
  Eye,
  Heart,
  Bookmark,
  Share2,
  ArrowLeft,
  User,
  Calendar,
  Zap,
  Target,
  Brain,
  Mic,
  Globe,
  Award,
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

  .blog-root { font-family: 'DM Sans', sans-serif; color: var(--c-ink); }
  .blog-root h1, .blog-root h2, .blog-root h3, .blog-root h4 {
    font-family: 'Playfair Display', Georgia, serif;
  }

  .blog-body h2 {
    font-size: 1.5rem; font-weight: 700; margin: 2rem 0 0.75rem;
    color: var(--c-ink); font-family: 'Playfair Display', serif;
  }
  .blog-body h3 {
    font-size: 1.15rem; font-weight: 700; margin: 1.5rem 0 0.5rem;
    color: var(--c-ink);
  }
  .blog-body p { margin-bottom: 1.25rem; line-height: 1.85; color: var(--c-ink-70); }
  .blog-body ul { margin: 0 0 1.25rem 1.5rem; list-style: disc; }
  .blog-body ul li { margin-bottom: 0.4rem; line-height: 1.7; color: var(--c-ink-70); }
  .blog-body strong { color: var(--c-ink); font-weight: 700; }
  .blog-body blockquote {
    border-left: 3px solid var(--c-amber);
    margin: 1.5rem 0; padding: 0.75rem 1.25rem;
    background: var(--c-amber-l); border-radius: 0 12px 12px 0;
    font-style: italic; color: var(--c-ink-70);
  }

  .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

  .search-input::placeholder { color: var(--c-ink-40); }
  .search-input:focus { outline: none; }

  @keyframes readingBar {
    from { width: 0%; } to { width: 100%; }
  }
`;

/* ══════════════════════════════════════════
   Blog Data
══════════════════════════════════════════ */
const CATEGORIES = [
  {
    id: "all",
    label: "All Posts",
    color: "var(--c-slate)",
    bg: "var(--c-ink-12)",
  },
  {
    id: "interview",
    label: "Interview Tips",
    color: "var(--c-rose)",
    bg: "var(--c-rose-l)",
  },
  {
    id: "career",
    label: "Career Growth",
    color: "var(--c-sage)",
    bg: "var(--c-sage-l)",
  },
  {
    id: "ai",
    label: "AI & Tech",
    color: "var(--c-violet)",
    bg: "var(--c-violet-l)",
  },
  {
    id: "salary",
    label: "Salary & Offers",
    color: "var(--c-amber)",
    bg: "var(--c-amber-l)",
  },
  {
    id: "resume",
    label: "Resume & Profile",
    color: "var(--c-sky)",
    bg: "var(--c-sky-l)",
  },
];

const POSTS = [
  {
    id: 1,
    featured: true,
    category: "interview",
    title:
      "The 10 Most Common Behavioral Interview Questions (And How to Actually Answer Them)",
    excerpt:
      "Behavioral questions trip up even seasoned professionals. We break down the STAR method and give you real answer templates for every scenario a top recruiter will throw at you.",
    author: "Priya Nair",
    authorRole: "Senior Recruiter @ Google",
    avatar: "#10b981",
    date: "Mar 4, 2026",
    readTime: "8 min read",
    views: "12.4k",
    likes: 847,
    tags: ["STAR Method", "Behavioral", "Preparation"],
    gradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 60%, #fcd34d 100%)",
    icon: Mic,
    iconColor: "var(--c-amber)",
    body: `
      <h2>Why Behavioral Questions Matter</h2>
      <p>Behavioral interview questions are designed to predict future performance based on past behavior. The logic is simple: <strong>how you acted in the past is the best predictor of how you'll act in the future.</strong></p>
      <p>Yet most candidates treat these as throwaway questions — giving vague, unstructured answers that leave interviewers with nothing concrete to evaluate.</p>
      <blockquote>"Tell me about a time you failed" is not a trap. It's an invitation to demonstrate self-awareness and growth mindset.</blockquote>
      <h2>The STAR Framework (The Right Way)</h2>
      <p>Most people know STAR — Situation, Task, Action, Result. But they get the proportions wrong. Here's how the time should be distributed:</p>
      <ul>
        <li><strong>Situation (10%)</strong> — Set the scene briefly. One or two sentences max.</li>
        <li><strong>Task (10%)</strong> — What were you specifically responsible for?</li>
        <li><strong>Action (60%)</strong> — This is the meat. What did YOU do? Use "I", not "we".</li>
        <li><strong>Result (20%)</strong> — Quantify wherever possible. Numbers stick.</li>
      </ul>
      <h2>The 10 Questions You Must Prepare</h2>
      <h3>1. "Tell me about a time you failed."</h3>
      <p>Pick a real failure — not a humble-brag. Show what you learned and what you changed. Interviewers can spot a fake failure from a mile away.</p>
      <h3>2. "Describe a conflict with a coworker."</h3>
      <p>Focus on the resolution process, not the drama. Show that you can disagree professionally and find common ground.</p>
      <h3>3. "Tell me about a time you led without authority."</h3>
      <p>This tests influence and leadership potential. Talk about persuasion, coalition-building, and achieving results without a title.</p>
      <h2>Practice Makes Perfect</h2>
      <p>The difference between a good answer and a great one is rehearsal. Use Talk2Hire's AI mock interviewer to practice these exact questions with real-time feedback on your pacing, clarity, and content.</p>
    `,
  },
  {
    id: 2,
    featured: false,
    category: "salary",
    title: "How to Negotiate Your Salary (Without Losing the Offer)",
    excerpt:
      "Most candidates leave 10–30% of compensation on the table by not negotiating. Here's the exact script to use when they say 'what are your salary expectations?'",
    author: "Marcus Johnson",
    authorRole: "ML Engineer @ Waymo",
    avatar: "#f59e0b",
    date: "Mar 1, 2026",
    readTime: "6 min read",
    views: "9.1k",
    likes: 631,
    tags: ["Negotiation", "Compensation", "Offers"],
    gradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    icon: TrendingUp,
    iconColor: "var(--c-amber)",
    body: `
      <h2>The Golden Rule: Never Name a Number First</h2>
      <p>The first person to name a number loses negotiating leverage. <strong>Always deflect the salary question back to the employer.</strong></p>
      <blockquote>"I'd love to understand the full compensation structure before discussing specific numbers. What's the budgeted range for this role?"</blockquote>
      <h2>Research Your Market Rate</h2>
      <p>Use multiple sources: Levels.fyi for tech, Glassdoor, LinkedIn Salary, and — critically — Talk2Hire's live salary benchmarks which update weekly from real offer data.</p>
      <h2>The Exact Script</h2>
      <p>When you receive an offer, don't respond immediately. Say: <strong>"Thank you so much — I'm really excited about this opportunity. Can I have 24 hours to review the full package?"</strong></p>
      <p>Then come back with: <strong>"Based on my research and experience, I was expecting something in the [X–Y] range. Is there flexibility there?"</strong></p>
      <h2>Negotiating Beyond Base Salary</h2>
      <ul>
        <li>Signing bonus (easiest to negotiate)</li>
        <li>Equity / RSU vesting schedule</li>
        <li>Remote work flexibility</li>
        <li>Professional development budget</li>
        <li>Start date (extra week = extra PTO)</li>
      </ul>
    `,
  },
  {
    id: 3,
    featured: false,
    category: "ai",
    title: "How AI Is Changing the Hiring Process in 2026",
    excerpt:
      "From AI-powered resume screening to real-time interview analysis, the hiring process looks nothing like it did five years ago. Here's what every job seeker must know.",
    author: "Sarah Chen",
    authorRole: "Senior Engineer @ Stripe",
    avatar: "#6366f1",
    date: "Feb 26, 2026",
    readTime: "7 min read",
    views: "15.2k",
    likes: 1203,
    tags: ["AI", "Hiring Trends", "Technology"],
    gradient: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
    icon: Brain,
    iconColor: "var(--c-violet)",
    body: `
      <h2>The AI Hiring Stack in 2026</h2>
      <p>Today's hiring process involves AI at virtually every stage. Understanding this stack is the first step to gaming it — ethically.</p>
      <h2>ATS: The First Gatekeeper</h2>
      <p>Applicant Tracking Systems now use LLMs to parse resumes. <strong>Keyword stuffing no longer works.</strong> Modern ATS systems understand context — they know "managed a team of 12" is equivalent to "led cross-functional team of twelve engineers."</p>
      <blockquote>Modern ATS isn't looking for keywords anymore. It's evaluating narrative coherence and role-specific signal.</blockquote>
      <h2>Video Interview Analysis</h2>
      <p>Many companies now use AI to analyze facial expressions, speech patterns, and vocabulary complexity in video interviews. Controversial? Yes. Real? Also yes.</p>
      <h2>What This Means For You</h2>
      <ul>
        <li>Tailor your resume language to each job description</li>
        <li>Practice speaking with confidence — AI scores vocal clarity</li>
        <li>Use real examples with quantified outcomes</li>
        <li>Prepare for async video interviews with tools like Talk2Hire</li>
      </ul>
      <h2>The Human Element Remains</h2>
      <p>Despite all the AI, final hiring decisions still involve humans. AI filters; humans decide. Your goal is to pass the AI layer cleanly and shine in the human layer.</p>
    `,
  },
  {
    id: 4,
    featured: false,
    category: "resume",
    title: "The One-Page Resume Myth: When to Break the Rules",
    excerpt:
      "Career coaches have been pushing the one-page rule for decades. In 2026, with AI screening and senior roles, it's more nuanced than that. Here's the actual guidance.",
    author: "Jordan Kim",
    authorRole: "Platform Engineer @ Cloudflare",
    avatar: "#0ea5e9",
    date: "Feb 22, 2026",
    readTime: "5 min read",
    views: "7.8k",
    likes: 492,
    tags: ["Resume", "Job Search", "Career"],
    gradient: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
    icon: BookOpen,
    iconColor: "var(--c-sky)",
    body: `
      <h2>The One-Page Rule Is Dead (Mostly)</h2>
      <p>The one-page resume rule made sense when humans read every resume. Today, ATS parses all pages instantly, and <strong>a truncated resume loses information that could qualify you.</strong></p>
      <h2>When to Use One Page</h2>
      <ul>
        <li>Under 5 years of experience</li>
        <li>Applying to startup roles</li>
        <li>Recent graduates</li>
        <li>Pivoting industries (streamline the narrative)</li>
      </ul>
      <h2>When Two Pages Is Correct</h2>
      <ul>
        <li>5+ years of relevant experience</li>
        <li>Senior or staff-level engineering roles</li>
        <li>Roles at FAANG/large companies</li>
        <li>Academic or research-heavy backgrounds</li>
      </ul>
      <blockquote>Your resume should be as long as it needs to be to tell a compelling story — and not one word longer.</blockquote>
      <h2>The Non-Negotiable Format Rules</h2>
      <p>Whatever the length: clean fonts, consistent spacing, bullet points starting with strong action verbs, quantified achievements, and zero typos. These aren't optional.</p>
    `,
  },
  {
    id: 5,
    featured: false,
    category: "career",
    title: "From IC to Manager: The Transition No One Prepares You For",
    excerpt:
      "Making the leap from individual contributor to engineering manager is one of the hardest transitions in tech. Here's an honest guide from people who made it — and some who didn't.",
    author: "Alex Rivera",
    authorRole: "Frontend Engineer @ Vercel",
    avatar: "#ec4899",
    date: "Feb 18, 2026",
    readTime: "10 min read",
    views: "11.3k",
    likes: 934,
    tags: ["Leadership", "Management", "Career Growth"],
    gradient: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
    icon: Target,
    iconColor: "var(--c-sage)",
    body: `
      <h2>The Skills That Got You Here Won't Get You There</h2>
      <p>As an IC, you were rewarded for personal output. As a manager, <strong>your output is the output of your team.</strong> This is a fundamental identity shift that many new managers underestimate.</p>
      <h2>The First 90 Days</h2>
      <p>Don't come in with a change agenda. Spend the first month listening — 1:1s with every team member, understanding the existing dynamics, earning trust before spending it.</p>
      <blockquote>"The biggest mistake new managers make is trying to prove their technical chops. Your job now is to remove blockers and grow people."</blockquote>
      <h2>Common Pitfalls</h2>
      <ul>
        <li><strong>Micromanaging:</strong> Trust is built in increments. Give autonomy early.</li>
        <li><strong>Staying in the code:</strong> The more you code, the less you're managing.</li>
        <li><strong>Avoiding hard conversations:</strong> Performance issues don't resolve themselves.</li>
        <li><strong>Not managing up:</strong> Your relationship with your own manager matters hugely.</li>
      </ul>
      <h2>Interview Prep for Management Roles</h2>
      <p>Management interviews test a completely different skillset: conflict resolution, performance management, roadmap prioritization, and cross-functional influence. Practice these with Talk2Hire's leadership-focused question sets.</p>
    `,
  },
  {
    id: 6,
    featured: false,
    category: "interview",
    title: "System Design Interviews: The Complete 2026 Framework",
    excerpt:
      "System design interviews separate senior from staff engineers. Master the framework every top company uses and never blank on a whiteboard question again.",
    author: "Priya Nair",
    authorRole: "Senior Recruiter @ Google",
    avatar: "#10b981",
    date: "Feb 14, 2026",
    readTime: "12 min read",
    views: "18.7k",
    likes: 1589,
    tags: ["System Design", "Engineering", "Senior Roles"],
    gradient: "linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)",
    icon: Zap,
    iconColor: "var(--c-rose)",
    body: `
      <h2>The 6-Step System Design Framework</h2>
      <p>Top companies like Google, Meta, and Amazon use a consistent evaluation rubric for system design. Here's the framework that maps to it exactly.</p>
      <h3>Step 1: Clarify Requirements (5 min)</h3>
      <p>Never start designing. Start by asking: scale, users, read/write ratio, consistency requirements, latency SLA. Show you think before you build.</p>
      <h3>Step 2: Back-of-the-Envelope Estimation (5 min)</h3>
      <p>Rough numbers: DAU, requests/sec, storage requirements. This guides every architecture decision.</p>
      <h3>Step 3: High-Level Design (10 min)</h3>
      <p>Draw the boxes: clients, load balancers, servers, databases, caches. Don't go deep yet — show the whole picture first.</p>
      <h3>Step 4: Deep Dive (20 min)</h3>
      <p>The interviewer will direct you here. Expect to go deep on the database schema, the caching strategy, or the message queue design.</p>
      <h3>Step 5: Bottlenecks & Trade-offs (5 min)</h3>
      <p>Proactively identify what breaks at scale. What would you do differently with 10× the load? Show you think in trade-offs, not absolutes.</p>
      <h3>Step 6: Wrap-Up</h3>
      <p>Summarize what you built and why. Mention what you'd improve given more time.</p>
      <blockquote>The goal of a system design interview is not to produce a perfect design. It's to demonstrate how you think through ambiguous, complex problems.</blockquote>
    `,
  },
];

/* ══════════════════════════════════════════
   Shared primitives
══════════════════════════════════════════ */
const GridTexture = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage:
        "linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px)",
      backgroundSize: "52px 52px",
      opacity: 0.38,
    }}
  />
);

const CornerGlow = () => (
  <>
    <div
      className="absolute top-0 right-0 w-125 h-125 rounded-full pointer-events-none"
      style={{
        background:
          "radial-gradient(circle at 80% 15%, #fef3c7 0%, #fde68a 25%, transparent 65%)",
        opacity: 0.55,
        filter: "blur(80px)",
      }}
    />
    <div
      className="absolute top-1/2 left-0 w-87.5 h-87.5 rounded-full pointer-events-none"
      style={{
        background: "radial-gradient(circle, #ede9fe 0%, transparent 70%)",
        opacity: 0.28,
        filter: "blur(90px)",
      }}
    />
  </>
);

const CategoryPill = ({ cat, active, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.96 }}
    className="px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-widest cursor-pointer shrink-0 transition-all duration-200"
    style={{
      background: active ? cat.color : "var(--c-white)",
      borderColor: active ? cat.color : "var(--c-border)",
      color: active ? "#fff" : "var(--c-ink-70)",
      boxShadow: active ? "var(--sh-md)" : "var(--sh-sm)",
    }}
  >
    {cat.label}
  </motion.button>
);

const ReadingTime = ({ time }) => (
  <span
    className="flex items-center gap-1 text-[11px]"
    style={{ color: "var(--c-ink-40)" }}
  >
    <Clock size={10} /> {time}
  </span>
);

const ViewCount = ({ views }) => (
  <span
    className="flex items-center gap-1 text-[11px]"
    style={{ color: "var(--c-ink-40)" }}
  >
    <Eye size={10} /> {views}
  </span>
);

/* ══════════════════════════════════════════
   Featured Post Card
══════════════════════════════════════════ */
const FeaturedCard = ({ post, onRead }) => {
  const Icon = post.icon;
  const cat = CATEGORIES.find((c) => c.id === post.category);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5 }}
      onClick={() => onRead(post)}
      className="group relative overflow-hidden rounded-3xl border cursor-pointer"
      style={{
        background: "var(--c-white)",
        borderColor: "var(--c-border)",
        boxShadow: "var(--sh-lg)",
      }}
    >
      {/* Gradient banner */}
      <div
        className="h-48 sm:h-56 relative overflow-hidden"
        style={{ background: post.gradient }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <motion.div
          className="absolute right-8 top-1/2 -translate-y-1/2 w-24 h-24 rounded-3xl flex items-center justify-center border"
          style={{
            background: "rgba(255,255,255,0.8)",
            borderColor: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(10px)",
            boxShadow: "var(--sh-lg)",
          }}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Icon size={38} style={{ color: post.iconColor }} />
        </motion.div>
        {/* Featured badge */}
        <div
          className="absolute top-5 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            boxShadow: "var(--sh-sm)",
          }}
        >
          <Star size={10} className="fill-amber-400 text-amber-400" />
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--c-ink)" }}
          >
            Featured
          </span>
        </div>
      </div>

      <div className="p-7">
        {/* Category + meta */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
            style={{ background: cat?.bg, color: cat?.color }}
          >
            {cat?.label}
          </span>
          <ReadingTime time={post.readTime} />
          <ViewCount views={post.views} />
        </div>

        <h2
          className="text-xl sm:text-2xl font-bold leading-snug mb-3 group-hover:text-(--c-slate) transition-colors line-clamp-2"
          style={{ color: "var(--c-ink)" }}
        >
          {post.title}
        </h2>
        <p
          className="text-sm leading-relaxed mb-5 line-clamp-2"
          style={{ color: "var(--c-ink-70)" }}
        >
          {post.excerpt}
        </p>

        {/* Author + CTA */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: post.avatar }}
            >
              {post.author[0]}
            </div>
            <div>
              <p
                className="text-xs font-bold"
                style={{ color: "var(--c-ink)" }}
              >
                {post.author}
              </p>
              <p className="text-[10px]" style={{ color: "var(--c-ink-40)" }}>
                {post.date}
              </p>
            </div>
          </div>
          <motion.div
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl"
            style={{ background: "var(--c-slate)", color: "#fff" }}
            whileHover={{ gap: "0.5rem" }}
          >
            Read Article <ArrowRight size={13} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════
   Regular Post Card
══════════════════════════════════════════ */
const PostCard = ({ post, index, onRead }) => {
  const cat = CATEGORIES.find((c) => c.id === post.category);
  const Icon = post.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{
        delay: index * 0.08,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -6, boxShadow: "var(--sh-lg)" }}
      onClick={() => onRead(post)}
      className="group relative overflow-hidden rounded-3xl border cursor-pointer flex flex-col"
      style={{
        background: "var(--c-white)",
        borderColor: "var(--c-border)",
        boxShadow: "var(--sh-sm)",
        transition: "box-shadow 0.3s",
      }}
    >
      {/* Mini gradient header */}
      <div
        className="h-24 relative overflow-hidden flex items-center justify-between px-6"
        style={{ background: post.gradient }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center border relative z-10"
          style={{
            background: "rgba(255,255,255,0.8)",
            borderColor: "rgba(255,255,255,0.5)",
          }}
        >
          <Icon size={18} style={{ color: post.iconColor }} />
        </div>
        <span
          className="relative z-10 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
          style={{ background: "rgba(255,255,255,0.85)", color: cat?.color }}
        >
          {cat?.label}
        </span>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3
          className="font-bold text-base leading-snug mb-2.5 line-clamp-2 group-hover:text-var(--c-slate) transition-colors"
          style={{ color: "var(--c-ink)" }}
        >
          {post.title}
        </h3>
        <p
          className="text-sm leading-relaxed mb-4 line-clamp-3 flex-1"
          style={{ color: "var(--c-ink-70)" }}
        >
          {post.excerpt}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold"
              style={{
                background: "var(--c-cream)",
                color: "var(--c-ink-70)",
                border: "1px solid var(--c-border)",
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-4 border-t"
          style={{ borderColor: "var(--c-border)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
              style={{ backgroundColor: post.avatar }}
            >
              {post.author[0]}
            </div>
            <div>
              <p
                className="text-[11px] font-semibold leading-none"
                style={{ color: "var(--c-ink)" }}
              >
                {post.author}
              </p>
              <p
                className="text-[10px] mt-0.5"
                style={{ color: "var(--c-ink-40)" }}
              >
                {post.date}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ReadingTime time={post.readTime} />
            <ViewCount views={post.views} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════
   Article Reader
══════════════════════════════════════════ */
const ArticleReader = ({ post, onBack, relatedPosts }) => {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const cat = CATEGORIES.find((c) => c.id === post.category);
  const Icon = post.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen"
      style={{ background: "var(--c-white)" }}
    >
      {/* Reading progress bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-0.5"
        style={{ background: "var(--c-border)" }}
      >
        <motion.div
          className="h-full"
          style={{
            background:
              "linear-gradient(90deg, var(--c-amber), var(--c-amber-2))",
          }}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 45, ease: "linear" }}
        />
      </div>

      {/* Sticky top bar */}
      <div
        className="sticky top-0 z-40 border-b"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          borderColor: "var(--c-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <motion.button
            onClick={onBack}
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 text-sm font-semibold cursor-pointer"
            style={{ color: "var(--c-ink-70)" }}
          >
            <ArrowLeft size={16} /> Back to Blog
          </motion.button>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setLiked(!liked)}
              whileTap={{ scale: 0.88 }}
              className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-all"
              style={{
                background: liked ? "var(--c-rose-l)" : "var(--c-white)",
                borderColor: liked ? "var(--c-rose)" : "var(--c-border)",
                color: liked ? "var(--c-rose)" : "var(--c-ink-40)",
              }}
            >
              <Heart size={15} fill={liked ? "currentColor" : "none"} />
            </motion.button>
            <motion.button
              onClick={() => setBookmarked(!bookmarked)}
              whileTap={{ scale: 0.88 }}
              className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-all"
              style={{
                background: bookmarked ? "var(--c-amber-l)" : "var(--c-white)",
                borderColor: bookmarked ? "var(--c-amber)" : "var(--c-border)",
                color: bookmarked ? "var(--c-amber)" : "var(--c-ink-40)",
              }}
            >
              <Bookmark size={15} fill={bookmarked ? "currentColor" : "none"} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              className="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer"
              style={{
                background: "var(--c-white)",
                borderColor: "var(--c-border)",
                color: "var(--c-ink-40)",
              }}
            >
              <Share2 size={15} />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Article header */}
        <div className="mb-12">
          {/* Category */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest mb-6"
              style={{ background: cat?.bg, color: cat?.color }}
            >
              <Tag size={10} /> {cat?.label}
            </span>
          </motion.div>

          <motion.h1
            className="leading-[1.1] tracking-tight mb-6"
            style={{
              fontSize: "clamp(28px, 4.5vw, 48px)",
              fontWeight: 900,
              color: "var(--c-ink)",
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.15,
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {post.title}
          </motion.h1>

          <motion.p
            className="text-lg leading-relaxed mb-8"
            style={{ color: "var(--c-ink-70)", fontWeight: 300 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            {post.excerpt}
          </motion.p>

          {/* Meta bar */}
          <motion.div
            className="flex flex-wrap items-center gap-5 py-5 border-y"
            style={{ borderColor: "var(--c-border)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: post.avatar }}
              >
                {post.author[0]}
              </div>
              <div>
                <p
                  className="text-sm font-bold"
                  style={{ color: "var(--c-ink)" }}
                >
                  {post.author}
                </p>
                <p className="text-xs" style={{ color: "var(--c-ink-40)" }}>
                  {post.authorRole}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--c-ink-40)" }}
              >
                <Calendar size={11} /> {post.date}
              </span>
              <ReadingTime time={post.readTime} />
              <ViewCount views={post.views} />
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--c-ink-40)" }}
              >
                <Heart size={10} /> {liked ? post.likes + 1 : post.likes}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Gradient hero banner */}
        <motion.div
          className="rounded-3xl overflow-hidden mb-14 relative flex items-center justify-center"
          style={{ background: post.gradient, height: "240px" }}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center border relative z-10"
            style={{
              background: "rgba(255,255,255,0.85)",
              borderColor: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(10px)",
              boxShadow: "var(--sh-lg)",
            }}
          >
            <Icon size={38} style={{ color: post.iconColor }} />
          </div>
        </motion.div>

        {/* Article body */}
        <motion.div
          className="blog-body text-base"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          dangerouslySetInnerHTML={{ __html: post.body }}
        />

        {/* Tags */}
        <div
          className="flex flex-wrap gap-2 mt-12 pt-8 border-t"
          style={{ borderColor: "var(--c-border)" }}
        >
          {post.tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold"
              style={{
                background: "var(--c-cream)",
                borderColor: "var(--c-border)",
                color: "var(--c-ink-70)",
              }}
            >
              <Tag size={10} /> {t}
            </span>
          ))}
        </div>

        {/* Author card */}
        <motion.div
          className="mt-10 p-7 rounded-3xl border"
          style={{
            background: "var(--c-cream)",
            borderColor: "var(--c-border)",
            boxShadow: "var(--sh-sm)",
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-4 mb-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold"
              style={{ backgroundColor: post.avatar }}
            >
              {post.author[0]}
            </div>
            <div>
              <p className="font-bold" style={{ color: "var(--c-ink)" }}>
                {post.author}
              </p>
              <p className="text-sm" style={{ color: "var(--c-ink-40)" }}>
                {post.authorRole}
              </p>
            </div>
          </div>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--c-ink-70)" }}
          >
            A seasoned professional sharing real-world insights to help
            candidates navigate the modern job market with confidence.
          </p>
        </motion.div>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-16">
            <h3
              className="text-2xl font-bold mb-6"
              style={{ color: "var(--c-ink)" }}
            >
              Related Articles
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {relatedPosts.map((rp, i) => {
                const rc = CATEGORIES.find((c) => c.id === rp.category);
                return (
                  <motion.div
                    key={rp.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 + i * 0.08 }}
                    whileHover={{ y: -4 }}
                    onClick={() => onBack(rp)}
                    className="p-5 rounded-2xl border cursor-pointer group"
                    style={{
                      background: "var(--c-white)",
                      borderColor: "var(--c-border)",
                      boxShadow: "var(--sh-sm)",
                    }}
                  >
                    <span
                      className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-3"
                      style={{ background: rc?.bg, color: rc?.color }}
                    >
                      {rc?.label}
                    </span>
                    <h4
                      className="font-bold text-sm leading-snug mb-2 group-hover:text-var(--c-slate) transition-colors line-clamp-2"
                      style={{ color: "var(--c-ink)" }}
                    >
                      {rp.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <ReadingTime time={rp.readTime} />
                      <ViewCount views={rp.views} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════
   Main Blog
══════════════════════════════════════════ */
const Blog = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activePost, setActivePost] = useState(null);

  const featured = POSTS.find((p) => p.featured);
  const rest = POSTS.filter((p) => !p.featured);

  const filtered = useMemo(() => {
    let posts =
      activeCategory === "all"
        ? rest
        : rest.filter((p) => p.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return posts;
  }, [activeCategory, searchQuery]);

  const relatedPosts = activePost
    ? POSTS.filter(
        (p) => p.id !== activePost.id && p.category === activePost.category,
      ).slice(0, 2)
    : [];

  const handleRead = (post) => {
    setActivePost(post);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = (redirectPost = null) => {
    if (redirectPost && redirectPost.id) {
      setActivePost(redirectPost);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setActivePost(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <title>
        Blog | Talk2Hire — Career Tips, Interview Prep & Hiring Insights
      </title>
      <meta
        name="description"
        content="Expert career advice, interview tips, salary negotiation guides, and hiring insights from the Talk2Hire team and industry professionals."
      />
      <style>{TOKENS}</style>

      <div className="blog-root">
        <AnimatePresence mode="wait">
          {activePost ? (
            <ArticleReader
              key="reader"
              post={activePost}
              onBack={handleBack}
              relatedPosts={relatedPosts}
            />
          ) : (
            <motion.div
              key="listing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* ══ HERO HEADER ══ */}
              <section
                className="relative overflow-hidden py-24"
                style={{ background: "var(--c-white)" }}
              >
                <GridTexture />
                <CornerGlow />
                <div
                  className="absolute top-8 right-14 w-48 h-48 rounded-full border pointer-events-none"
                  style={{ borderColor: "rgba(217,119,6,0.10)" }}
                />
                <div
                  className="absolute bottom-10 left-8 w-32 h-32 rounded-full border pointer-events-none"
                  style={{ borderColor: "rgba(217,119,6,0.08)" }}
                />

                <div className="relative z-10 mx-auto max-w-7xl px-6">
                  <div className="max-w-2xl">
                    {/* Pill */}
                    <motion.div
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6"
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
                        Talk2Hire Blog
                      </span>
                    </motion.div>

                    <motion.h1
                      className="leading-[1.06] tracking-tight mb-5"
                      style={{
                        fontSize: "clamp(36px, 5.5vw, 64px)",
                        fontWeight: 900,
                        color: "var(--c-ink)",
                      }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.65 }}
                    >
                      Insights to{" "}
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
                        land your
                      </span>
                      <br />
                      dream role.
                    </motion.h1>

                    <motion.p
                      className="text-base leading-relaxed mb-8 max-w-md"
                      style={{ color: "var(--c-ink-70)", fontWeight: 300 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      Expert advice on interviews, salaries, career growth, and
                      the future of hiring — from real professionals.
                    </motion.p>

                    {/* Search bar */}
                    <motion.div
                      className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border max-w-md"
                      style={{
                        background: "var(--c-white)",
                        borderColor: "var(--c-border)",
                        boxShadow: "var(--sh-md)",
                      }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      whileFocusWithin={{
                        borderColor: "var(--c-amber)",
                        boxShadow:
                          "0 0 0 3px rgba(217,119,6,0.10), var(--sh-md)",
                      }}
                    >
                      <Search
                        size={16}
                        style={{ color: "var(--c-ink-40)", flexShrink: 0 }}
                      />
                      <input
                        className="search-input flex-1 bg-transparent text-sm"
                        style={{
                          color: "var(--c-ink)",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                        placeholder="Search articles, topics, tags..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <motion.button
                          onClick={() => setSearchQuery("")}
                          whileTap={{ scale: 0.9 }}
                          className="cursor-pointer"
                          style={{ color: "var(--c-ink-40)" }}
                        >
                          <X size={14} />
                        </motion.button>
                      )}
                    </motion.div>
                  </div>

                  {/* Stats row */}
                  <motion.div
                    className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t"
                    style={{ borderColor: "var(--c-border)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {[
                      { value: `${POSTS.length}`, label: "Articles" },
                      { value: "6", label: "Categories" },
                      { value: "50k+", label: "Monthly readers" },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span
                          className="text-lg font-black"
                          style={{
                            fontFamily: "'Playfair Display', serif",
                            color: "var(--c-ink)",
                          }}
                        >
                          {s.value}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--c-ink-40)" }}
                        >
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                </div>
              </section>

              {/* ══ CATEGORY FILTER ══ */}
              <div
                className="sticky top-0 z-30 border-b py-4"
                style={{
                  background: "rgba(255,255,255,0.94)",
                  backdropFilter: "blur(20px)",
                  borderColor: "var(--c-border)",
                }}
              >
                <div className="mx-auto max-w-7xl px-6">
                  <div
                    className="flex items-center gap-2.5 overflow-x-auto pb-1"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {CATEGORIES.map((cat) => (
                      <CategoryPill
                        key={cat.id}
                        cat={cat}
                        active={activeCategory === cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* ══ CONTENT ══ */}
              <section
                className="py-16 relative"
                style={{ background: "var(--c-cream)" }}
              >
                <div
                  className="absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, var(--c-border) 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                  }}
                />

                <div className="relative mx-auto max-w-7xl px-6">
                  {/* Featured post — only show in "all" with no search */}
                  {activeCategory === "all" && !searchQuery && featured && (
                    <div className="mb-10">
                      <div className="flex items-center gap-2 mb-5">
                        <Star
                          size={14}
                          className="fill-amber-400 text-amber-400"
                        />
                        <span
                          className="text-xs font-bold uppercase tracking-widest"
                          style={{ color: "var(--c-amber)" }}
                        >
                          Editor's Pick
                        </span>
                      </div>
                      <FeaturedCard post={featured} onRead={handleRead} />
                    </div>
                  )}

                  {/* All other posts */}
                  <AnimatePresence mode="wait">
                    {filtered.length > 0 ? (
                      <motion.div
                        key={activeCategory + searchQuery}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {(activeCategory !== "all" || searchQuery) && (
                          <div className="flex items-center justify-between mb-6">
                            <p
                              className="text-sm font-semibold"
                              style={{ color: "var(--c-ink-70)" }}
                            >
                              {filtered.length} article
                              {filtered.length !== 1 ? "s" : ""} found
                            </p>
                            {searchQuery && (
                              <span
                                className="text-xs px-3 py-1 rounded-full"
                                style={{
                                  background: "var(--c-amber-l)",
                                  color: "var(--c-amber)",
                                }}
                              >
                                "{searchQuery}"
                              </span>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {filtered.map((post, i) => (
                            <PostCard
                              key={post.id}
                              post={post}
                              index={i}
                              onRead={handleRead}
                            />
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-24 text-center"
                      >
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                          style={{ background: "var(--c-amber-l)" }}
                        >
                          <BookOpen
                            size={26}
                            style={{ color: "var(--c-amber)" }}
                          />
                        </div>
                        <h3
                          className="text-xl font-bold mb-2"
                          style={{ color: "var(--c-ink)" }}
                        >
                          No articles found
                        </h3>
                        <p
                          className="text-sm"
                          style={{ color: "var(--c-ink-70)" }}
                        >
                          Try a different search or category.
                        </p>
                        <motion.button
                          onClick={() => {
                            setSearchQuery("");
                            setActiveCategory("all");
                          }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.96 }}
                          className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                          style={{
                            background: "var(--c-white)",
                            borderColor: "var(--c-border)",
                            color: "var(--c-ink-70)",
                          }}
                        >
                          Clear filters
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              {/* ══ CTA BANNER ══ */}
              <section
                className="relative py-24 overflow-hidden"
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
                  className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-125 h-87.5 rounded-full blur-[160px] opacity-20"
                  style={{ backgroundColor: "var(--c-amber)" }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="relative text-center px-6"
                >
                  <div
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6"
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
                      Put it into practice
                    </span>
                  </div>
                  <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tight leading-[1.06]">
                    Ready to ace your
                    <br />
                    next interview?
                  </h2>
                  <p className="text-white/50 mb-8 max-w-md mx-auto text-base">
                    Everything you've read here — practice it for real with
                    Talk2Hire's AI interview simulator.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <motion.button
                      onClick={() => navigate("/interview")}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-bold text-sm rounded-xl"
                      style={{
                        background: "var(--c-white)",
                        color: "var(--c-slate)",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      Start Practicing <ArrowRight size={14} />
                    </motion.button>
                    <motion.button
                      onClick={() => navigate("/jobs")}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-semibold text-sm rounded-xl border text-white"
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        borderColor: "rgba(255,255,255,0.2)",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      Browse Jobs
                    </motion.button>
                  </div>
                </motion.div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default Blog;
