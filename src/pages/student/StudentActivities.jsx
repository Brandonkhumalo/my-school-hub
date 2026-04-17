import React, { useEffect, useState } from "react";
import apiService from "../../services/apiService";
import { formatDate, formatDateTime } from "../../utils/dateFormat";

const TYPE_COLORS = {
  sport: "bg-green-100 text-green-700",
  club: "bg-purple-100 text-purple-700",
  society: "bg-blue-100 text-blue-700",
  arts: "bg-orange-100 text-orange-700",
};

const CATEGORY_COLORS = {
  academic: "bg-blue-100 text-blue-700",
  sports: "bg-green-100 text-green-700",
  conduct: "bg-purple-100 text-purple-700",
  attendance: "bg-teal-100 text-teal-700",
  extracurricular: "bg-orange-100 text-orange-700",
  leadership: "bg-yellow-100 text-yellow-700",
};

export default function StudentActivities() {
  const [activities, setActivities] = useState([]);
  const [allActivities, setAllActivities] = useState([]);
  const [accoladesData, setAccoladesData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("activities");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [activitiesRes, allActivitiesRes, accoladesRes, leaderboardRes] = await Promise.all([
        apiService.getStudentActivities(),
        apiService.getActivities(),
        apiService.getStudentAccolades(),
        apiService.getAccoladeLeaderboard(),
      ]);
      setActivities(Array.isArray(activitiesRes) ? activitiesRes : []);
      setAllActivities(Array.isArray(allActivitiesRes) ? allActivitiesRes : []);
      setAccoladesData(accoladesRes || null);
      setLeaderboard(Array.isArray(leaderboardRes) ? leaderboardRes : []);
      setError("");
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEnrollment = async (activityId) => {
    setError("");
    setActionLoadingId(activityId);
    try {
      await apiService.enrollStudent(activityId);
      await loadAll();
    } catch (err) {
      setError(err.message || "Failed to submit enrollment request");
    } finally {
      setActionLoadingId(null);
    }
  };

  const awards = accoladesData?.awards || [];
  const totalPoints = accoladesData?.total_points || 0;

  const myRank = leaderboard.find(
    (e) => e.total_points === totalPoints && awards.length > 0
  )?.rank || "--";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Activities & Accolades</h1>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-t-4 border-blue-500 text-center">
            <p className="text-xs text-gray-500 mb-1">Activities</p>
            <p className="text-2xl font-bold text-blue-600">{activities.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-t-4 border-yellow-500 text-center">
            <p className="text-xs text-gray-500 mb-1">Accolades</p>
            <p className="text-2xl font-bold text-yellow-600">{awards.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-t-4 border-green-500 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Points</p>
            <p className="text-2xl font-bold text-green-600">{totalPoints}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-t-4 border-purple-500 text-center">
            <p className="text-xs text-gray-500 mb-1">Leaderboard Rank</p>
            <p className="text-2xl font-bold text-purple-600">#{myRank}</p>
          </div>
        </div>
      )}

      <div className="flex border-b mb-6">
        {["activities", "accolades", "leaderboard"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 font-medium capitalize text-sm ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <>
          {activeTab === "activities" && (
            <>
              {allActivities.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Available Activities</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allActivities.map((activity) => {
                      const enrollment = activity.my_enrollment || null;
                      const status = enrollment?.status || null;
                      const isPending = status === "pending";
                      const isApproved = status === "approved";
                      const isDeclined = status === "declined";
                      const canRequest = Boolean(activity.can_request_enrollment);
                      return (
                        <div key={`available-${activity.id}`} className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-semibold text-gray-800">{activity.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[activity.activity_type] || "bg-gray-100 text-gray-700"}`}>
                              {activity.activity_type_display}
                            </span>
                          </div>
                          {activity.description && <p className="text-xs text-gray-600 mt-2">{activity.description}</p>}
                          <p className="text-xs text-gray-500 mt-2">
                            {activity.enrolled_count}/{activity.max_participants} enrolled
                          </p>
                          {isApproved && <p className="text-xs text-green-700 mt-2 font-medium">You are enrolled</p>}
                          {isPending && <p className="text-xs text-yellow-700 mt-2 font-medium">Request pending HR approval</p>}
                          {isDeclined && <p className="text-xs text-red-700 mt-2 font-medium">Previous request declined</p>}
                          <button
                            onClick={() => handleRequestEnrollment(activity.id)}
                            disabled={!canRequest || actionLoadingId === activity.id}
                            className="mt-3 w-full bg-blue-600 text-white text-sm px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
                          >
                            {actionLoadingId === activity.id
                              ? "Submitting..."
                              : canRequest
                              ? "Request Enrollment"
                              : isApproved
                              ? "Already Enrolled"
                              : "Not Available"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activities.length === 0 ? (
                <div className="text-center py-10">
                  <i className="fas fa-running text-4xl text-gray-300 mb-3"></i>
                  <p className="text-gray-500">You are not enrolled in any activities yet.</p>
                  <p className="text-gray-400 text-sm">Use "Request Enrollment" above to join.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {activities.map((activity) => (
                    <div key={activity.id} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="p-5 border-l-4 border-blue-500">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">{activity.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[activity.activity_type] || "bg-gray-100 text-gray-700"}`}>
                                {activity.activity_type_display}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                activity.my_role === "captain" ? "bg-yellow-100 text-yellow-700" :
                                activity.my_role === "vice_captain" ? "bg-blue-100 text-blue-700" :
                                "bg-gray-100 text-gray-700"
                              }`}>
                                {activity.my_role_display}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400">Joined: {formatDate(activity.date_joined)}</p>
                        </div>

                        {activity.description && <p className="text-sm text-gray-600 mt-2">{activity.description}</p>}

                        <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                          {activity.coach_name && (
                            <span><i className="fas fa-user-tie mr-1"></i>Coach: {activity.coach_name}</span>
                          )}
                          {activity.schedule_day && (
                            <span><i className="fas fa-calendar mr-1"></i>{activity.schedule_day} {activity.schedule_time ? `at ${activity.schedule_time}` : ""}</span>
                          )}
                          {activity.location && (
                            <span><i className="fas fa-map-marker-alt mr-1"></i>{activity.location}</span>
                          )}
                          <span><i className="fas fa-users mr-1"></i>{activity.enrolled_count} members</span>
                        </div>

                        {activity.upcoming_events && activity.upcoming_events.length > 0 && (
                          <div className="mt-4 pt-3 border-t">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              <i className="fas fa-calendar-alt mr-1"></i>Upcoming Events
                            </h4>
                            <div className="space-y-2">
                              {activity.upcoming_events.map((ev) => (
                                <div key={ev.id} className="flex items-center justify-between bg-gray-50 rounded p-2 text-sm">
                                  <div>
                                    <span className="font-medium text-gray-700">{ev.title}</span>
                                    <span className="text-gray-400 ml-2 text-xs">{ev.event_type_display}</span>
                                  </div>
                                  <div className="text-right text-xs text-gray-500">
                                    <p>{formatDateTime(ev.event_date)}</p>
                                    {ev.location && <p><i className="fas fa-map-marker-alt mr-1"></i>{ev.location}</p>}
                                    {ev.opponent && <p className="text-gray-600">vs {ev.opponent}</p>}
                                    {ev.result && <span className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1">{ev.result}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "accolades" && (
            awards.length === 0 ? (
              <div className="text-center py-10">
                <i className="fas fa-trophy text-4xl text-gray-300 mb-3"></i>
                <p className="text-gray-500">No accolades earned yet.</p>
                <p className="text-gray-400 text-sm">Keep up the good work and you will be recognised!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {awards.map((award) => (
                  <div key={award.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-400">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        <i className={`fas ${award.accolade.icon} text-yellow-600 text-lg`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800">{award.accolade.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[award.accolade.category] || "bg-gray-100 text-gray-700"}`}>
                            {award.accolade.category_display}
                          </span>
                          <span className="text-xs font-bold text-blue-600">{award.accolade.points_value} pts</span>
                        </div>
                        {award.reason && <p className="text-sm text-gray-600 mt-1">{award.reason}</p>}
                        <div className="text-xs text-gray-400 mt-2">
                          <p>Awarded by: {award.awarded_by_name || "System"}</p>
                          <p>{formatDate(award.date_awarded)}</p>
                          {award.academic_term && <p>{award.academic_term} {award.academic_year}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === "leaderboard" && (
            <div className="max-w-lg mx-auto">
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b bg-gradient-to-r from-yellow-50 to-orange-50">
                  <h3 className="text-lg font-bold text-gray-800 text-center">
                    <i className="fas fa-trophy text-yellow-500 mr-2"></i>School Leaderboard
                  </h3>
                </div>
                {leaderboard.length === 0 ? (
                  <p className="p-6 text-gray-400 text-center text-sm">No awards have been given yet.</p>
                ) : (
                  <div className="divide-y">
                    {leaderboard.map((entry) => (
                      <div key={entry.student_id} className={`p-4 flex items-center gap-4 ${entry.total_points === totalPoints && awards.length > 0 ? "bg-blue-50" : ""}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          entry.rank === 1 ? "bg-yellow-400 text-white" :
                          entry.rank === 2 ? "bg-gray-300 text-white" :
                          entry.rank === 3 ? "bg-orange-400 text-white" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {entry.rank <= 3 ? (
                            <i className={`fas fa-medal ${entry.rank === 1 ? "text-white" : ""}`}></i>
                          ) : entry.rank}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{entry.student_name}</p>
                          <p className="text-xs text-gray-500">{entry.award_count} award{entry.award_count !== 1 ? "s" : ""}</p>
                        </div>
                        <span className="font-bold text-lg text-blue-600">{entry.total_points}</span>
                        <span className="text-xs text-gray-400">pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
