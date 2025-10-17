import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchClasses();
        setClasses(data);
      } catch (error) {
        console.error("Error fetching classes:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClasses();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Classes" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {classes.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Grade</th>
                <th>Teacher</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls, idx) => (
                <tr key={idx}>
                  <td>{cls.id}</td>
                  <td>{cls.name}</td>
                  <td>{cls.grade}</td>
                  <td>{cls.teacher_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No classes available.</p>
        )}
      </div>
    </div>
  );
}
