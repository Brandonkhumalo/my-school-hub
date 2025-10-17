import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchSubjects = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchSubjects();
        setSubjects(data);
      } catch (error) {
        console.error("Error fetching subjects:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Subjects" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {subjects.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Teacher</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject, idx) => (
                <tr key={idx}>
                  <td>{subject.id}</td>
                  <td>{subject.name}</td>
                  <td>{subject.teacher_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No subjects available.</p>
        )}
      </div>
    </div>
  );
}
