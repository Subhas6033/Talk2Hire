import { useState, useEffect, useRef } from "react";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  .dash-root { font-family: 'DM Sans', sans-serif; }
  .display-font { font-family: 'DM Serif Display', serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes barGrow {
    from { transform: scaleY(0); } to { transform: scaleY(1); }
  }
  @keyframes lineGrow {
    from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; }
  }
  @keyframes countUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    from { background-position: -200% center; }
    to   { background-position: 200% center; }
  }
  .anim-fade-up   { animation: fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both; }
  .anim-fade-in   { animation: fadeIn 0.4s ease both; }
`;

function useCountUp(target, duration = 1400, delay = 0) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          setTimeout(() => {
            const start = performance.now();
            const tick = (now) => {
              const p = Math.min((now - start) / duration, 1);
              const ease = 1 - Math.pow(1 - p, 3);
              setVal(Math.round(ease * target));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }, delay);
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration, delay]);

  return [val, ref];
}

function SparkLine({ data, color = "#6366f1", height = 44 }) {
  const w = 160;
  const max = Math.max(...data),
    min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - 4 - ((v - min) / range) * (height - 10);
    return [x, y];
  });
  const d = pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");
  const area = `${d} L${w},${height} L0,${height} Z`;
  const totalLen = pts.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const dx = p[0] - pts[i - 1][0],
      dy = p[1] - pts[i - 1][1];
    return acc + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient
          id={`grad-${color.replace("#", "")}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace("#", "")})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLen + 10}
        style={{ animation: "lineGrow 1.2s ease both", animationDelay: "0.3s" }}
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="3"
        fill={color}
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  suffix = "",
  sub,
  positive = true,
  spark,
  color,
  delay = 0,
}) {
  const [count, ref] = useCountUp(value, 1200, delay + 200);

  return (
    <div
      ref={ref}
      className="anim-fade-up bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3 hover:border-gray-200 hover:shadow-sm transition-all duration-300"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
          {label}
        </p>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}
        >
          {positive ? "▲" : "▼"} {sub}
        </span>
      </div>
      <div className="display-font text-4xl text-gray-900 leading-none tracking-tight">
        {count.toLocaleString()}
        {suffix}
      </div>
      {spark && <SparkLine data={spark} color={color} height={40} />}
    </div>
  );
}

const USERS = [
  {
    name: "Sarah Chen",
    role: "Candidate",
    plan: null,
    status: "Active",
    init: "SC",
    time: "2h ago",
  },
  {
    name: "Marcus Johnson",
    role: "Candidate",
    plan: null,
    status: "Active",
    init: "MJ",
    time: "5h ago",
  },
  {
    name: "Stripe Inc.",
    role: "Company",
    plan: "Enterprise",
    status: "Active",
    init: "ST",
    time: "8h ago",
  },
  {
    name: "Priya Nair",
    role: "Candidate",
    plan: null,
    status: "Inactive",
    init: "PN",
    time: "1d ago",
  },
  {
    name: "Alex Rivera",
    role: "Candidate",
    plan: null,
    status: "Pending",
    init: "AR",
    time: "1d ago",
  },
  {
    name: "Notion",
    role: "Company",
    plan: "Growth",
    status: "Active",
    init: "NO",
    time: "2d ago",
  },
];

const ACTIVITY = [
  {
    label: "New signup",
    name: "Emma Wilson",
    detail: "Candidate account created",
    color: "bg-indigo-500",
    time: "3m",
  },
  {
    label: "Plan upgraded",
    name: "Stripe Inc.",
    detail: "Moved to Enterprise plan",
    color: "bg-violet-500",
    time: "18m",
  },
  {
    label: "Post published",
    name: "Admin",
    detail: "Blog: AI in Modern Hiring",
    color: "bg-cyan-500",
    time: "1h",
  },
  {
    label: "Interviews done",
    name: "System",
    detail: "48 sessions completed today",
    color: "bg-emerald-500",
    time: "2h",
  },
  {
    label: "Account flagged",
    name: "Priya Nair",
    detail: "Unusual login activity detected",
    color: "bg-amber-500",
    time: "3h",
  },
  {
    label: "Job posted",
    name: "Atlassian",
    detail: "4 new engineering roles live",
    color: "bg-rose-500",
    time: "5h",
  },
];

