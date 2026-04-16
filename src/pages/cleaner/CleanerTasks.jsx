import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function CleanerTasks() {
  const today = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState(today);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await apiService.getCleaningTasks({ date: dateFilter });
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load cleaning tasks", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [dateFilter]);

  const completeTask = async (taskId, isDone) => {
    try {
      await apiService.completeCleaningTask(taskId, { is_done: isDone });
      loadTasks();
    } catch (error) {
      alert(error.message || "Failed to update task");
    }
  };

  return (
    <div>
      <Header title="Cleaning Tasks" />
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Assigned Tasks</h3>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="border rounded px-3 py-2" />
        </div>

        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Area</th>
                  <th className="text-left px-3 py-2">Frequency</th>
                  <th className="text-left px-3 py-2">Scheduled Time</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-3 py-2">{task.schedule_area_name}</td>
                    <td className="px-3 py-2 capitalize">{task.schedule_frequency}</td>
                    <td className="px-3 py-2">{task.scheduled_time || "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${task.is_done ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {task.is_done ? "Done" : "Pending"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {task.is_done ? (
                        <button onClick={() => completeTask(task.id, false)} className="text-xs px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
                          Reopen
                        </button>
                      ) : (
                        <button onClick={() => completeTask(task.id, true)} className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">
                          Mark Done
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 && <p className="text-center py-6 text-gray-500">No tasks found for this date.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
