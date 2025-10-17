import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminSuspensions() {
  const [suspensions, setSuspensions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchSuspensions = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchSuspensions();
        setSuspensions(data);
      } catch (error) {
        console.error("Error fetching suspensions:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSuspensions();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Suspensions" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {suspensions.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th>ID</th>
                <th>Student</th>
                <th>Reason</th>
                <th>Start Date</th>
                <th>End Date</th>
              </tr>
            </thead>
            <tbody>
              {suspensions.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.id}</td>
                  <td>{item.student_name}</td>
                  <td>{item.reason}</td>
                  <td>{item.start_date}</td>
                  <td>{item.end_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No suspensions available.</p>
        )}
      </div>
    </div>
  );
}
