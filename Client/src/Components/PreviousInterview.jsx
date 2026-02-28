import { useState } from "react";
import { Button } from ".";

const PreviousInterview = () => {
  const [history] = useState([
    {
      slNo: 1,
      date: "2026-01-20",
      totalTime: "35m 12s",
      attempted: 25,
      totalQuestions: 30,
      accuracy: "83%",
    },
    {
      slNo: 2,
      date: "2026-01-18",
      totalTime: "28m 45s",
      attempted: 20,
      totalQuestions: 25,
      accuracy: "80%",
    },
    {
      slNo: 3,
      date: "2026-01-15",
      totalTime: "42m 10s",
      attempted: 28,
      totalQuestions: 30,
      accuracy: "93%",
    },
    {
      slNo: 4,
      date: "2026-01-10",
      totalTime: "30m 05s",
      attempted: 22,
      totalQuestions: 25,
      accuracy: "88%",
    },
    {
      slNo: 5,
      date: "2026-01-08",
      totalTime: "36m 45s",
      attempted: 26,
      totalQuestions: 30,
      accuracy: "87%",
    },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = history.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(history.length / itemsPerPage);

  const getAccuracyColor = (accuracy) => {
    const val = parseInt(accuracy);
    if (val >= 90)
      return {
        bar: "from-emerald-400 to-teal-500",
        text: "text-emerald-700",
        bg: "bg-emerald-50 border-emerald-200",
      };
    if (val >= 80)
      return {
        bar: "from-blue-400 to-sky-500",
        text: "text-blue-700",
        bg: "bg-blue-50 border-blue-200",
      };
    return {
      bar: "from-amber-400 to-orange-500",
      text: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
    };
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3"
        style={{
          background: "linear-gradient(90deg, #f5f3ff 0%, #fdf4ff 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">
              Previous Interviews
            </h3>
            <p className="text-xs text-gray-400">
              {history.length} sessions recorded
            </p>
          </div>
        </div>
        {/* Pagination */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium hidden sm:block">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 ${
                  currentPage === page
                    ? "bg-linear-to-br from-violet-500 to-purple-600 text-white shadow-md"
                    : "bg-white border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {[
                "#",
                "Date",
                "Duration",
                "Attempted",
                "Total Q's",
                "Accuracy",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 lg:px-6 py-3.5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest first:pl-5 sm:first:pl-6"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {currentItems.map((item, i) => {
              const acc = getAccuracyColor(item.accuracy);
              return (
                <tr
                  key={item.slNo}
                  className="group hover:bg-gray-50/80 transition-colors duration-150"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <td className="pl-5 sm:pl-6 pr-4 py-4">
                    <div className="w-7 h-7 rounded-lg bg-linear-to-br from-violet-100 to-purple-100 border border-violet-200 flex items-center justify-center">
                      <span className="text-xs font-black text-violet-600">
                        {item.slNo}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      <span className="text-sm font-semibold text-gray-700">
                        {item.date}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="w-3.5 h-3.5 text-sky-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-semibold text-gray-700">
                        {item.totalTime}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <span className="text-sm font-bold text-gray-800">
                      {item.attempted}
                    </span>
                    <span className="text-xs text-gray-400">
                      /{item.totalQuestions}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <span className="text-sm font-semibold text-gray-600">
                      {item.totalQuestions}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 max-w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-linear-to-r ${acc.bar} rounded-full transition-all duration-700`}
                          style={{ width: item.accuracy }}
                        />
                      </div>
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-lg border ${acc.bg} ${acc.text}`}
                      >
                        {item.accuracy}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold rounded-lg border border-violet-200 transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-sm">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        View
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-bold rounded-lg border border-gray-200 transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-sm">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Download
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="sm:hidden p-4 space-y-3">
        {currentItems.map((item, i) => {
          const acc = getAccuracyColor(item.accuracy);
          return (
            <div
              key={item.slNo}
              className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-3 hover:shadow-sm transition-all duration-200"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <span className="text-xs font-black text-white">
                      #{item.slNo}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">
                    {item.date}
                  </span>
                </div>
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-lg border ${acc.bg} ${acc.text}`}
                >
                  {item.accuracy}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Duration", value: item.totalTime, icon: "⏱" },
                  {
                    label: "Attempted",
                    value: `${item.attempted}/${item.totalQuestions}`,
                    icon: "📝",
                  },
                  { label: "Accuracy", value: item.accuracy, icon: "🎯" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white rounded-xl border border-gray-100 p-2.5"
                  >
                    <p className="text-lg">{stat.icon}</p>
                    <p className="text-xs font-black text-gray-800 mt-0.5">
                      {stat.value}
                    </p>
                    <p className="text-[10px] text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Accuracy bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-linear-to-r ${acc.bar} rounded-full`}
                    style={{ width: item.accuracy }}
                  />
                </div>
                <span className="text-xs text-gray-400 font-semibold w-8 text-right">
                  {item.accuracy}
                </span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold rounded-xl border border-violet-200 transition-all duration-200 active:scale-95">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  View
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl border border-gray-200 transition-all duration-200 active:scale-95">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 sm:px-6 py-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Showing {indexOfFirst + 1}–{Math.min(indexOfLast, history.length)} of{" "}
          {history.length}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: totalPages }, (_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${i + 1 === currentPage ? "bg-violet-500 w-4" : "bg-gray-200"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PreviousInterview;
