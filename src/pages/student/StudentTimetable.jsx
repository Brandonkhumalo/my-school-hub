import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function StudentTimetable() {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchTimetable(user.id);
        setTimetable(data);
      } catch (error) {
        console.error("Error fetching timetable:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  if (isLoading) return <LoadingSpinner />;

  const timetableByDay = {};
  days.forEach(day => {
    timetableByDay[day] = timetable.filter(item => item.day_of_week === day);
  });

  return (
    <div>
      <Header title="My Timetable" user={user} />
      {days.map(day => (
        <div key={day} className="mb-6">
          <h3 className="text-lg font-semibold mb-2">{day}</h3>
          <table className="w-full bg-white rounded-lg shadow-sm text-left mb-4">
            <thead className="bg-gray-100">
              <tr>
                <th>Time</th>
                <th>Subject</th>
                <th>Teacher</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {timetableByDay[day].length > 0 ? (
                timetableByDay[day].map((item, index) => (
                  <tr key={index}>
                    <td>{item.start_time} - {item.end_time}</td>
                    <td>{item.subject_name}</td>
                    <td>{item.teacher_name}</td>
                    <td>{item.room}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-2">No classes scheduled</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
