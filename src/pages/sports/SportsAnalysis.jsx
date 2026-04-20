import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function SportsAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await apiService.getSportsAnalytics();
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return null;

  const { overview, matches, upcoming_events } = data;

  const matchData = {
    labels: ['Wins', 'Losses', 'Draws'],
    datasets: [{
      data: [matches.wins, matches.losses, matches.draws],
      backgroundColor: ['#22c55e', '#ef4444', '#eab308'],
    }]
  };

  return (
    <div>
      <Header title="Sports Analysis" />
      <div className="p-6">
        
        {/* Overview row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <h3 className="text-gray-500 text-sm font-medium uppercase">Active Enrollments</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{overview.total_enrollments}</p>
            <p className="text-sm text-gray-500 mt-1">Across {overview.total_activities} activities</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-emerald-500">
            <h3 className="text-gray-500 text-sm font-medium uppercase">Unique Participants</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{overview.total_active_participants}</p>
            <p className="text-sm text-gray-500 mt-1">Students involved</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <h3 className="text-gray-500 text-sm font-medium uppercase">Match Win Rate</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{matches.win_ratio}%</p>
            <p className="text-sm text-gray-500 mt-1">{matches.wins} wins / {matches.total_played} total matches</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="bg-white rounded-lg shadow p-6 lg:col-span-1 border-t-4 border-blue-500">
                <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Match Results</h3>
                {matches.total_played > 0 ? (
                    <div className="w-full max-w-xs mx-auto">
                        <Pie data={matchData} />
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm text-center py-10">No match results recorded yet.</p>
                )}
            </div>

            <div className="bg-white rounded-lg shadow p-6 lg:col-span-2 border-t-4 border-emerald-500">
                <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Upcoming Events & Fixtures</h3>
                {upcoming_events.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-10">No upcoming events scheduled.</p>
                ) : (
                    <div className="space-y-4">
                        {upcoming_events.map(ev => (
                            <div key={ev.id} className="flex gap-4 items-center bg-gray-50 p-3 rounded border-l-4 border-blue-400">
                                <div className="text-center min-w-[70px]">
                                    <p className="font-bold text-blue-600 text-xl">{new Date(ev.event_date).getDate()}</p>
                                    <p className="text-xs font-semibold text-gray-500 uppercase">{new Date(ev.event_date).toLocaleString('default', { month: 'short' })}</p>
                                </div>
                                <div className="flex-1 border-l pl-4">
                                    <h4 className="font-bold text-gray-800">{ev.title} <span className="text-xs font-normal bg-gray-200 px-2 py-0.5 rounded ml-2">{ev.activity_name}</span></h4>
                                    <p className="text-sm text-gray-600 mt-1">{ev.event_type_display} {ev.opponent && <span className="font-semibold text-blue-700 ml-1">vs {ev.opponent}</span>}</p>
                                    {ev.location && <p className="text-xs text-gray-500 mt-1"><i className="fas fa-map-marker-alt mr-1"></i>{ev.location}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
}
