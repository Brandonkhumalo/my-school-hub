import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function TeacherResults() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchTeacherResults();
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
      <Header title="Enter Results" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {results.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th>Student</th>
                <th>Subject</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res, idx) => (
                <tr key={idx}>
                  <td>{res.student_name}</td>
                  <td>{res.subject}</td>
                  <td>{res.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No results available yet.</p>
        )}
      </div>
    </div>
  );
}
