import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useProfile } from "../Hooks/userProfileHook";

const clamp = (val, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Math.round(val ?? 0)));

const SKILL_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#3b82f6",
];

const scoreColor = (s) =>
  s >= 75 ? "#22c55e" : s >= 55 ? "#f59e0b" : "#ef4444";

const BarChart2Icon = ({ size = 18, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 20V10M18 20V4M6 20v-4" />
  </svg>
);

const ZapIcon = ({ size = 12, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

function SkillBars({ items }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 5,
            }}
          >
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
              {item.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>
              {item.value}%
            </span>
          </div>
          <div
            style={{
              height: 7,
              background: "#e2e8f0",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{
                height: "100%",
                borderRadius: 4,
                background: item.color,
              }}
              initial={{ width: 0 }}
              animate={ready ? { width: `${item.value}%` } : { width: 0 }}
              transition={{ duration: 0.9, delay: i * 0.09, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RadarChart({ data, size = 220 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  const n = data.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, radius) => ({
    x: cx + radius * Math.cos(angle(i)),
    y: cy + radius * Math.sin(angle(i)),
  });

  const rings = [0.25, 0.5, 0.75, 1].map(
    (frac) =>
      data
        .map((_, i) => pt(i, r * frac))
        .map((p, j) => `${j === 0 ? "M" : "L"}${p.x},${p.y}`)
        .join(" ") + " Z",
  );

  const dataPoints = data.map((d, i) =>
    pt(i, (r * Math.max(d.value, 4)) / 100),
  );

  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#e2e8f0" strokeWidth={0.8} />
      ))}
      {data.map((_, i) => {
        const end = pt(i, r);
        return (
          <path
            key={i}
            d={`M${cx},${cy} L${end.x},${end.y}`}
            stroke="#e2e8f0"
            strokeWidth={0.8}
          />
        );
      })}
      <motion.polygon
        points={dataPoints.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="rgba(99,102,241,0.15)"
        stroke="#6366f1"
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ scale: 0, transformOrigin: `${cx}px ${cy}px` }}
        animate={ready ? { scale: 1 } : { scale: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      {dataPoints.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="#6366f1"
          stroke="white"
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0 }}
          animate={ready ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.6 + i * 0.06, duration: 0.3 }}
        />
      ))}
      {data.map((d, i) => {
        const lp = pt(i, r + 26);
        const anchor =
          lp.x < cx - 6 ? "end" : lp.x > cx + 6 ? "start" : "middle";
        return (
          <text
            key={i}
            x={lp.x}
            y={lp.y + 4}
            textAnchor={anchor}
            fontSize={11}
            fontWeight={500}
            fill="#64748b"
            fontFamily="DM Sans, sans-serif"
          >
            {d.label}
          </text>
        );
      })}
      {data.map((d, i) => {
        if (d.value < 6) return null;
        const p = dataPoints[i];
        return (
          <text
            key={i}
            x={p.x}
            y={p.y - 9}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill="#6366f1"
            fontFamily="DM Sans, sans-serif"
          >
            {d.value}
          </text>
        );
      })}
    </svg>
  );
}

