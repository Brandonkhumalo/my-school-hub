import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function StudentResults() {
  const { user } = useAuth();
  const [performance, setPerformance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchStudentPerformance(user.id);
        setPerformance(data);
      } catch (error) {
        console.error("Error fetching performance:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="My Results" user={user} />
      {performance ? (
        <>
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between">
              <div>
                <p className="text-gray-600">Average Score</p>
                <h3 className="text-3xl font-bold text-blue-600">{performance.average_score}%</h3>
              </div>
              <div>
                <p className="text-gray-600">Overall Grade</p>
                <h3 className="text-3xl font-bold text-green-600">{performance.overall_grade}</h3>
              </div>
              <div>
                <p className="text-gray-600">Total Subjects</p>
                <h3 className="text-3xl font-bold text-orange-600">{performance.total_subjects}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Exam Type</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {performance.results.map((result, index) => (
                  <tr key={index}>
                    <td>{result.subject_name}</td>
                    <td>{result.teacher_name}</td>
                    <td>{result.exam_type}</td>
                    <td>{result.score}/{result.max_score}</td>
                    <td>{result.percentage}%</td>
                    <td>{result.grade}</td>
                    <td>{result.date_recorded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>No results available yet.</p>
      )}
    </div>
  );
}
