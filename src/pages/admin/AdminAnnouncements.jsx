import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchAnnouncements();
        setAnnouncements(data);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Announcements" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {announcements.length > 0 ? (
          <ul className="space-y-4">
            {announcements.map((announcement, idx) => (
              <li key={idx} className="border-b pb-2">
                <h4 className="font-semibold">{announcement.title}</h4>
                <p>{announcement.message}</p>
                <span className="text-gray-500 text-sm">{announcement.date_posted}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No announcements available.</p>
        )}
      </div>
    </div>
  );
}
