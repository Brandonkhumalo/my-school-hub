import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { formatDateTime } from "../../utils/dateFormat";

export default function HRMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", scheduled_at: "", location: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    apiService.getMeetings()
      .then(setMeetings)
      .catch(() => setError("Failed to load meetings"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiService.createMeeting(form);
      setSuccess("Meeting scheduled.");
      setShowForm(false);
      setForm({ title: "", description: "", scheduled_at: "", location: "" });
      load();
    } catch {
      setError("Failed to schedule meeting");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this meeting?")) return;
    try {
      await apiService.deleteMeeting(id);
      load();
    } catch {
      setError("Failed to delete meeting");
    }
  };

  const isUpcoming = (dt) => new Date(dt) >= new Date();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Meetings</h1>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          + Schedule Meeting
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-3">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-3">{success}</div>}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {meetings.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No meetings scheduled</div>
          ) : meetings.map((m) => (
            <div key={m.id} className="bg-white rounded-lg shadow p-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-800">{m.title}</h3>
                  {isUpcoming(m.scheduled_at) && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Upcoming</span>
                  )}
                </div>
                {m.description && <p className="text-sm text-gray-600 mb-1">{m.description}</p>}
                <p className="text-xs text-gray-500">
                  <i className="fas fa-clock mr-1"></i>
                  {formatDateTime(m.scheduled_at)}
                  {m.location && <span className="ml-3"><i className="fas fa-map-marker-alt mr-1"></i>{m.location}</span>}
                </p>
              </div>
              <button onClick={() => handleDelete(m.id)}
                className="text-red-400 hover:text-red-600 ml-4 text-sm">
                <i className="fas fa-trash"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
            <button onClick={() => setShowForm(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <h2 className="text-lg font-bold mb-4">Schedule Meeting</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Title *</label>
                <input required className="border rounded w-full p-2 text-sm"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Description</label>
                <textarea rows={2} className="border rounded w-full p-2 text-sm"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Date & Time *</label>
                <input required type="datetime-local" className="border rounded w-full p-2 text-sm"
                  value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Location</label>
                <input className="border rounded w-full p-2 text-sm"
                  value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <button type="submit"
                className="w-full bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700">
                Schedule
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
