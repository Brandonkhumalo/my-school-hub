import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import { formatDate } from "../../utils/dateFormat";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function StudentResults() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentAcademicYear, currentTerm } = useSchoolSettings();
  const [performance, setPerformance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reportYear, setReportYear] = useState(currentAcademicYear);
  const [reportTerm, setReportTerm] = useState(currentTerm);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchStudentPerformance(user.id);
        setPerformance(data);
      } catch (error) {
        console.error("Error fetching performance:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const studentId = performance?.student_id || user.id;
      const blob = await apiService.downloadReportCard(studentId, {
        year: reportYear,
        term: reportTerm,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_card_${reportTerm}_${reportYear}.pdf`;
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

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="My Results" user={user} />
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back
        </button>
      </div>
      {performance ? (
        <>
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between">
              <div>
                <p className="text-gray-600">Average Score</p>
                <h3 className="text-3xl font-bold text-blue-600">{performance.average_score}%</h3>
              </div>
              <div>
                <p className="text-gray-600">Overall Grade</p>
                <h3 className="text-3xl font-bold text-green-600">{performance.overall_grade}</h3>
              </div>
              <div>
                <p className="text-gray-600">Total Subjects</p>
                <h3 className="text-3xl font-bold text-orange-600">{performance.total_subjects}</h3>
              </div>
            </div>
          </div>

          {/* Download Report Card */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              <i className="fas fa-file-pdf text-red-500 mr-2"></i>
              Download Report Card
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

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Exam Type</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {performance.results.map((result, index) => (
                  <tr key={index}>
                    <td>{result.subject_name}</td>
                    <td>{result.teacher_name}</td>
                    <td>{result.exam_type}</td>
                    <td>{result.score}/{result.max_score}</td>
                    <td>{result.percentage}%</td>
                    <td>{result.grade}</td>
                    <td>{formatDate(result.date_recorded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>No results available yet.</p>
      )}
    </div>
  );
}
