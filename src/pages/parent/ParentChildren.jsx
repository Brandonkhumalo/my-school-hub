import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function ParentChildren() {
  const [children, setChildren] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchChildren = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchParentChildren();
        setChildren(data);
      } catch (error) {
        console.error("Error fetching children:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchChildren();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="My Children" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {children.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th>Name</th>
                <th>Class</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {children.map((child, idx) => (
                <tr key={idx}>
                  <td>{child.full_name}</td>
                  <td>{child.class_name}</td>
                  <td>{child.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No children registered.</p>
        )}
      </div>
    </div>
  );
}
