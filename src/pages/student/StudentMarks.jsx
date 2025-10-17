import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function StudentMarks() {
  const { user } = useAuth();
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarks();
  }, []);

  const loadMarks = async () => {
    try {
      setLoading(true);
      const data = await apiService.getStudentMarks();
      setMarks(data);
    } catch (error) {
      console.error("Error loading marks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (percentage) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-blue-600';
    if (percentage >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeBg = (percentage) => {
    if (percentage >= 80) return 'bg-green-100';
    if (percentage >= 60) return 'bg-blue-100';
    if (percentage >= 40) return 'bg-orange-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <div>
        <Header title="My Marks" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="My Marks" user={user} />
      
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Academic Performance</h2>
          
          {marks.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-chart-bar text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No marks available yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {marks.map((subject) => (
                <div key={subject.subject_id} className="border rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-semibold">{subject.subject_name}</h3>
                      <div className="text-right">
                        <p className="text-sm text-blue-100">Overall Year Score</p>
                        <p className="text-2xl font-bold">{subject.overall_year_percentage}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className={`p-4 rounded-lg ${getGradeBg(subject.test_score_percentage)}`}>
                        <p className="text-sm text-gray-600 mb-1">Test Score</p>
                        <p className={`text-3xl font-bold ${getGradeColor(subject.test_score_percentage)}`}>
                          {subject.test_score_percentage}%
                        </p>
                      </div>

                      <div className={`p-4 rounded-lg ${getGradeBg(subject.assignment_score_percentage)}`}>
                        <p className="text-sm text-gray-600 mb-1">Assignment Score</p>
                        <p className={`text-3xl font-bold ${getGradeColor(subject.assignment_score_percentage)}`}>
                          {subject.assignment_score_percentage}%
                        </p>
                      </div>

                      <div className={`p-4 rounded-lg ${getGradeBg(subject.overall_term_percentage)}`}>
                        <p className="text-sm text-gray-600 mb-1">Term Average</p>
                        <p className={`text-3xl font-bold ${getGradeColor(subject.overall_term_percentage)}`}>
                          {subject.overall_term_percentage}%
                        </p>
                      </div>
                    </div>

                    {subject.recent_scores && subject.recent_scores.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-gray-700 mb-2">Recent Assessments</h4>
                        <div className="space-y-2">
                          {subject.recent_scores.map((score, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <span className="text-gray-700">{score.name}</span>
                              <span className={`font-semibold ${getGradeColor(score.percentage)}`}>
                                {score.percentage}%
                              </span>
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
        </div>
      </div>
    </div>
  );
}
