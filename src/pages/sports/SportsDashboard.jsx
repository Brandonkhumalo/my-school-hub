import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Link } from "react-router-dom";

export default function SportsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService.getSportsAnalytics()
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div>Error loading data</div>;

  const { overview, upcoming_events } = data;

  return (
    <div>
      <Header title="Sports Director Dashboard" />
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Welcome, Sports Director!</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 uppercase">Total Activities</p>
                        <p className="text-2xl font-bold text-gray-800">{overview.total_activities}</p>
                    </div>
                    <div className="text-3xl text-blue-200"><i className="fas fa-running"></i></div>
                </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-emerald-500">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 uppercase">Active Athletes</p>
                        <p className="text-2xl font-bold text-gray-800">{overview.total_active_participants}</p>
                    </div>
                    <div className="text-3xl text-emerald-200"><i className="fas fa-users"></i></div>
                </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-purple-500 hover:bg-purple-50 cursor-pointer transition-colors block">
                <Link to="/sports-director/activities" className="flex items-center justify-between h-full">
                    <div>
                        <p className="text-sm text-purple-600 font-bold uppercase">Manage Activities</p>
                        <p className="text-xs text-gray-500 mt-1">Enrollments & Teams</p>
                    </div>
                    <div className="text-2xl text-purple-400"><i className="fas fa-arrow-right"></i></div>
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-orange-500 hover:bg-orange-50 cursor-pointer transition-colors block">
                <Link to="/sports-director/analysis" className="flex items-center justify-between h-full">
                    <div>
                        <p className="text-sm text-orange-600 font-bold uppercase">Sports Analytics</p>
                        <p className="text-xs text-gray-500 mt-1">Match results & stats</p>
                    </div>
                    <div className="text-2xl text-orange-400"><i className="fas fa-chart-bar"></i></div>
                </Link>
            </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Upcoming Events & Fixtures</h3>
            {upcoming_events.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">No upcoming events scheduled.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upcoming_events.map(ev => (
                        <div key={ev.id} className="flex gap-4 items-center bg-gray-50 p-3 rounded border border-gray-200">
                            <div className="text-center min-w-[60px] bg-white rounded p-2 shadow-sm border border-gray-100">
                                <p className="font-bold text-blue-600 text-lg">{new Date(ev.event_date).getDate()}</p>
                                <p className="text-xs font-semibold text-gray-500 uppercase">{new Date(ev.event_date).toLocaleString('default', { month: 'short' })}</p>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-sm">{ev.title}</h4>
                                <p className="text-xs text-blue-600 font-medium my-1">{ev.activity_name}</p>
                                <p className="text-xs text-gray-600">{ev.event_type_display} {ev.opponent && <span>vs {ev.opponent}</span>}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
