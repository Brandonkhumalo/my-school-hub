import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate } from "../../utils/dateFormat";

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await apiService.getAdminAnalytics();
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  if (error) {
    return (
      <div>
        <Header title="Analytics" />
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overview, attendance_by_day, subject_performance, class_distribution } = data;

  // Find max attendance total for bar scaling
  const maxAttendanceTotal = Math.max(...attendance_by_day.map((d) => d.total), 1);

  // Format currency
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  // Color for attendance rate
  const rateColor = (rate) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  // Color for performance average
  const perfBg = (avg) => {
    if (avg >= 70) return "bg-green-500";
    if (avg >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div>
      <Header title="Analytics" />
      <div className="p-4 md:p-6 space-y-6">

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <OverviewCard
            label="Students"
            value={overview.total_students}
            icon={
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
            bg="bg-blue-50"
          />
          <OverviewCard
            label="Teachers"
            value={overview.total_teachers}
            icon={
              <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            bg="bg-indigo-50"
          />
          <OverviewCard
            label="Classes"
            value={overview.total_classes}
            icon={
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            bg="bg-purple-50"
          />
          <OverviewCard
            label="Subjects"
            value={overview.total_subjects}
            icon={
              <svg className="w-6 h-6 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
            bg="bg-teal-50"
          />
          <OverviewCard
            label="Attendance Rate"
            value={`${overview.attendance_rate}%`}
            icon={
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            bg="bg-green-50"
            valueClass={rateColor(overview.attendance_rate)}
          />
          <OverviewCard
            label="Fee Collection"
            value={`${overview.fee_collection_rate}%`}
            icon={
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            bg="bg-amber-50"
            valueClass={rateColor(overview.fee_collection_rate)}
          />
        </div>

        {/* Attendance Trend + Fee Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Attendance Trend (last 7 days) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Attendance Trend (Last 7 Days)</h2>
            {attendance_by_day.every((d) => d.total === 0) ? (
              <p className="text-gray-400 text-sm">No attendance data for the past week.</p>
            ) : (
              <div className="flex items-end gap-2 h-48">
                {attendance_by_day.map((day, idx) => {
                  const barHeight = day.total > 0 ? (day.total / maxAttendanceTotal) * 100 : 0;
                  const presentHeight = day.total > 0 ? (day.present / maxAttendanceTotal) * 100 : 0;
                  const dayLabel = new Date(day.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" });
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <span className={`text-xs font-medium ${rateColor(day.rate)}`}>
                        {day.total > 0 ? `${day.rate}%` : "-"}
                      </span>
                      <div className="w-full relative" style={{ height: "140px" }}>
                        {/* Total bar (background) */}
                        <div
                          className="absolute bottom-0 w-full rounded-t bg-gray-200"
                          style={{ height: `${barHeight}%` }}
                        />
                        {/* Present bar (foreground) */}
                        <div
                          className="absolute bottom-0 w-full rounded-t bg-green-500"
                          style={{ height: `${presentHeight}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-green-500" /> Present/Late
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded bg-gray-200" /> Absent
              </span>
            </div>
          </div>

          {/* Fee Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Fee Collection Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Fees Due</span>
                <span className="font-semibold text-gray-800">{formatCurrency(overview.total_fees_due)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Fees Paid</span>
                <span className="font-semibold text-green-600">{formatCurrency(overview.total_fees_paid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Outstanding</span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(overview.total_fees_due - overview.total_fees_paid)}
                </span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Collection Progress</span>
                  <span>{overview.fee_collection_rate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      overview.fee_collection_rate >= 70
                        ? "bg-green-500"
                        : overview.fee_collection_rate >= 40
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(overview.fee_collection_rate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subject Performance + Class Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Subject Performance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Subject Performance Ranking</h2>
            {subject_performance.length === 0 ? (
              <p className="text-gray-400 text-sm">No results data available yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Subject</th>
                      <th className="pb-2 font-medium">Code</th>
                      <th className="pb-2 font-medium text-right">Average</th>
                      <th className="pb-2 font-medium text-right">Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subject_performance.map((subj, idx) => (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 text-gray-400">{idx + 1}</td>
                        <td className="py-2 font-medium text-gray-800">{subj.name}</td>
                        <td className="py-2 text-gray-500">{subj.code}</td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${perfBg(subj.average)}`}
                                style={{ width: `${Math.min(subj.average, 100)}%` }}
                              />
                            </div>
                            <span className="font-medium text-gray-800 w-12 text-right">
                              {subj.average}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 text-right text-gray-600">{subj.student_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Class Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Class Distribution</h2>
            {class_distribution.length === 0 ? (
              <p className="text-gray-400 text-sm">No classes found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Class</th>
                      <th className="pb-2 font-medium text-right">Students</th>
                      <th className="pb-2 font-medium">Distribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const maxStudents = Math.max(...class_distribution.map((c) => c.student_count), 1);
                      return class_distribution.map((cls, idx) => (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-800">{cls.name}</td>
                          <td className="py-2 text-right text-gray-600">{cls.student_count}</td>
                          <td className="py-2 pl-3">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{
                                  width: `${(cls.student_count / maxStudents) * 100}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({ label, value, icon, bg, valueClass = "" }) {
  return (
    <div className={`${bg} rounded-xl p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <span className={`text-2xl font-bold ${valueClass || "text-gray-800"}`}>{value}</span>
    </div>
  );
}
