import { useEffect, useState } from "react";
import { motion } from "motion/react";

const clamp = (val, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Math.round(val ?? 0)));

const scoreColor = (s) =>
  s >= 75 ? "#22c55e" : s >= 55 ? "#f59e0b" : "#ef4444";

const scoreBgClass = (s) =>
  s >= 75
    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
    : s >= 55
      ? "bg-amber-50 text-amber-600 border-amber-200"
      : "bg-red-50 text-red-500 border-red-200";

/* ── Animated bar ────────────────────────────────────────────────────────── */
function AnimBar({ value, color, delay = 0 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      style={{
        height: 7,
        background: "#e2e8f0",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <motion.div
        style={{ height: "100%", borderRadius: 4, background: color }}
        initial={{ width: 0 }}
        animate={ready ? { width: `${value}%` } : { width: 0 }}
        transition={{ duration: 0.85, delay, ease: "easeOut" }}
      />
    </div>
  );
}

/* ── Radar chart ─────────────────────────────────────────────────────────── */
function RadarChart({ data, size = 200 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 180);
    return () => clearTimeout(t);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.33;
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
        fill="rgba(99,102,241,0.14)"
        stroke="#6366f1"
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ scale: 0, transformOrigin: `${cx}px ${cy}px` }}
        animate={ready ? { scale: 1 } : { scale: 0 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
      />
      {dataPoints.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill="#6366f1"
          stroke="white"
          strokeWidth={1.5}
          initial={{ opacity: 0, scale: 0 }}
          animate={ready ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.55 + i * 0.06, duration: 0.25 }}
        />
      ))}
      {data.map((d, i) => {
        const lp = pt(i, r + 22);
        const anchor =
          lp.x < cx - 6 ? "end" : lp.x > cx + 6 ? "start" : "middle";
        return (
          <text
            key={i}
            x={lp.x}
            y={lp.y + 4}
            textAnchor={anchor}
            fontSize={10}
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
            y={p.y - 8}
            textAnchor="middle"
            fontSize={8}
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

/* ── Semi-circle gauge ───────────────────────────────────────────────────── */
function ScoreGauge({ score, size = 130 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  const r = (size - 14) / 2;
  const circ = Math.PI * r;
  const color = scoreColor(score);
  const label = score >= 75 ? "Strong hire" : score >= 55 ? "Maybe" : "Not yet";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <svg width={size} height={size / 2 + 14} style={{ overflow: "visible" }}>
        <path
          d={`M7,${size / 2} A${r},${r} 0 0 1 ${size - 7},${size / 2}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={9}
          strokeLinecap="round"
        />
        <motion.path
          d={`M7,${size / 2} A${r},${r} 0 0 1 ${size - 7},${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={
            ready ? { strokeDashoffset: circ - (score / 100) * circ } : {}
          }
          transition={{ duration: 1.0, ease: "easeOut", delay: 0.15 }}
        />
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          fontSize={size * 0.19}
          fontWeight={800}
          fill={color}
          fontFamily="sans-serif"
        >
          {score}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 12}
          textAnchor="middle"
          fontSize={9}
          fontWeight={500}
          fill="#94a3b8"
          fontFamily="sans-serif"
        >
          / 100
        </text>
      </svg>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          background: `${color}18`,
          padding: "2px 10px",
          borderRadius: 20,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Per-question bar group ──────────────────────────────────────────────── */
function QuestionBars({ answers }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  const DIMS = [
    { key: "score", label: "Overall", color: "#6366f1" },
    { key: "correctness", label: "Correct", color: "#14b8a6" },
    { key: "depth", label: "Depth", color: "#8b5cf6" },
    { key: "clarity", label: "Clarity", color: "#f59e0b" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {answers.map((a, qi) => (
        <div
          key={a.id ?? qi}
          style={{
            background: "#f8fafc",
            borderRadius: 14,
            padding: "16px 18px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
              gap: 8,
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                flex: 1,
                lineHeight: 1.4,
              }}
            >
              Q{qi + 1}.{" "}
              {a.question?.length > 80
                ? a.question.slice(0, 80) + "…"
                : a.question}
            </p>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 ${scoreBgClass(a.score)}`}
            >
              {a.score}/100
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px 16px",
            }}
          >
            {DIMS.map((d) => {
              const val = clamp(a[d.key] ?? 0);
              return (
                <div key={d.key}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      {d.label}
                    </span>
                    <span
                      style={{ fontSize: 10, fontWeight: 700, color: d.color }}
                    >
                      {val}%
                    </span>
                  </div>
                  <AnimBar
                    value={val}
                    color={d.color}
                    delay={qi * 0.04 + 0.1}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main tab component ──────────────────────────────────────────────────── */
const InterviewPerformanceTab = ({ interview }) => {
  const { answers = [], score, strengths, improvements, summary } = interview;

  const overallScore = clamp(score);

  const evaluated = answers.filter((a) => a.score != null && a.score > 0);

  const avgCorrectness = evaluated.length
    ? Math.round(
        evaluated.reduce((s, a) => s + clamp(a.correctness ?? a.score), 0) /
          evaluated.length,
      )
    : clamp(overallScore * 0.92);

  const avgDepth = evaluated.length
    ? Math.round(
        evaluated.reduce((s, a) => s + clamp(a.depth ?? a.score * 0.85), 0) /
          evaluated.length,
      )
    : clamp(overallScore * 0.85);

  const avgClarity = evaluated.length
    ? Math.round(
        evaluated.reduce((s, a) => s + clamp(a.clarity ?? a.score * 0.9), 0) /
          evaluated.length,
      )
    : clamp(overallScore * 0.9);

  const radarData = [
    { label: "Score", value: overallScore },
    { label: "Correctness", value: avgCorrectness },
    { label: "Depth", value: avgDepth },
    { label: "Clarity", value: avgClarity },
    { label: "Consistency", value: clamp(overallScore * 0.8) },
  ];

  const hireDecision =
    overallScore >= 75 ? "YES" : overallScore >= 55 ? "MAYBE" : "NO";
  const hireColor =
    hireDecision === "YES"
      ? "#22c55e"
      : hireDecision === "MAYBE"
        ? "#f59e0b"
        : "#ef4444";
  const expLevel =
    avgDepth >= 70 && avgCorrectness >= 70
      ? "Advanced"
      : avgDepth >= 50 && avgCorrectness >= 50
        ? "Intermediate"
        : "Beginner";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Overall score",
            value: `${overallScore}%`,
            color: scoreColor(overallScore),
          },
          {
            label: "Correctness",
            value: `${avgCorrectness}%`,
            color: "#14b8a6",
          },
          { label: "Depth", value: `${avgDepth}%`, color: "#8b5cf6" },
          { label: "Clarity", value: `${avgClarity}%`, color: "#f59e0b" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: "#f8fafc",
              borderRadius: 12,
              padding: "12px 16px",
              borderLeft: `3px solid ${item.color}`,
              border: `1px solid #e2e8f0`,
              borderLeftWidth: 3,
              borderLeftColor: item.color,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: 700,
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: item.color,
                lineHeight: 1,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 14,
            padding: "18px 20px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: "#94a3b8",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              alignSelf: "flex-start",
            }}
          >
            Hire decision
          </p>
          <ScoreGauge score={overallScore} size={130} />
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: hireColor,
                background: `${hireColor}15`,
                border: `1px solid ${hireColor}30`,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {hireDecision}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#6366f1",
                background: "#eef2ff",
                border: "1px solid #e0e7ff",
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {expLevel}
            </span>
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            borderRadius: 14,
            padding: "18px 20px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <p
            style={{
              fontSize: 10,
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
          <RadarChart data={radarData} size={190} />
        </div>

        <div
          style={{
            background: "#f8fafc",
            borderRadius: 14,
            padding: "18px 20px",
            border: "1px solid #e2e8f0",
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: "#94a3b8",
              fontWeight: 700,
              marginBottom: 14,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Dimension breakdown
          </p>
          {[
            { label: "Correctness", value: avgCorrectness, color: "#14b8a6" },
            { label: "Depth", value: avgDepth, color: "#8b5cf6" },
            { label: "Clarity", value: avgClarity, color: "#f59e0b" },
            {
              label: "Consistency",
              value: clamp(overallScore * 0.8),
              color: "#6366f1",
            },
          ].map((item, i) => (
            <div key={item.label} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}
                >
                  {item.label}
                </span>
                <span
                  style={{ fontSize: 11, fontWeight: 700, color: item.color }}
                >
                  {item.value}%
                </span>
              </div>
              <AnimBar value={item.value} color={item.color} delay={i * 0.08} />
            </div>
          ))}
        </div>
      </div>

      {evaluated.length > 0 && (
        <div>
          <p
            style={{
              fontSize: 10,
              color: "#94a3b8",
              fontWeight: 700,
              marginBottom: 14,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Per-question breakdown
          </p>
          <QuestionBars answers={evaluated} />
        </div>
      )}

      {summary && (
        <div
          style={{
            background: "linear-gradient(135deg,#eef2ff,#f5f3ff)",
            borderRadius: 14,
            padding: "16px 18px",
            border: "1px solid #e0e7ff",
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: "#6366f1",
              fontWeight: 700,
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            AI summary
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#475569",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {summary}
          </p>
        </div>
      )}
    </div>
  );
};

export default InterviewPerformanceTab;
