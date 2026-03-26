import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { formatDate, formatDateLong } from "../../utils/dateFormat";

function TeacherConferences() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state for creating slots
  const [slotDate, setSlotDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const data = await apiService.getTeacherConferenceSlots();
      setSlots(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!slotDate || !startTime || !endTime) {
      setError("Please fill in all fields");
      return;
    }
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      await apiService.createConferenceSlots({
        slots: [{ date: slotDate, start_time: startTime, end_time: endTime }],
      });
      setSuccess("Time slot created successfully");
      setSlotDate("");
      setStartTime("");
      setEndTime("");
      fetchSlots();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!confirm("Delete this time slot?")) return;
    try {
      await apiService.deleteConferenceSlot(id);
      setSuccess("Slot deleted");
      fetchSlots();
    } catch (err) {
      setError(err.message);
    }
  };

  const bookedSlots = slots.filter((s) => s.is_booked);
  const availableSlots = slots.filter((s) => !s.is_booked);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        <i className="fas fa-calendar-check mr-2 text-blue-600"></i>
        Parent-Teacher Conferences
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError("")} className="float-right font-bold">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
          <button onClick={() => setSuccess("")} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* Create Slot Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Create Available Time Slot</h2>
        <form onSubmit={handleCreateSlot} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={slotDate}
              onChange={(e) => setSlotDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 text-sm"
          >
            {creating ? "Creating..." : "Add Slot"}
          </button>
        </form>
      </div>

      {/* Upcoming Bookings */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          <i className="fas fa-calendar-day mr-2"></i>
          Upcoming Bookings ({bookedSlots.length})
        </h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : bookedSlots.length === 0 ? (
          <p className="text-gray-400 text-sm">No bookings yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Time</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Parent</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Student</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Purpose</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookedSlots.map((slot) => (
                  <tr key={slot.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{formatDateLong(slot.date)}</td>
                    <td className="px-4 py-3">{slot.start_time} - {slot.end_time}</td>
                    <td className="px-4 py-3">{slot.booking?.parent_name || "N/A"}</td>
                    <td className="px-4 py-3">{slot.booking?.student_name || "N/A"}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{slot.booking?.purpose || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 capitalize">
                        {slot.booking?.status || "confirmed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available Slots */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          <i className="fas fa-clock mr-2"></i>
          Available Slots ({availableSlots.length})
        </h2>
        {availableSlots.length === 0 ? (
          <p className="text-gray-400 text-sm">No available slots. Create one above.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableSlots.map((slot) => (
              <div key={slot.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">{formatDate(slot.date)}</p>
                  <p className="text-sm text-gray-500">{slot.start_time} - {slot.end_time}</p>
                </div>
                <button
                  onClick={() => handleDeleteSlot(slot.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                  title="Delete slot"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherConferences;
