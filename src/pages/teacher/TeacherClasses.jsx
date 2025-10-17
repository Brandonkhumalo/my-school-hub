import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function TeacherClasses() {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchTeacherClasses();
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
      <Header title="My Classes" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {classes.length > 0 ? (
          <ul>
            {classes.map((cls, idx) => (
              <li key={idx} className="py-2 border-b">
                {cls.name} - {cls.grade}
              </li>
            ))}
          </ul>
        ) : (
          <p>No classes assigned yet.</p>
        )}
      </div>
    </div>
  );
}
