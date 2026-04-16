import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

const FREQUENCIES = ["daily", "weekly", "monthly"];

export default function HRCleaningSchedules() {
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split("T")[0]);
  const [form, setForm] = useState({
    area_name: "",
    assigned_to: "",
    frequency: "daily",
    scheduled_time: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [scheduleData, cleanerData, taskData] = await Promise.all([
        apiService.getCleaningSchedules(),
        apiService.getStaffList({ position: "cleaner" }),
        apiService.getCleaningTasks({ date: taskDate }),
      ]);
      setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
      setCleaners(Array.isArray(cleanerData) ? cleanerData : []);
      setTasks(Array.isArray(taskData) ? taskData : []);
    } catch (error) {
      console.error("Failed to load cleaning schedules", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [taskDate]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await apiService.createCleaningSchedule({
        ...form,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      });
      setForm({ area_name: "", assigned_to: "", frequency: "daily", scheduled_time: "", notes: "" });
      load();
    } catch (error) {
      alert(error.message || "Failed to create schedule");
    }
  };

  const toggleActive = async (schedule) => {
    try {
      await apiService.updateCleaningSchedule(schedule.id, { is_active: !schedule.is_active });
      load();
    } catch (error) {
      alert(error.message || "Failed to update schedule");
    }
  };

  return (
    <div>
      <Header title="HR Cleaning Schedules" />
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Create Schedule</h3>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input required className="border rounded px-3 py-2" placeholder="Area name" value={form.area_name} onChange={(e) => setForm({ ...form, area_name: e.target.value })} />
            <select className="border rounded px-3 py-2" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Assign cleaner</option>
              {cleaners.map((cleaner) => (
                <option key={cleaner.id} value={cleaner.id}>{cleaner.full_name || cleaner.user?.email}</option>
              ))}
            </select>
            <select className="border rounded px-3 py-2" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>{frequency}</option>
              ))}
            </select>
            <input type="time" className="border rounded px-3 py-2" value={form.scheduled_time} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} />
            <input className="md:col-span-2 border rounded px-3 py-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="md:col-span-3 bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">Create Schedule</button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Schedules</h3>
          {loading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Area</th>
                    <th className="text-left px-3 py-2">Cleaner</th>
                    <th className="text-left px-3 py-2">Frequency</th>
                    <th className="text-left px-3 py-2">Time</th>
                    <th className="text-left px-3 py-2">Active</th>
                    <th className="text-left px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="px-3 py-2">{schedule.area_name}</td>
                      <td className="px-3 py-2">{schedule.assigned_to_name || "Unassigned"}</td>
                      <td className="px-3 py-2 capitalize">{schedule.frequency}</td>
                      <td className="px-3 py-2">{schedule.scheduled_time || "-"}</td>
                      <td className="px-3 py-2">{schedule.is_active ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        <button className="text-blue-600 hover:text-blue-800" onClick={() => toggleActive(schedule)}>
                          {schedule.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {schedules.length === 0 && <p className="text-center py-6 text-gray-500">No cleaning schedules yet.</p>}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Task Completion</h3>
            <input type="date" className="border rounded px-3 py-2" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Area</th>
                  <th className="text-left px-3 py-2">Cleaner</th>
                  <th className="text-left px-3 py-2">Done</th>
                  <th className="text-left px-3 py-2">Completed At</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-3 py-2">{task.schedule_area_name}</td>
                    <td className="px-3 py-2">{task.assigned_to_name || "Unassigned"}</td>
                    <td className="px-3 py-2">{task.is_done ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{task.completed_at || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tasks.length === 0 && <p className="text-center py-6 text-gray-500">No tasks for selected date.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
