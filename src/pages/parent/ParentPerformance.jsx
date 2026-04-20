import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import AssessmentPlanCard from "../../components/AssessmentPlanCard";
import apiService from "../../services/apiService";

export default function ParentPerformance() {
  const { user } = useAuth();
  const { currentAcademicYear, currentTerm } = useSchoolSettings();
  const [marks, setMarks] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [assessmentPlans, setAssessmentPlans] = useState([]);
  const [childDetailedPerformance, setChildDetailedPerformance] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reportYear, setReportYear] = useState(currentAcademicYear);
  const [reportTerm, setReportTerm] = useState(currentTerm);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const childrenData = await apiService.getParentChildren();
      const confirmedChildren = childrenData.filter(c => c.is_confirmed);
      setChildren(confirmedChildren);
      
      if (confirmedChildren.length > 0) {
        setSelectedChild(confirmedChildren[0]);
        const [marksData, detailed, predictionData] = await Promise.all([
          apiService.getChildPerformance(confirmedChildren[0].id),
          apiService.fetchStudentPerformance(confirmedChildren[0].id),
          apiService.getStudentGradePredictions(confirmedChildren[0].id).catch(() => ({ predictions: [] })),
        ]);
        setMarks(marksData);
        setChildDetailedPerformance(detailed || null);
        setPredictions(Array.isArray(predictionData?.predictions) ? predictionData.predictions : []);
      }
    } catch (error) {
      console.error("Error loading performance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChildChange = async (childId) => {
    const child = children.find(c => c.id === parseInt(childId));
    setSelectedChild(child);
    
    if (child) {
      try {
        setLoading(true);
        const [marksData, detailed, predictionData] = await Promise.all([
          apiService.getChildPerformance(child.id),
          apiService.fetchStudentPerformance(child.id),
          apiService.getStudentGradePredictions(child.id).catch(() => ({ predictions: [] })),
        ]);
        setMarks(marksData);
        setChildDetailedPerformance(detailed || null);
        setPredictions(Array.isArray(predictionData?.predictions) ? predictionData.predictions : []);
      } catch (error) {
        console.error("Error loading child performance:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!selectedChild?.id) return undefined;

    const interval = setInterval(async () => {
      try {
        const predictionData = await apiService.getStudentGradePredictions(selectedChild.id);
        setPredictions(Array.isArray(predictionData?.predictions) ? predictionData.predictions : []);
      } catch {
        // Keep last successful snapshot for resilience.
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [selectedChild?.id]);

  // Fetch assessment plans when child or year/term changes
  useEffect(() => {
    if (!selectedChild) return;
    
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const plans = await apiService.getAssessmentPlansForParent(selectedChild.id, reportYear, reportTerm);
        setAssessmentPlans(plans || []);
      } catch (error) {
        console.error("Error fetching assessment plans:", error);
        setAssessmentPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, [selectedChild, reportYear, reportTerm]);

  const handleDownloadReport = async () => {
    if (!selectedChild) return;
    setDownloading(true);
    try {
      const blob = await apiService.downloadReportCard(selectedChild.id, {
        year: reportYear,
        term: reportTerm,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_card_${selectedChild.name}_${reportTerm}_${reportYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || 'Failed to download report card');
    } finally {
      setDownloading(false);
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

  const getAiRiskBadge = (pred) => {
    if (!pred) return { label: "No AI data", className: "bg-gray-100 text-gray-700" };
    if (pred.predicted_at_risk) return { label: "High Risk", className: "bg-red-100 text-red-700" };
    if ((pred.predicted_percentage ?? 0) < 60) return { label: "Watch", className: "bg-amber-100 text-amber-700" };
    return { label: "On Track", className: "bg-green-100 text-green-700" };
  };

  const predictionMap = useMemo(() => {
    const map = new Map();
    predictions.forEach((p) => map.set(String(p.subject || "").toLowerCase(), p));
    return map;
  }, [predictions]);

  if (loading) {
    return (
      <div>
        <Header title="Child's Performance" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div>
        <Header title="Child's Performance" user={user} />
        <div className="p-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
            <p className="text-yellow-700">
              No confirmed children found. Please confirm your children first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Child's Performance" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Academic Performance</h2>
          <p className="text-gray-600 mt-2">View your child's grades and performance</p>
        </div>

        {children.length > 1 && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Viewing Child:</h3>
              <select
                value={selectedChild?.id || ''}
                onChange={(e) => handleChildChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name} {child.surname} - {child.class}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Assessment Plan Card */}
        {selectedChild && (
          <div className="mb-6">
            <AssessmentPlanCard
              plans={assessmentPlans}
              existingResults={childDetailedPerformance?.results || []}
              isLoading={loadingPlans}
              year={reportYear}
              term={reportTerm}
            />
          </div>
        )}

        {/* Download Report Card */}
        {selectedChild && (
          <div className="bg-white rounded-lg shadow-lg p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              <i className="fas fa-file-pdf text-red-500 mr-2"></i>
              Download Report Card
              <span className="text-gray-500 font-normal"> — {selectedChild.name} {selectedChild.surname}</span>
            </h3>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Year</label>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {[...Array(5)].map((_, i) => {
                    const y = parseInt(currentAcademicYear) - i;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Term</label>
                <select
                  value={reportTerm}
                  onChange={(e) => setReportTerm(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>
              <button
                onClick={handleDownloadReport}
                disabled={downloading}
                className={`flex items-center space-x-2 px-5 py-2 rounded-lg font-medium text-white transition-all ${
                  downloading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                }`}
              >
                {downloading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-download"></i>
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6">
          {marks.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-chart-bar text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No marks available yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {marks.map((subject) => {
                const prediction = predictionMap.get(String(subject.subject_name || "").toLowerCase());
                const riskBadge = getAiRiskBadge(prediction);
                const headerGradient = prediction?.predicted_at_risk
                  ? "from-red-500 to-red-600"
                  : prediction && (prediction.predicted_percentage ?? 0) < 60
                  ? "from-amber-500 to-amber-600"
                  : "from-green-500 to-green-600";

                return (
                <div key={subject.subject_id} className="border rounded-lg overflow-hidden">
                  <div className={`bg-gradient-to-r ${headerGradient} text-white p-4`}>
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-semibold">{subject.subject_name}</h3>
                      <div className="text-right">
                        <p className="text-sm text-blue-100">Overall Year Score</p>
                        <p className="text-2xl font-bold">{subject.overall_year_percentage}%</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${riskBadge.className}`}>
                        AI: {riskBadge.label}
                      </span>
                      {prediction && (
                        <span className="text-xs font-medium text-white/90">
                          Predicted: {prediction.predicted_percentage}% ({prediction.trend})
                        </span>
                      )}
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

                    {prediction && (
                      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold mb-1">AI Insight</p>
                        <p className="text-sm text-blue-900">{prediction.intervention}</p>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
