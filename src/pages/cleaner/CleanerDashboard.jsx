import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function CleanerDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [taskData, attendanceData] = await Promise.all([
        apiService.getCleaningTasks({ date: today }),
        apiService.getStaffAttendance({ date: today }),
      ]);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
    } catch (error) {
      console.error("Cleaner dashboard load failed", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const completeTask = async (taskId) => {
    try {
      await apiService.completeCleaningTask(taskId, { is_done: true });
      load();
    } catch (error) {
      alert(error.message || "Failed to complete task");
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="Cleaner Dashboard" />
        <LoadingSpinner />
      </div>
    );
  }

  const pending = tasks.filter((task) => !task.is_done).length;
  const done = tasks.filter((task) => task.is_done).length;

  return (
    <div>
      <Header title="Cleaner Dashboard" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-500 text-white p-6 rounded-lg shadow">
            <p className="text-sm opacity-90">Pending Tasks Today</p>
            <h3 className="text-3xl font-bold mt-2">{pending}</h3>
          </div>
          <div className="bg-emerald-500 text-white p-6 rounded-lg shadow">
            <p className="text-sm opacity-90">Completed Tasks Today</p>
            <h3 className="text-3xl font-bold mt-2">{done}</h3>
          </div>
          <div className="bg-purple-500 text-white p-6 rounded-lg shadow">
            <p className="text-sm opacity-90">Attendance Entries Today</p>
            <h3 className="text-3xl font-bold mt-2">{attendance.length}</h3>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Quick Task Checklist</h3>
            <Link to="/cleaner/tasks" className="text-blue-600 hover:text-blue-800">View Full Tasks</Link>
          </div>
          <div className="space-y-2">
            {tasks.slice(0, 6).map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium text-gray-800">{task.schedule_area_name}</p>
                  <p className="text-sm text-gray-600">{task.schedule_frequency} {task.scheduled_time ? `- ${task.scheduled_time}` : ""}</p>
                </div>
                {task.is_done ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">Done</span>
                ) : (
                  <button onClick={() => completeTask(task.id)} className="bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 text-sm">
                    Mark Done
                  </button>
                )}
              </div>
            ))}
            {tasks.length === 0 && <p className="text-center text-gray-500 py-4">No tasks assigned for today.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
