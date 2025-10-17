import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function TeacherStudents() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchTeacherStudents();
        setStudents(data);
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="My Students" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {students.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Class</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, idx) => (
                <tr key={idx}>
                  <td>{student.id}</td>
                  <td>{student.full_name}</td>
                  <td>{student.class_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No students available.</p>
        )}
      </div>
    </div>
  );
}