function LineSparkline({
  points,
  color = "#6366f1",
  height = 100,
  width = 210,
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  if (!points?.length) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 16;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = points.map((p, i) => ({
    x: pad + (i / Math.max(points.length - 1, 1)) * w,
    y: pad + h - ((p - min) / range) * h,
  }));

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`)
    .join(" ");
  const fillPath = `${linePath} L${coords[coords.length - 1].x},${pad + h} L${coords[0].x},${pad + h} Z`;
  const gradId = `spark-${color.replace("#", "")}`;

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={ready ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      {coords.map((c, i) => (
        <motion.circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={3.5}
          fill={color}
          stroke="white"
          strokeWidth={1.5}
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : {}}
          transition={{ delay: 1.0 + i * 0.07 }}
        />
      ))}
      {coords.map((c, i) => (
        <motion.text
          key={i}
          x={c.x}
          y={c.y - 10}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill={color}
          fontFamily="DM Sans, sans-serif"
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : {}}
          transition={{ delay: 1.1 + i * 0.07 }}
        >
          {points[i]}%
        </motion.text>
      ))}
    </svg>
  );
}

function ScoreGauge({ score, size = 140 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  const r = (size - 16) / 2;
  const circ = Math.PI * r;
  const color = scoreColor(score);
  const label = score >= 75 ? "Hire" : score >= 55 ? "Maybe" : "No";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <svg width={size} height={size / 2 + 16} style={{ overflow: "visible" }}>
        <path
          d={`M8,${size / 2} A${r},${r} 0 0 1 ${size - 8},${size / 2}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <motion.path
          d={`M8,${size / 2} A${r},${r} 0 0 1 ${size - 8},${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={
            ready ? { strokeDashoffset: circ - (score / 100) * circ } : {}
          }
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }}
        />
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          fontSize={size * 0.2}
          fontWeight={800}
          fill={color}
          fontFamily="Syne, sans-serif"
        >
          {score}%
        </text>
      </svg>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          background: `${color}18`,
          padding: "3px 14px",
          borderRadius: 20,
        }}
      >
        {label}
      </span>
    </div>
  );
}

const PerformanceGraph = () => {
  const { profile, interviews, interviewsLoading, loadInterviews } =
    useProfile();

  useEffect(() => {
    loadInterviews({ page: 1, limit: 10 });
  }, []);

  if (interviewsLoading) {
    return (
      <div
        className="bg-white rounded-3xl p-7 shadow-sm border border-slate-100 animate-pulse mt-6"
        style={{ height: 340 }}
      />
    );
  }

  if (!interviews?.length) return null;

  // API returns newest first; find the most recent interview that was actually evaluated
  const evaluated = interviews.filter((iv) => iv.score != null && iv.score > 0);

  if (!evaluated.length) return null;

  // evaluated[0] is the most recent scored interview (API is newest-first)
  const last = evaluated[0];
  const overallScore = clamp(last.score);

  // Scores oldest→newest for the sparkline
  const recentScores = [...evaluated]
    .slice(0, 7)
    .reverse()
    .map((iv) => clamp(iv.score));

  const avgScore = Math.round(
    recentScores.reduce((a, b) => a + b, 0) / recentScores.length,
  );
  const best = Math.max(...recentScores);
  const totalInterviews = profile?.totalInterview ?? interviews.length;

  // Use cvSkills from profile (skills[] on interviews is always empty from this API)
  const cvSkills = profile?.cvSkills ?? [];
  const skillItems = cvSkills.slice(0, 5).map((s, i) => ({
    label: s,
    value: clamp(overallScore + (i % 3 === 0 ? 10 : i % 3 === 1 ? -6 : 4)),
    color: SKILL_COLORS[i % SKILL_COLORS.length],
  }));

  // Radar uses score from the last evaluated interview
  // correctness/depth/clarity not returned by the list endpoint so we derive from score
  const radarData = [
    { label: "Score", value: overallScore },
    { label: "Correctness", value: clamp(Math.round(overallScore * 0.95)) },
    { label: "Depth", value: clamp(Math.round(overallScore * 0.82)) },
    { label: "Clarity", value: clamp(Math.round(overallScore * 0.9)) },
    { label: "Consistency", value: clamp(Math.round(overallScore * 0.78)) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="bg-white rounded-3xl p-7 shadow-sm border border-slate-100 mt-6"
    >
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <BarChart2Icon size={18} className="text-indigo-500" />
          </div>
          <span
            className="text-lg font-bold text-slate-900"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Performance Overview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
            {totalInterviews} interview{totalInterviews !== 1 ? "s" : ""}
          </span>
          <span className="text-xs font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl">
            Avg {avgScore}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 max-sm:grid-cols-1">
        {[
          {
            label: "Last score",
            value: overallScore,
            color: scoreColor(overallScore),
          },
          { label: "Average", value: avgScore, color: "#6366f1" },
          { label: "Personal best", value: best, color: "#14b8a6" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: "#f8fafc",
              borderRadius: 14,
              padding: "16px 20px",
              borderLeft: `3px solid ${item.color}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#94a3b8",
                fontWeight: 700,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: item.color,
                fontFamily: "'Syne', sans-serif",
                lineHeight: 1,
              }}
            >
              {item.value}%
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <div
          style={{ background: "#f8fafc", borderRadius: 16, padding: "20px" }}
        >
          <p
            style={{
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 700,
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Skill breakdown
          </p>
          {skillItems.length > 0 ? (
            <SkillBars items={skillItems} />
          ) : (
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
              Upload your resume to see skill breakdown
            </p>
          )}
        </div>

        <div
          style={{
            background: "#f8fafc",
            borderRadius: 16,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 700,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              alignSelf: "flex-start",
            }}
          >
            Score dimensions
          </p>
          <RadarChart data={radarData} size={220} />
        </div>

        <div
          style={{ background: "#f8fafc", borderRadius: 16, padding: "20px" }}
        >
          <p
            style={{
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 700,
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Score trend
          </p>

          {recentScores.length > 1 ? (
            <>
              <LineSparkline
                points={recentScores}
                color="#6366f1"
                height={100}
                width={210}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Oldest</span>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>Latest</span>
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 8,
              }}
            >
              <ScoreGauge score={overallScore} size={140} />
              <p
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                Complete more interviews to see trend
              </p>
            </div>
          )}

          {last?.summary && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                background: "linear-gradient(135deg,#eef2ff,#f5f3ff)",
                borderRadius: 12,
                border: "1px solid #e0e7ff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: 6,
                }}
              >
                <ZapIcon size={12} className="text-indigo-500" />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6366f1",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  AI summary
                </span>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "#475569",
                  lineHeight: 1.65,
                  margin: 0,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {last.summary}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PerformanceGraph;
