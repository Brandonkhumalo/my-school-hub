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
                <th className="p-3">Code</th>
                <th className="p-3">Name</th>
                <th className="p-3">Description</th>
                <th className="p-3">Teacher(s)</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold">{subject.code}</td>
                  <td className="p-3">{subject.name}</td>
                  <td className="p-3 text-gray-600">{subject.description || '-'}</td>
                  <td className="p-3 text-blue-600">{subject.teacher_names}</td>
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
