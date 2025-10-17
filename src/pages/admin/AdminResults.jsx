import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminResults() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchResults();
        setResults(data);
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Results" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {results.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th>Student</th>
                <th>Subject</th>
                <th>Exam Type</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => (
                <tr key={idx}>
                  <td>{result.student_name}</td>
                  <td>{result.subject_name}</td>
                  <td>{result.exam_type}</td>
                  <td>{result.score}/{result.max_score}</td>
                  <td>{result.percentage}%</td>
                  <td>{result.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No results available.</p>
        )}
      </div>
    </div>
  );
}
