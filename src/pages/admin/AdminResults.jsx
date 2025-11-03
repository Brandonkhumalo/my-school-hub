import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminResults() {
  const [averages, setAverages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAverages = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchClassAverages();
        setAverages(data);
      } catch (error) {
        console.error("Error fetching class averages:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAverages();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Class Average Results" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {averages.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">Class</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Exam Type</th>
                <th className="p-3">Avg Score</th>
                <th className="p-3">Percentage</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Students</th>
              </tr>
            </thead>
            <tbody>
              {averages.map((avg, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold text-blue-600">{avg.class_name || 'No Class'}</td>
                  <td className="p-3">{avg.subject_name}</td>
                  <td className="p-3 text-gray-600">{avg.exam_type}</td>
                  <td className="p-3">{avg.average_score.toFixed(1)}/{avg.average_max_score.toFixed(1)}</td>
                  <td className="p-3 font-semibold">{avg.percentage}%</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-white ${
                      avg.grade.startsWith('A') ? 'bg-green-500' :
                      avg.grade.startsWith('B') ? 'bg-blue-500' :
                      avg.grade.startsWith('C') ? 'bg-yellow-500' :
                      avg.grade === 'D' ? 'bg-orange-500' : 'bg-red-500'
                    }`}>
                      {avg.grade}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{avg.student_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <i className="fas fa-chart-bar text-6xl mb-4"></i>
            <p>No class averages available yet.</p>
            <p className="text-sm mt-2">Results will appear here once teachers add student marks.</p>
          </div>
        )}
      </div>
    </div>
  );
}