const WEEK = [
  { day: "M", val: 42 },
  { day: "T", val: 67 },
  { day: "W", val: 55 },
  { day: "T", val: 89 },
  { day: "F", val: 73 },
  { day: "S", val: 31 },
  { day: "S", val: 48 },
];

const PLANS = [
  { name: "Enterprise", n: 42, pct: 28, color: "#6366f1" },
  { name: "Growth", n: 76, pct: 51, color: "#8b5cf6" },
  { name: "Starter", n: 30, pct: 21, color: "#e5e7eb" },
];

const COUNTRIES = [
  { flag: "🇺🇸", name: "United States", pct: 44 },
  { flag: "🇮🇳", name: "India", pct: 22 },
  { flag: "🇬🇧", name: "United Kingdom", pct: 14 },
  { flag: "🇩🇪", name: "Germany", pct: 9 },
  { flag: "🇨🇦", name: "Canada", pct: 7 },
];

function StatusPill({ status }) {
  const map = {
    Active: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Inactive: "bg-gray-50 text-gray-500 border-gray-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-100",
    Enterprise: "bg-indigo-50 text-indigo-700 border-indigo-100",
    Growth: "bg-violet-50 text-violet-700 border-violet-100",
    Starter: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? "bg-gray-100 text-gray-500"}`}
    >
      {status}
    </span>
  );
}

function InitAvatar({ init, size = 8 }) {
  const palette = [
    ["bg-indigo-100", "text-indigo-700"],
    ["bg-violet-100", "text-violet-700"],
    ["bg-cyan-100", "text-cyan-700"],
    ["bg-emerald-100", "text-emerald-700"],
    ["bg-amber-100", "text-amber-700"],
    ["bg-rose-100", "text-rose-700"],
  ];
  const [bg, txt] = palette[init.charCodeAt(0) % palette.length];
  return (
    <span
      className={`w-${size} h-${size} rounded-full ${bg} ${txt} flex items-center justify-center text-xs font-bold shrink-0`}
    >
      {init}
    </span>
  );
}

function SectionCard({
  title,
  sub,
  action,
  children,
  delay = 0,
  className = "",
}) {
  return (
    <div
      className={`anim-fade-up bg-white rounded-2xl border border-gray-100 p-6 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {action && (
          <button className="text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
            {action} →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const AdminDashboard = () => {
  const [period, setPeriod] = useState("7d");
  const maxBar = Math.max(...WEEK.map((w) => w.val));

  return (
    <div className="dash-root min-h-screen bg-[#f8f9fb] p-5 sm:p-7 lg:p-9">
      <style>{STYLES}</style>

      {/* Header */}
      <div className="anim-fade-up flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">
            Overview
          </p>
          <h1 className="display-font text-3xl sm:text-4xl text-gray-900 leading-none">
            Good morning, Admin.
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-200 p-1">
          {["24h", "7d", "30d", "90d"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === p
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Users"
          value={2841}
          sub="12% this week"
          positive
          spark={[8, 12, 10, 15, 18, 14, 20, 22, 19, 25, 23, 30]}
          color="#6366f1"
          delay={60}
        />
        <StatCard
          label="Companies"
          value={148}
          sub="8% this week"
          positive
          spark={[2, 3, 3, 4, 5, 4, 6, 7, 6, 8, 7, 9]}
          color="#8b5cf6"
          delay={120}
        />
        <StatCard
          label="Active Jobs"
          value={394}
          sub="21% this week"
          positive
          spark={[5, 8, 6, 10, 9, 13, 11, 15, 12, 17, 14, 19]}
          color="#06b6d4"
          delay={180}
        />
        <StatCard
          label="Blog Posts"
          value={36}
          sub="2 this week"
          positive={false}
          spark={[12, 10, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19]}
          color="#f43f5e"
          delay={240}
        />
      </div>

      {/* Middle row */}
      <div className="grid lg:grid-cols-5 gap-6 mb-6">
        {/* Bar chart */}
        <SectionCard
          title="Weekly Screenings"
          sub="Candidates interviewed per day"
          action="Full report"
          delay={300}
          className="lg:col-span-3"
        >
          <div className="flex items-end gap-2 h-36 mb-3">
            {WEEK.map((w, i) => {
              const pct = w.val / maxBar;
              const isToday = i === 3;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                >
                  {isToday && (
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                      {w.val}
                    </span>
                  )}
                  <div
                    className="w-full relative"
                    style={{ height: `${pct * 100}%` }}
                  >
                    <div
                      className={`w-full h-full rounded-xl origin-bottom ${isToday ? "bg-indigo-500" : "bg-gray-100 hover:bg-indigo-200"} transition-colors duration-200`}
                      style={{
                        animation: `barGrow 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 70 + 300}ms both`,
                      }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-medium ${isToday ? "text-indigo-600 font-bold" : "text-gray-400"}`}
                  >
                    {w.day}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 pt-4 border-t border-gray-50 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />{" "}
              Today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-100 inline-block" />{" "}
              Previous
            </span>
            <span className="ml-auto">Updated just now</span>
          </div>
        </SectionCard>

        {/* Plan breakdown */}
        <SectionCard
          title="Plan Breakdown"
          sub="Subscription distribution"
          delay={360}
          className="lg:col-span-2"
        >
          <div className="space-y-5 mb-6">
            {PLANS.map(({ name, n, pct, color }, i) => (
              <div key={name}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-gray-700 flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ background: color }}
                    />
                    {name}
                  </span>
                  <span className="text-gray-400">
                    {n} · <b className="text-gray-600">{pct}%</b>
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      background: color,
                      width: `${pct}%`,
                      animation: `lineGrow 0.8s ease ${500 + i * 100}ms both`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Top regions
          </p>
          <div className="space-y-2.5">
            {COUNTRIES.map(({ flag, name, pct }) => (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="text-sm w-5">{flag}</span>
                <span className="flex-1 text-gray-600 truncate">{name}</span>
                <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-gray-500 font-medium w-6 text-right">
                  {pct}%
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent users table */}
        <SectionCard
          title="Recent Activity"
          sub="Latest user & company signups"
          action="Manage all"
          delay={420}
          className="lg:col-span-3"
        >
          <div className="divide-y divide-gray-50">
            {USERS.map((u, i) => (
              <div
                key={u.name}
                className="flex items-center gap-3 py-3 group hover:bg-gray-50 -mx-2 px-2 rounded-xl transition-colors"
                style={{ animation: `fadeUp 0.4s ease ${480 + i * 50}ms both` }}
              >
                <InitAvatar init={u.init} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {u.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {u.role}
                    {u.plan ? ` · ${u.plan}` : ""}
                  </p>
                </div>
                <StatusPill status={u.status} />
                <span className="text-xs text-gray-400 hidden sm:block w-12 text-right shrink-0">
                  {u.time}
                </span>
                <button className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-all p-1 rounded-lg hover:bg-white">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-3.5 h-3.5"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Live activity feed */}
        <SectionCard
          title="Live Feed"
          sub="Platform events in real-time"
          action="View log"
          delay={480}
          className="lg:col-span-2"
        >
          <div className="space-y-1">
            {ACTIVITY.map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-default"
                style={{ animation: `fadeUp 0.4s ease ${540 + i * 55}ms both` }}
              >
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.color}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {a.label}
                    </span>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400">{a.time}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-800">
                    {a.name}
                  </p>
                  <p className="text-xs text-gray-400 leading-snug">
                    {a.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default AdminDashboard;
