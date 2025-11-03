import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function TeacherPerformance() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadPerformance();
    }
  }, [selectedSubject]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTeacherSubjects();
      setSubjects(data);
      if (data.length > 0) {
        setSelectedSubject(data[0].id);
      }
    } catch (error) {
      console.error("Error loading subjects:", error);
      alert("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const loadPerformance = async () => {
    try {
      setLoadingPerformance(true);
      const data = await apiService.getSubjectPerformance(selectedSubject);
      setPerformance(data);
    } catch (error) {
      console.error("Error loading performance:", error);
      setPerformance(null);
    } finally {
      setLoadingPerformance(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="Subject Performance" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  const getGradeColor = (percentage) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 70) return 'text-blue-600';
    if (percentage >= 60) return 'text-yellow-600';
    if (percentage >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPassRateColor = (rate) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-blue-500';
    if (rate >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <Header title="Subject Performance" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Subject Performance Analytics</h2>
          <p className="text-gray-600 mt-2">View detailed performance statistics for your subjects</p>
        </div>

        {subjects.length === 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-yellow-800">No subjects assigned. Contact administrator.</p>
          </div>
        ) : (
          <div>
            {/* Subject Selector */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-book mr-2 text-blue-600"></i>
                Select Subject
              </label>
              <select
                className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedSubject || ""}
                onChange={(e) => setSelectedSubject(parseInt(e.target.value))}
              >
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code}) - {subject.students_count} students
                  </option>
                ))}
              </select>
            </div>

            {loadingPerformance ? (
              <LoadingSpinner />
            ) : performance ? (
              <div>
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Students</p>
                        <p className="text-3xl font-bold text-blue-600 mt-2">{performance.total_students}</p>
                      </div>
                      <i className="fas fa-users text-4xl text-blue-200"></i>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Average Score</p>
                        <p className="text-3xl font-bold text-green-600 mt-2">{performance.average_percentage}%</p>
                      </div>
                      <i className="fas fa-chart-line text-4xl text-green-200"></i>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Pass Rate</p>
                        <p className="text-3xl font-bold text-purple-600 mt-2">{performance.pass_rate}%</p>
                      </div>
                      <i className="fas fa-check-circle text-4xl text-purple-200"></i>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Results</p>
                        <p className="text-3xl font-bold text-orange-600 mt-2">{performance.total_results}</p>
                      </div>
                      <i className="fas fa-file-alt text-4xl text-orange-200"></i>
                    </div>
                  </div>
                </div>

                {/* Score Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      <i className="fas fa-chart-bar mr-2 text-blue-600"></i>
                      Score Range
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Highest Score</span>
                          <span className="font-semibold text-green-600">{performance.highest_percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{width: `${performance.highest_percentage}%`}}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Average Score</span>
                          <span className="font-semibold text-blue-600">{performance.average_percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{width: `${performance.average_percentage}%`}}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Lowest Score</span>
                          <span className="font-semibold text-red-600">{performance.lowest_percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full" 
                            style={{width: `${performance.lowest_percentage}%`}}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pass Rate Visualization */}
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      <i className="fas fa-graduation-cap mr-2 text-purple-600"></i>
                      Pass Rate Analysis
                    </h3>
                    <div className="text-center">
                      <div className="inline-block relative">
                        <svg className="w-32 h-32">
                          <circle
                            className="text-gray-200"
                            strokeWidth="10"
                            stroke="currentColor"
                            fill="transparent"
                            r="56"
                            cx="64"
                            cy="64"
                          />
                          <circle
                            className={getPassRateColor(performance.pass_rate).replace('bg-', 'text-')}
                            strokeWidth="10"
                            strokeDasharray={`${performance.pass_rate * 3.52} ${352 - performance.pass_rate * 3.52}`}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="56"
                            cx="64"
                            cy="64"
                            transform="rotate(-90 64 64)"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                          {performance.pass_rate}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-4">
                        {performance.total_students > 0 && (
                          <>
                            {Math.round((performance.pass_rate / 100) * performance.total_students)} out of {performance.total_students} students passing
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Exam Types Breakdown */}
                {performance.exam_types && performance.exam_types.length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      <i className="fas fa-clipboard-list mr-2 text-green-600"></i>
                      Performance by Exam Type
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {performance.exam_types.map((exam, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-800">{exam.exam_type}</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {exam.count} results
                            </span>
                          </div>
                          <div className="text-2xl font-bold" style={{color: getGradeColor(exam.average).replace('text-', '')}}>
                            {exam.average}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Performers */}
                {performance.top_performers && performance.top_performers.length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      <i className="fas fa-trophy mr-2 text-yellow-500"></i>
                      Top Performers
                    </h3>
                    <div className="space-y-3">
                      {performance.top_performers.map((student, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-white rounded-lg border border-yellow-200">
                          <div className="flex items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${
                              index === 0 ? 'bg-yellow-400 text-white' :
                              index === 1 ? 'bg-gray-300 text-gray-700' :
                              index === 2 ? 'bg-orange-300 text-white' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {index === 0 && <i className="fas fa-crown"></i>}
                              {index !== 0 && <span className="font-bold">#{index + 1}</span>}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-800">{student.student_name}</h4>
                              <p className="text-sm text-gray-600">#{student.student_number}</p>
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            {student.average_percentage}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <i className="fas fa-chart-line text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No performance data available for this subject yet.</p>
                <p className="text-sm text-gray-400 mt-2">Add student marks to see analytics.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
