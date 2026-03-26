import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../context/AuthContext";
import { formatDate, formatDateTime } from "../../utils/dateFormat";

const ACTIVITY_TYPES = [
  { value: "sport", label: "Sport" },
  { value: "club", label: "Club" },
  { value: "society", label: "Society" },
  { value: "arts", label: "Arts" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const EVENT_TYPES = [
  { value: "practice", label: "Practice" },
  { value: "match", label: "Match" },
  { value: "competition", label: "Competition" },
  { value: "performance", label: "Performance" },
  { value: "meeting", label: "Meeting" },
];

const ROLE_CHOICES = [
  { value: "member", label: "Member" },
  { value: "captain", label: "Captain" },
  { value: "vice_captain", label: "Vice Captain" },
];

const ACCOLADE_CATEGORIES = [
  { value: "academic", label: "Academic" },
  { value: "sports", label: "Sports" },
  { value: "conduct", label: "Conduct" },
  { value: "attendance", label: "Attendance" },
  { value: "extracurricular", label: "Extracurricular" },
  { value: "leadership", label: "Leadership" },
];

const ACCOLADE_ICONS = [
  "fa-trophy", "fa-medal", "fa-star", "fa-award", "fa-crown",
  "fa-certificate", "fa-ribbon", "fa-gem", "fa-shield-alt", "fa-flag",
];

export default function AdminActivities() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("activities");

  // Activities state
  const [activities, setActivities] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [activityForm, setActivityForm] = useState({
    name: "", activity_type: "sport", description: "", coach: "",
    schedule_day: "", schedule_time: "", location: "", max_participants: 30,
  });

  // Enrollment state
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ student_id: "", role: "member" });

  // Events state
  const [eventsActivity, setEventsActivity] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "", event_type: "practice", event_date: "", location: "",
    opponent: "", result: "", notes: "",
  });

  // Accolades state
  const [accolades, setAccolades] = useState([]);
  const [showAccoladeForm, setShowAccoladeForm] = useState(false);
  const [accoladeForm, setAccoladeForm] = useState({
    name: "", description: "", icon: "fa-trophy", category: "academic", points_value: 10,
  });

  // Award state
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [awardForm, setAwardForm] = useState({
    accolade_id: "", student_id: "", reason: "", academic_term: "", academic_year: "",
  });

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [activitiesData, teachersData, studentsData] = await Promise.all([
        apiService.getActivities().catch(() => []),
        apiService.fetchTeachers().catch(() => []),
        apiService.fetchStudents().catch(() => []),
      ]);
      setActivities(Array.isArray(activitiesData) ? activitiesData : []);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch (err) {
      setActivities([]);
      setTeachers([]);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAccolades = async () => {
    try {
      const [accoladesData, leaderboardData] = await Promise.all([
        apiService.getAccolades().catch(() => []),
        apiService.getAccoladeLeaderboard().catch(() => []),
      ]);
      setAccolades(Array.isArray(accoladesData) ? accoladesData : []);
      setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : []);
    } catch (err) {
      setAccolades([]);
      setLeaderboard([]);
    }
  };

  useEffect(() => {
    if (activeTab === "accolades") {
      loadAccolades();
    }
  }, [activeTab]);

  const clearMessages = () => { setError(""); setSuccess(""); };

  // ── Activity CRUD ───────────────────────────────────────────────

  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      const payload = { ...activityForm };
      if (!payload.coach) delete payload.coach;
      if (!payload.schedule_time) delete payload.schedule_time;

      if (editingActivity) {
        await apiService.updateActivity(editingActivity.id, payload);
        setSuccess("Activity updated successfully");
      } else {
        await apiService.createActivity(payload);
        setSuccess("Activity created successfully");
      }
      setShowActivityForm(false);
      setEditingActivity(null);
      setActivityForm({ name: "", activity_type: "sport", description: "", coach: "", schedule_day: "", schedule_time: "", location: "", max_participants: 30 });
      loadData();
    } catch (err) {
      setError(err.message || "Failed to save activity");
    }
  };

  const handleEditActivity = (activity) => {
    setEditingActivity(activity);
    setActivityForm({
      name: activity.name,
      activity_type: activity.activity_type,
      description: activity.description || "",
      coach: activity.coach || "",
      schedule_day: activity.schedule_day || "",
      schedule_time: activity.schedule_time || "",
      location: activity.location || "",
      max_participants: activity.max_participants,
    });
    setShowActivityForm(true);
  };

  const handleDeleteActivity = async (id) => {
    if (!window.confirm("Are you sure you want to delete this activity?")) return;
    clearMessages();
    try {
      await apiService.deleteActivity(id);
      setSuccess("Activity deleted");
      loadData();
    } catch (err) {
      setError(err.message || "Failed to delete activity");
    }
  };

  // ── Enrollments ─────────────────────────────────────────────────

  const loadEnrollments = async (activity) => {
    setSelectedActivity(activity);
    try {
      const data = await apiService.getActivityEnrollments(activity.id);
      setEnrollments(Array.isArray(data) ? data : []);
    } catch (err) {
      setEnrollments([]);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      await apiService.enrollStudent(selectedActivity.id, enrollForm);
      setSuccess("Student enrolled successfully");
      setShowEnrollForm(false);
      setEnrollForm({ student_id: "", role: "member" });
      loadEnrollments(selectedActivity);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to enrol student");
    }
  };

  const handleUnenroll = async (studentId) => {
    if (!window.confirm("Remove this student from the activity?")) return;
    clearMessages();
    try {
      await apiService.unenrollStudent(selectedActivity.id, studentId);
      setSuccess("Student removed");
      loadEnrollments(selectedActivity);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to remove student");
    }
  };

  // ── Events ──────────────────────────────────────────────────────

  const loadEvents = async (activity) => {
    setEventsActivity(activity);
    try {
      const data = await apiService.getActivityEvents(activity.id);
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setEvents([]);
    }
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      await apiService.createActivityEvent(eventsActivity.id, eventForm);
      setSuccess("Event created successfully");
      setShowEventForm(false);
      setEventForm({ title: "", event_type: "practice", event_date: "", location: "", opponent: "", result: "", notes: "" });
      loadEvents(eventsActivity);
    } catch (err) {
      setError(err.message || "Failed to create event");
    }
  };

  // ── Accolades ───────────────────────────────────────────────────

  const handleAccoladeSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      await apiService.createAccolade(accoladeForm);
      setSuccess("Accolade created successfully");
      setShowAccoladeForm(false);
      setAccoladeForm({ name: "", description: "", icon: "fa-trophy", category: "academic", points_value: 10 });
      loadAccolades();
    } catch (err) {
      setError(err.message || "Failed to create accolade");
    }
  };

  const handleAwardSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      await apiService.awardAccolade(awardForm);
      setSuccess("Accolade awarded successfully");
      setShowAwardForm(false);
      setAwardForm({ accolade_id: "", student_id: "", reason: "", academic_term: "", academic_year: "" });
      loadAccolades();
    } catch (err) {
      setError(err.message || "Failed to award accolade");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Activities & Sports" user={user} />
      <div className="p-6">
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
        {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>}

        {/* Tabs */}
        <div className="flex border-b mb-6">
          {["activities", "accolades"].map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); clearMessages(); }}
              className={`px-6 py-3 font-medium capitalize ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              {tab === "activities" ? "Activities" : "Accolades"}
            </button>
          ))}
        </div>

        {/* ── Activities Tab ──────────────────────────────────── */}
        {activeTab === "activities" && (
          <>
            {/* Enrollment modal */}
            {selectedActivity && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">{selectedActivity.name} - Enrollments</h3>
                    <button onClick={() => setSelectedActivity(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                  </div>

                  <button onClick={() => setShowEnrollForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm mb-4 hover:bg-blue-700">
                    <i className="fas fa-plus mr-1"></i> Enrol Student
                  </button>

                  {showEnrollForm && (
                    <form onSubmit={handleEnroll} className="bg-gray-50 p-4 rounded mb-4 space-y-3">
                      <select required value={enrollForm.student_id} onChange={(e) => setEnrollForm({ ...enrollForm, student_id: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm">
                        <option value="">Select Student</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>{s.user?.full_name || `${s.user?.first_name} ${s.user?.last_name}`} ({s.user?.student_number})</option>
                        ))}
                      </select>
                      <select value={enrollForm.role} onChange={(e) => setEnrollForm({ ...enrollForm, role: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm">
                        {ROLE_CHOICES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Enrol</button>
                        <button type="button" onClick={() => setShowEnrollForm(false)} className="bg-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-400">Cancel</button>
                      </div>
                    </form>
                  )}

                  {enrollments.length === 0 ? (
                    <p className="text-gray-500 text-sm">No students enrolled yet.</p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                        <tr>
                          <th className="px-3 py-2 text-left">Student</th>
                          <th className="px-3 py-2 text-left">Class</th>
                          <th className="px-3 py-2 text-left">Role</th>
                          <th className="px-3 py-2 text-left">Joined</th>
                          <th className="px-3 py-2 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {enrollments.map((e) => (
                          <tr key={e.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{e.student_name}</td>
                            <td className="px-3 py-2">{e.class_name}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${e.role === "captain" ? "bg-yellow-100 text-yellow-700" : e.role === "vice_captain" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                                {e.role_display}
                              </span>
                            </td>
                            <td className="px-3 py-2">{formatDate(e.date_joined)}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => handleUnenroll(e.student_id)} className="text-red-600 hover:text-red-800 text-xs">
                                <i className="fas fa-times mr-1"></i>Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Events modal */}
            {eventsActivity && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">{eventsActivity.name} - Events</h3>
                    <button onClick={() => setEventsActivity(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                  </div>

                  <button onClick={() => setShowEventForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm mb-4 hover:bg-blue-700">
                    <i className="fas fa-plus mr-1"></i> Add Event
                  </button>

                  {showEventForm && (
                    <form onSubmit={handleEventSubmit} className="bg-gray-50 p-4 rounded mb-4 grid grid-cols-2 gap-3">
                      <input required placeholder="Event Title" value={eventForm.title}
                        onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                        className="col-span-2 border rounded px-3 py-2 text-sm" />
                      <select value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                        className="border rounded px-3 py-2 text-sm">
                        {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <input required type="datetime-local" value={eventForm.event_date}
                        onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                        className="border rounded px-3 py-2 text-sm" />
                      <input placeholder="Location" value={eventForm.location}
                        onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                        className="border rounded px-3 py-2 text-sm" />
                      <input placeholder="Opponent (if match)" value={eventForm.opponent}
                        onChange={(e) => setEventForm({ ...eventForm, opponent: e.target.value })}
                        className="border rounded px-3 py-2 text-sm" />
                      <input placeholder="Result" value={eventForm.result}
                        onChange={(e) => setEventForm({ ...eventForm, result: e.target.value })}
                        className="border rounded px-3 py-2 text-sm" />
                      <textarea placeholder="Notes" value={eventForm.notes}
                        onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                        className="col-span-2 border rounded px-3 py-2 text-sm" rows={2} />
                      <div className="col-span-2 flex gap-2">
                        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Create Event</button>
                        <button type="button" onClick={() => setShowEventForm(false)} className="bg-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-400">Cancel</button>
                      </div>
                    </form>
                  )}

                  {events.length === 0 ? (
                    <p className="text-gray-500 text-sm">No events yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {events.map((ev) => (
                        <div key={ev.id} className="border rounded p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{ev.title}</h4>
                              <p className="text-xs text-gray-500">{formatDateTime(ev.event_date)} | {ev.event_type_display}</p>
                            </div>
                            {ev.result && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">{ev.result}</span>}
                          </div>
                          {ev.location && <p className="text-sm text-gray-600 mt-1"><i className="fas fa-map-marker-alt mr-1"></i>{ev.location}</p>}
                          {ev.opponent && <p className="text-sm text-gray-600">vs {ev.opponent}</p>}
                          {ev.notes && <p className="text-sm text-gray-500 mt-1">{ev.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Activity Form */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">All Activities ({activities.length})</h2>
              <button onClick={() => { setShowActivityForm(true); setEditingActivity(null); setActivityForm({ name: "", activity_type: "sport", description: "", coach: "", schedule_day: "", schedule_time: "", location: "", max_participants: 30 }); }}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                <i className="fas fa-plus mr-1"></i> New Activity
              </button>
            </div>

            {showActivityForm && (
              <form onSubmit={handleActivitySubmit} className="bg-white rounded-lg shadow p-6 mb-6 grid grid-cols-2 gap-4">
                <input required placeholder="Activity Name" value={activityForm.name}
                  onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })}
                  className="col-span-2 border rounded px-3 py-2 text-sm" />
                <select value={activityForm.activity_type} onChange={(e) => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                  className="border rounded px-3 py-2 text-sm">
                  {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={activityForm.coach} onChange={(e) => setActivityForm({ ...activityForm, coach: e.target.value })}
                  className="border rounded px-3 py-2 text-sm">
                  <option value="">No Coach</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.user?.id || t.id}>{t.user?.full_name || `${t.user?.first_name} ${t.user?.last_name}`}</option>
                  ))}
                </select>
                <select value={activityForm.schedule_day} onChange={(e) => setActivityForm({ ...activityForm, schedule_day: e.target.value })}
                  className="border rounded px-3 py-2 text-sm">
                  <option value="">No Specific Day</option>
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input type="time" value={activityForm.schedule_time}
                  onChange={(e) => setActivityForm({ ...activityForm, schedule_time: e.target.value })}
                  className="border rounded px-3 py-2 text-sm" placeholder="Time" />
                <input placeholder="Location" value={activityForm.location}
                  onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })}
                  className="border rounded px-3 py-2 text-sm" />
                <input type="number" min="1" placeholder="Max Participants" value={activityForm.max_participants}
                  onChange={(e) => setActivityForm({ ...activityForm, max_participants: parseInt(e.target.value) || 30 })}
                  className="border rounded px-3 py-2 text-sm" />
                <textarea placeholder="Description" value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="col-span-2 border rounded px-3 py-2 text-sm" rows={2} />
                <div className="col-span-2 flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                    {editingActivity ? "Update" : "Create"} Activity
                  </button>
                  <button type="button" onClick={() => { setShowActivityForm(false); setEditingActivity(null); }}
                    className="bg-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-400">Cancel</button>
                </div>
              </form>
            )}

            {/* Activities List */}
            {activities.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No activities created yet. Click "New Activity" to get started.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.map((activity) => (
                  <div key={activity.id} className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-gray-800">{activity.name}</h3>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                          activity.activity_type === "sport" ? "bg-green-100 text-green-700" :
                          activity.activity_type === "club" ? "bg-purple-100 text-purple-700" :
                          activity.activity_type === "society" ? "bg-blue-100 text-blue-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>
                          {activity.activity_type_display}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleEditActivity(activity)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button onClick={() => handleDeleteActivity(activity.id)} className="text-red-600 hover:text-red-800 p-1" title="Delete">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>

                    {activity.description && <p className="text-sm text-gray-600 mb-2">{activity.description}</p>}

                    <div className="text-xs text-gray-500 space-y-1">
                      {activity.coach_name && <p><i className="fas fa-user-tie mr-1"></i>Coach: {activity.coach_name}</p>}
                      {activity.schedule_day && <p><i className="fas fa-calendar mr-1"></i>{activity.schedule_day} {activity.schedule_time ? `at ${activity.schedule_time}` : ""}</p>}
                      {activity.location && <p><i className="fas fa-map-marker-alt mr-1"></i>{activity.location}</p>}
                      <p><i className="fas fa-users mr-1"></i>{activity.enrolled_count}/{activity.max_participants} enrolled</p>
                    </div>

                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <button onClick={() => loadEnrollments(activity)}
                        className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100">
                        <i className="fas fa-users mr-1"></i>Members
                      </button>
                      <button onClick={() => loadEvents(activity)}
                        className="text-xs bg-green-50 text-green-600 px-3 py-1 rounded hover:bg-green-100">
                        <i className="fas fa-calendar-alt mr-1"></i>Events
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Accolades Tab ──────────────────────────────────── */}
        {activeTab === "accolades" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Accolades list */}
              <div className="lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Accolades ({accolades.length})</h2>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAwardForm(true)}
                      className="bg-yellow-500 text-white px-4 py-2 rounded text-sm hover:bg-yellow-600">
                      <i className="fas fa-award mr-1"></i> Award
                    </button>
                    <button onClick={() => setShowAccoladeForm(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                      <i className="fas fa-plus mr-1"></i> New Accolade
                    </button>
                  </div>
                </div>

                {/* Create Accolade Form */}
                {showAccoladeForm && (
                  <form onSubmit={handleAccoladeSubmit} className="bg-white rounded-lg shadow p-6 mb-4 grid grid-cols-2 gap-4">
                    <input required placeholder="Accolade Name" value={accoladeForm.name}
                      onChange={(e) => setAccoladeForm({ ...accoladeForm, name: e.target.value })}
                      className="col-span-2 border rounded px-3 py-2 text-sm" />
                    <select value={accoladeForm.category} onChange={(e) => setAccoladeForm({ ...accoladeForm, category: e.target.value })}
                      className="border rounded px-3 py-2 text-sm">
                      {ACCOLADE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <input type="number" min="1" placeholder="Points Value" value={accoladeForm.points_value}
                      onChange={(e) => setAccoladeForm({ ...accoladeForm, points_value: parseInt(e.target.value) || 10 })}
                      className="border rounded px-3 py-2 text-sm" />
                    <select value={accoladeForm.icon} onChange={(e) => setAccoladeForm({ ...accoladeForm, icon: e.target.value })}
                      className="border rounded px-3 py-2 text-sm">
                      {ACCOLADE_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                    </select>
                    <textarea placeholder="Description" value={accoladeForm.description}
                      onChange={(e) => setAccoladeForm({ ...accoladeForm, description: e.target.value })}
                      className="col-span-2 border rounded px-3 py-2 text-sm" rows={2} />
                    <div className="col-span-2 flex gap-2">
                      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Create Accolade</button>
                      <button type="button" onClick={() => setShowAccoladeForm(false)} className="bg-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-400">Cancel</button>
                    </div>
                  </form>
                )}

                {/* Award Form */}
                {showAwardForm && (
                  <form onSubmit={handleAwardSubmit} className="bg-white rounded-lg shadow p-6 mb-4 grid grid-cols-2 gap-4">
                    <h3 className="col-span-2 font-semibold text-gray-800">Award Accolade to Student</h3>
                    <select required value={awardForm.accolade_id} onChange={(e) => setAwardForm({ ...awardForm, accolade_id: e.target.value })}
                      className="border rounded px-3 py-2 text-sm">
                      <option value="">Select Accolade</option>
                      {accolades.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.points_value} pts)</option>)}
                    </select>
                    <select required value={awardForm.student_id} onChange={(e) => setAwardForm({ ...awardForm, student_id: e.target.value })}
                      className="border rounded px-3 py-2 text-sm">
                      <option value="">Select Student</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.user?.full_name || `${s.user?.first_name} ${s.user?.last_name}`}</option>
                      ))}
                    </select>
                    <input placeholder="Academic Term" value={awardForm.academic_term}
                      onChange={(e) => setAwardForm({ ...awardForm, academic_term: e.target.value })}
                      className="border rounded px-3 py-2 text-sm" />
                    <input placeholder="Academic Year" value={awardForm.academic_year}
                      onChange={(e) => setAwardForm({ ...awardForm, academic_year: e.target.value })}
                      className="border rounded px-3 py-2 text-sm" />
                    <textarea placeholder="Reason for award" value={awardForm.reason}
                      onChange={(e) => setAwardForm({ ...awardForm, reason: e.target.value })}
                      className="col-span-2 border rounded px-3 py-2 text-sm" rows={2} />
                    <div className="col-span-2 flex gap-2">
                      <button type="submit" className="bg-yellow-500 text-white px-4 py-2 rounded text-sm hover:bg-yellow-600">Award</button>
                      <button type="button" onClick={() => setShowAwardForm(false)} className="bg-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-400">Cancel</button>
                    </div>
                  </form>
                )}

                {/* Accolades Grid */}
                {accolades.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">No accolades created yet.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {accolades.map((a) => (
                      <div key={a.id} className="bg-white rounded-lg shadow p-4 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                          <i className={`fas ${a.icon} text-yellow-600`}></i>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">{a.name}</h4>
                          <p className="text-xs text-gray-500">{a.category_display} | {a.points_value} points</p>
                          {a.description && <p className="text-sm text-gray-600 mt-1">{a.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Leaderboard */}
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-4"><i className="fas fa-trophy text-yellow-500 mr-2"></i>Leaderboard</h2>
                <div className="bg-white rounded-lg shadow">
                  {leaderboard.length === 0 ? (
                    <p className="p-4 text-gray-400 text-sm text-center">No awards given yet.</p>
                  ) : (
                    <div className="divide-y">
                      {leaderboard.map((entry) => (
                        <div key={entry.student_id} className="p-3 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            entry.rank === 1 ? "bg-yellow-400 text-white" :
                            entry.rank === 2 ? "bg-gray-300 text-white" :
                            entry.rank === 3 ? "bg-orange-400 text-white" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {entry.rank}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-800">{entry.student_name}</p>
                            <p className="text-xs text-gray-500">{entry.award_count} award{entry.award_count !== 1 ? "s" : ""}</p>
                          </div>
                          <span className="font-bold text-blue-600">{entry.total_points} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
