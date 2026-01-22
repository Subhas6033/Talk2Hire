import { useState } from "react";
import { Button } from "../Components";

const PreviousInterview = () => {
  // Sample data for previous interviews
  const [history, setHistory] = useState([
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

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = history.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(history.length / itemsPerPage);

  return (
    <div className="p-6 rounded-2xl shadow-lg border border-white/10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold text-lg">
          Previous Interviews
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Responsive table wrapper */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-center text-white/80">
          <thead className="border-b border-white/20 text-white/70">
            <tr>
              <th className="py-2 px-3">SL No.</th>
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Total Time Taken</th>
              <th className="py-2 px-3">Attempted</th>
              <th className="py-2 px-3">Total Questions</th>
              <th className="py-2 px-3">Accuracy</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item) => (
              <tr
                key={item.slNo}
                className="border-b border-white/10 hover:bg-white/5 transition"
              >
                <td className="py-2 px-3">{item.slNo}</td>
                <td className="py-2 px-3">{item.date}</td>
                <td className="py-2 px-3">{item.totalTime}</td>
                <td className="py-2 px-3">{item.attempted}</td>
                <td className="py-2 px-3">{item.totalQuestions}</td>
                <td className="py-2 px-3">{item.accuracy}</td>
                <td className="py-2 px-3 flex justify-center gap-2">
                  <Button size="sm" variant="secondary">
                    View
                  </Button>
                  <Button size="sm" variant="secondary">
                    Download
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreviousInterview;
