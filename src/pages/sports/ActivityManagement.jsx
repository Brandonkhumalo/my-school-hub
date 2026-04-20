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
  { value: "training", label: "Training" },
  { value: "match", label: "Match" },
  { value: "tournament", label: "Tournament" },
  { value: "inter_house", label: "Inter-House" },
];

const AGE_GROUPS = [
  { value: "u13", label: "Under 13" },
  { value: "u14", label: "Under 14" },
  { value: "u15", label: "Under 15" },
  { value: "u16", label: "Under 16" },
  { value: "u17", label: "Under 17" },
  { value: "u20", label: "Under 20" },
  { value: "first_team", label: "First Team" },
  { value: "open", label: "Open/All Ages" },
];

const GENDER_CATEGORIES = [
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
  { value: "mixed", label: "Mixed" },
];

const LEVELS = [
  { value: "inter_house", label: "Inter-house" },
  { value: "inter_school", label: "Inter-school" },
  { value: "social", label: "Social/Recreational" },
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

export default function ActivityManagement() {
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
    name: "", activity_type: "sport",
    age_group: "open", gender_category: "mixed", level: "social",
    description: "", coach: "", assistant_coach: "",
    schedule_day: "", schedule_time: "", location: "", max_participants: 30,
  });

  // Enrollment state
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [enrollments, setEnrollments] = useState([]);

  // Events state
  const [eventsActivity, setEventsActivity] = useState(null);
  const [events, setEvents] = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "", event_type: "training", event_date: "", location: "",
    venue: "", opponent: "", opponent_school: "", is_home: true,
    transport_required: false, status: "scheduled",
    our_score: "", opponent_score: "", match_result: "na", result: "", notes: "",
  });

  const [eventSquad, setEventSquad] = useState([]);
  const [selectedSquadEvent, setSelectedSquadEvent] = useState(null);
  const [showSquadModal, setShowSquadModal] = useState(false);

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
      if (!payload.assistant_coach) delete payload.assistant_coach;
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
      setActivityForm({ name: "", activity_type: "sport", age_group: "open", gender_category: "mixed", level: "social", description: "", coach: "", assistant_coach: "", schedule_day: "", schedule_time: "", location: "", max_participants: 30 });
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
      age_group: activity.age_group || "open",
      gender_category: activity.gender_category || "mixed",
      level: activity.level || "social",
      description: activity.description || "",
      coach: activity.coach || "",
      assistant_coach: activity.assistant_coach || "",
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

  const handleReviewEnrollment = async (enrollmentId, decision) => {
    clearMessages();
    try {
      await apiService.reviewActivityEnrollment(selectedActivity.id, enrollmentId, { decision });
      setSuccess(`Enrollment ${decision}d successfully`);
      loadEnrollments(selectedActivity);
      loadData();
    } catch (err) {
      setError(err.message || `Failed to ${decision} enrollment`);
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

  const handleToggleSuspend = async (enrollment) => {
    let reason = "";
    if (!enrollment.is_suspended) {
        reason = window.prompt("Reason for suspension:");
        if (reason === null) return;
    } else {
        if (!window.confirm(`Unsuspend ${enrollment.student_name}?`)) return;
    }
    
    clearMessages();
    try {
        await apiService.suspendStudentActivity(selectedActivity.id, enrollment.student_id, {
            is_suspended: !enrollment.is_suspended,
            reason: reason
        });
        setSuccess(enrollment.is_suspended ? "Student unsuspended" : "Student suspended");
        loadEnrollments(selectedActivity);
    } catch (err) {
        setError(err.message || "Failed to update suspension status");
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

  const loadEventSquad = async (event) => {
    try {
      const data = await apiService.getEventSquad(event.id);
      setSelectedSquadEvent(event);
      setEventSquad(Array.isArray(data) ? data : []);
      setShowSquadModal(true);
    } catch (err) {
      setError(err.message || "Failed to load squad");
    }
  };

  const handleSquadChange = (studentId, field, value) => {
    setEventSquad((prev) => {
      const existing = prev.find((item) => item.student_id === studentId);
      if (existing) {
        return prev.map((item) => item.student_id === studentId ? { ...item, [field]: value } : item);
      }
      return [...prev, { student_id: studentId, is_captain: field === 'is_captain' ? value : false, played: field === 'played' ? value : true, jersey_number: field === 'jersey_number' ? value : null }];
    });
  };

  const handleSaveSquad = async () => {
    if (!selectedSquadEvent) return;
    clearMessages();
    try {
      const payload = {
        squad: eventSquad.map((entry) => ({
          student_id: entry.student_id,
          is_captain: !!entry.is_captain,
          jersey_number: entry.jersey_number,
          played: !!entry.played,
        })),
      };
      await apiService.updateMatchSquad(selectedSquadEvent.id, payload);
      setSuccess("Match squad saved successfully");
      setShowSquadModal(false);
    } catch (err) {
      setError(err.message || "Failed to save squad");
    }
  };

  const handleToggleSquadMember = (student) => {
    const existing = eventSquad.find((entry) => entry.student_id === student.student_id);
    if (existing) {
      setEventSquad((prev) => prev.filter((entry) => entry.student_id !== student.student_id));
    } else {
      setEventSquad((prev) => [...prev, { student_id: student.student_id, is_captain: false, played: true, jersey_number: null }]);
    }
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    try {
      await apiService.createActivityEvent(eventsActivity.id, eventForm);
      setSuccess("Event created successfully");
      setShowEventForm(false);
      setEventForm({
        title: "", event_type: "training", event_date: "", location: "",
        venue: "", opponent: "", opponent_school: "", is_home: true,
        transport_required: false, status: "scheduled",
        our_score: "", opponent_score: "", match_result: "na", result: "", notes: "",
      });
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

                  {enrollments.length === 0 ? (
                    <p className="text-gray-500 text-sm">No students enrolled yet.</p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                        <tr>
                          <th className="px-3 py-2 text-left">Student</th>
                          <th className="px-3 py-2 text-left">Class</th>
                          <th className="px-3 py-2 text-left">Role</th>
                          <th className="px-3 py-2 text-left">Status</th>
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
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                e.is_suspended
                                  ? "bg-red-800 text-white"
                                  : e.status === "approved"
                                    ? "bg-green-100 text-green-700"
                                    : e.status === "declined"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                              }`}>
                                {e.is_suspended ? `Suspended: ${e.suspension_reason}` : (e.status_display || e.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2">{formatDate(e.date_joined)}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                {e.status === "pending" && (user?.role === "hr" || user?.role === "admin") && (
                                  <>
                                    <button onClick={() => handleReviewEnrollment(e.id, "approve")} className="text-green-600 hover:text-green-800 text-xs">
                                      <i className="fas fa-check mr-1"></i>Approve
                                    </button>
                                    <button onClick={() => handleReviewEnrollment(e.id, "decline")} className="text-orange-600 hover:text-orange-800 text-xs">
                                      <i className="fas fa-times mr-1"></i>Decline
                                    </button>
                                  </>
                                )}
                                {e.status === "approved" && (
                                  <button onClick={() => handleUnenroll(e.student_id)} className="text-red-600 hover:text-red-800 text-xs text-left w-full">
                                    <i className="fas fa-trash mr-1"></i>Remove
                                  </button>
                                )}
                                {e.status === "approved" && (
                                    <button onClick={() => handleToggleSuspend(e)} className={`${e.is_suspended ? 'text-green-600 hover:text-green-800' : 'text-orange-600 hover:text-orange-800'} text-xs text-left w-full`}>
                                        <i className={`fas ${e.is_suspended ? 'fa-play' : 'fa-pause'} mr-1`}></i>{e.is_suspended ? 'Unsuspend' : 'Suspend'}
                                    </button>
                                )}
                              </div>
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
                      <input placeholder="Venue" value={eventForm.venue}
                        onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                        className="border rounded px-3 py-2 text-sm" />
                      <input placeholder="Opponent School" value={eventForm.opponent_school}
                        onChange={(e) => setEventForm({ ...eventForm, opponent_school: e.target.value })}
                        className="border rounded px-3 py-2 text-sm" />
                      <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={eventForm.is_home}
                            onChange={(e) => setEventForm({ ...eventForm, is_home: e.target.checked })}
                            className="rounded" /> Home fixture
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={eventForm.transport_required}
                            onChange={(e) => setEventForm({ ...eventForm, transport_required: e.target.checked })}
                            className="rounded" /> Transport required
                        </label>
                      </div>
                      <select value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}
                        className="border rounded px-3 py-2 text-sm">
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="postponed">Postponed</option>
                      </select>
                      {(eventForm.event_type === 'match' || eventForm.event_type === 'competition' || eventForm.event_type === 'tournament' || eventForm.event_type === 'inter_house') && (
                        <>
                            <input placeholder="Opponent" value={eventForm.opponent}
                                onChange={(e) => setEventForm({ ...eventForm, opponent: e.target.value })}
                                className="border rounded px-3 py-2 text-sm" />
                            <div className="flex gap-2">
                                <input type="number" placeholder="Our Score" value={eventForm.our_score}
                                    onChange={(e) => setEventForm({ ...eventForm, our_score: e.target.value })}
                                    className="border rounded px-3 py-2 text-sm w-full" />
                                <span className="pt-2 text-gray-500">-</span>
                                <input type="number" placeholder="Opponent Score" value={eventForm.opponent_score}
                                    onChange={(e) => setEventForm({ ...eventForm, opponent_score: e.target.value })}
                                    className="border rounded px-3 py-2 text-sm w-full" />
                            </div>
                            <select value={eventForm.match_result} onChange={(e) => setEventForm({ ...eventForm, match_result: e.target.value })}
                                className="border rounded px-3 py-2 text-sm">
                                <option value="na">N/A</option>
                                <option value="win">Win</option>
                                <option value="loss">Loss</option>
                                <option value="draw">Draw</option>
                            </select>
                        </>
                      )}

                      <input placeholder="Overall Result Details" value={eventForm.result}
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

                  {showSquadModal && selectedSquadEvent && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold">Manage Squad for {selectedSquadEvent.title}</h3>
                          <button onClick={() => setShowSquadModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Select athletes from the current activity enrollment list and save the final match squad.</p>
                        <div className="grid gap-2">
                          {enrollments.length === 0 ? (
                            <p className="text-sm text-gray-500">No enrolled athletes available.</p>
                          ) : (
                            <div className="space-y-2">
                              {enrollments.map((student) => {
                                const existing = eventSquad.find((entry) => entry.student_id === student.student_id);
                                return (
                                  <div key={student.student_id} className="flex flex-col gap-2 p-3 border rounded">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="font-medium text-gray-800">{student.student_name}</p>
                                        <p className="text-xs text-gray-500">{student.class_name}</p>
                                      </div>
                                      <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={!!existing} onChange={() => handleToggleSquadMember(student)} className="rounded" />
                                        In squad
                                      </label>
                                    </div>
                                    {existing && (
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <label className="text-xs text-gray-600">
                                          <span className="block mb-1">Captain</span>
                                          <input type="checkbox" checked={existing.is_captain} onChange={(e) => handleSquadChange(student.student_id, 'is_captain', e.target.checked)} className="rounded" />
                                        </label>
                                        <label className="text-xs text-gray-600">
                                          <span className="block mb-1">Jersey #</span>
                                          <input type="number" value={existing.jersey_number || ''} onChange={(e) => handleSquadChange(student.student_id, 'jersey_number', e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
                                        </label>
                                        <label className="text-xs text-gray-600">
                                          <span className="block mb-1">Ready</span>
                                          <input type="checkbox" checked={existing.played} onChange={(e) => handleSquadChange(student.student_id, 'played', e.target.checked)} className="rounded" />
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button onClick={() => setShowSquadModal(false)} className="bg-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-400">Close</button>
                          <button onClick={handleSaveSquad} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Save Squad</button>
                        </div>
                      </div>
                    </div>
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
                            <div className="flex items-center gap-2">
                                {ev.match_result && ev.match_result !== 'na' && (
                                    <span className={`px-2 py-1 rounded text-xs text-white capitalize ${ev.match_result === 'win' ? 'bg-green-500' : ev.match_result === 'loss' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                                        {ev.match_result}
                                    </span>
                                )}
                                {ev.result && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">{ev.result}</span>}
                            </div>
                          </div>
                          {ev.location && <p className="text-sm text-gray-600 mt-1"><i className="fas fa-map-marker-alt mr-1"></i>{ev.location}</p>}
                          {ev.opponent && <p className="text-sm border-l-2 border-blue-500 pl-2 mt-2 bg-gray-50 py-1">
                            <span className="font-semibold text-blue-800">vs {ev.opponent}</span>
                            {(ev.our_score || ev.opponent_score) && (
                                <span className="ml-2 bg-white border px-2 py-0.5 rounded text-xs">Score: {ev.our_score || 0} - {ev.opponent_score || 0}</span>
                            )}
                          </p>}
                          {ev.notes && <p className="text-sm text-gray-500 mt-1">{ev.notes}</p>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => loadEventSquad(ev)} className="bg-indigo-600 text-white text-xs px-3 py-2 rounded hover:bg-indigo-700">
                              <i className="fas fa-users mr-1"></i>Manage Squad
                            </button>
                          </div>
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
              <button onClick={() => { setShowActivityForm(true); setEditingActivity(null); setActivityForm({ name: "", activity_type: "sport", age_group: "open", gender_category: "mixed", level: "social", description: "", coach: "", assistant_coach: "", schedule_day: "", schedule_time: "", location: "", max_participants: 30 }); }}
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
                <select value={activityForm.age_group} onChange={(e) => setActivityForm({ ...activityForm, age_group: e.target.value })}
                  className="border rounded px-3 py-2 text-sm">
                  {AGE_GROUPS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={activityForm.gender_category} onChange={(e) => setActivityForm({ ...activityForm, gender_category: e.target.value })}
                  className="border rounded px-3 py-2 text-sm">
                  {GENDER_CATEGORIES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={activityForm.level} onChange={(e) => setActivityForm({ ...activityForm, level: e.target.value })}
                  className="border rounded px-3 py-2 text-sm">
                  {LEVELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={activityForm.coach} onChange={(e) => setActivityForm({ ...activityForm, coach: e.target.value })}
                  className="border rounded px-3 py-2 text-sm">
                  <option value="">No Coach</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.user?.id || t.id}>{t.user?.full_name || `${t.user?.first_name} ${t.user?.last_name}`}</option>
                  ))}
                </select>
                <select value={activityForm.assistant_coach} onChange={(e) => setActivityForm({ ...activityForm, assistant_coach: e.target.value })}
                  className="border rounded px-3 py-2 text-sm">
                  <option value="">No Assistant Coach</option>
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
                        {(activity.age_group || activity.gender_category || activity.level) && (
                            <div className="flex gap-2 mt-2">
                                {activity.age_group && <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs border">{activity.age_group_display}</span>}
                                {activity.gender_category && <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs border">{activity.gender_category_display}</span>}
                                {activity.level && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs border border-blue-200">{activity.level_display}</span>}
                            </div>
                        )}
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
