import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { formatDate, formatDateLong, formatRelative } from "../../utils/dateFormat";

function ParentConferences() {
  const [children, setChildren] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Booking form
  const [bookingSlotId, setBookingSlotId] = useState(null);
  const [bookingStudentId, setBookingStudentId] = useState("");
  const [bookingPurpose, setBookingPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [childrenData, bookingsData, teachersData] = await Promise.all([
          apiService.getParentChildren(),
          apiService.getParentConferences(),
          apiService.searchTeachers(""),
        ]);
        setChildren(Array.isArray(childrenData) ? childrenData : childrenData.results || []);
        setBookings(Array.isArray(bookingsData) ? bookingsData : bookingsData.results || []);

        const teacherArr = Array.isArray(teachersData) ? teachersData : teachersData.results || [];
        setTeachers(teacherArr);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleTeacherSelect = async (teacherId) => {
    setSelectedTeacher(teacherId);
    setAvailableSlots([]);
    if (!teacherId) return;

    setSlotsLoading(true);
    try {
      const data = await apiService.getAvailableConferenceSlots(teacherId);
      setAvailableSlots(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleBookSlot = async (e) => {
    e.preventDefault();
    if (!bookingSlotId || !bookingStudentId) {
      setError("Please select a student");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await apiService.bookConference({
        slot_id: bookingSlotId,
        student_id: bookingStudentId,
        purpose: bookingPurpose,
      });
      setSuccess("Conference booked successfully!");
      setBookingSlotId(null);
      setBookingStudentId("");
      setBookingPurpose("");
      // Refresh both slots and bookings
      if (selectedTeacher) handleTeacherSelect(selectedTeacher);
      const bookingsData = await apiService.getParentConferences();
      setBookings(Array.isArray(bookingsData) ? bookingsData : bookingsData.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!confirm("Cancel this conference booking?")) return;
    try {
      await apiService.cancelConference(bookingId);
      setSuccess("Conference cancelled");
      const bookingsData = await apiService.getParentConferences();
      setBookings(Array.isArray(bookingsData) ? bookingsData : bookingsData.results || []);
      if (selectedTeacher) handleTeacherSelect(selectedTeacher);
    } catch (err) {
      setError(err.message);
    }
  };

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

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Book a Conference */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Book a Conference</h2>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Select Teacher</label>
              <select
                value={selectedTeacher}
                onChange={(e) => handleTeacherSelect(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">-- Choose a teacher --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.full_name || `${t.first_name} ${t.last_name}`}
                  </option>
                ))}
              </select>
              {teachers.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  No teachers found. Teacher data is loaded from your children's profiles.
                </p>
              )}
            </div>

            {slotsLoading && <p className="text-gray-400 text-sm">Loading available slots...</p>}

            {!slotsLoading && selectedTeacher && availableSlots.length === 0 && (
              <p className="text-gray-400 text-sm">No available slots for this teacher.</p>
            )}

            {!slotsLoading && availableSlots.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {availableSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`border rounded-lg p-4 cursor-pointer transition ${
                      bookingSlotId === slot.id
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                    onClick={() => setBookingSlotId(slot.id)}
                  >
                    <p className="font-medium text-gray-800">{formatDateLong(slot.date)}</p>
                    <p className="text-sm text-gray-500">{slot.start_time} - {slot.end_time}</p>
                    <p className="text-xs text-gray-400 mt-1">{slot.teacher_name}</p>
                  </div>
                ))}
              </div>
            )}

            {bookingSlotId && (
              <form onSubmit={handleBookSlot} className="mt-4 space-y-3 border-t pt-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Select Child</label>
                  <select
                    value={bookingStudentId}
                    onChange={(e) => setBookingStudentId(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  >
                    <option value="">-- Choose a child --</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.full_name || `${c.first_name} ${c.last_name}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Purpose (optional)</label>
                  <textarea
                    value={bookingPurpose}
                    onChange={(e) => setBookingPurpose(e.target.value)}
                    rows={2}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="e.g. Discuss academic progress"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 text-sm"
                >
                  {submitting ? "Booking..." : "Book Conference"}
                </button>
              </form>
            )}
          </div>

          {/* My Bookings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              <i className="fas fa-list mr-2"></i>
              My Bookings ({bookings.length})
            </h2>
            {bookings.length === 0 ? (
              <p className="text-gray-400 text-sm">No conference bookings yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">Teacher</th>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">Date</th>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">Time</th>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">Student</th>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">Purpose</th>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{b.teacher_name}</td>
                        <td className="px-4 py-3">{formatDate(b.date)}</td>
                        <td className="px-4 py-3">{b.start_time} - {b.end_time}</td>
                        <td className="px-4 py-3">{b.student_name}</td>
                        <td className="px-4 py-3 max-w-xs truncate">{b.purpose || "-"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                              b.status === "confirmed"
                                ? "bg-green-100 text-green-700"
                                : b.status === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : b.status === "completed"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {b.status === "confirmed" && (
                            <button
                              onClick={() => handleCancel(b.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ParentConferences;
