import { useState, useEffect } from "react";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminReports() {
  const { currentAcademicYear, currentTerm } = useSchoolSettings();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Report card state
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [reportYear, setReportYear] = useState(currentAcademicYear);
  const [reportTerm, setReportTerm] = useState(currentTerm);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [reportsData, classesData] = await Promise.all([
          apiService.fetchReports().catch(() => []),
          apiService.fetchClasses().catch(() => []),
        ]);
        setReports(Array.isArray(reportsData) ? reportsData : []);
        const classList = Array.isArray(classesData) ? classesData : classesData?.results || [];
        setClasses(classList);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleClassSelect = async (classId) => {
    setSelectedClassId(classId);
    if (!classId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      const data = await apiService.fetchStudentsByClass(classId);
      const list = Array.isArray(data) ? data : data.results || [];
      const normalized = list.map(s => ({
        id: s.id,
        student_number: s.user?.student_number || s.student_number || '',
        full_name: s.user?.full_name || s.full_name || `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim(),
        class_name: s.class_name || '',
      }));
      setStudents(normalized);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleDownloadReport = async (studentId, studentName) => {
    setDownloadingId(studentId);
    try {
      const blob = await apiService.downloadReportCard(studentId, {
        year: reportYear,
        term: reportTerm,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_card_${studentName}_${reportTerm}_${reportYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || 'Failed to download report card');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    if (students.length === 0) return;
    setDownloadingAll(true);
    for (const student of students) {
      try {
        const blob = await apiService.downloadReportCard(student.id, {
          year: reportYear,
          term: reportTerm,
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_card_${student.full_name}_${reportTerm}_${reportYear}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error(`Failed to download for ${student.full_name}:`, error);
      }
    }
    setDownloadingAll(false);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Reports" />
      <div className="p-6 space-y-6">

        {/* ── Report Card Downloads ── */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            <i className="fas fa-file-pdf text-red-500 mr-2"></i>
            Student Report Cards
          </h3>
          <p className="text-gray-600 mb-4">
            Select a class, year, and term to download PDF report cards for students.
          </p>

          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassSelect(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
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
            {selectedClassId && students.length > 0 && (
              <button
                onClick={handleDownloadAll}
                disabled={downloadingAll}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium text-sm"
              >
                {downloadingAll ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Downloading All...</>
                ) : (
                  <><i className="fas fa-download mr-2"></i>Download All ({students.length})</>
                )}
              </button>
            )}
          </div>

          {loadingStudents ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : selectedClassId && students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Student Number</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Class</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Report Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">{student.student_number || '-'}</td>
                      <td className="px-4 py-3 font-medium">{student.full_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.class_name || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDownloadReport(student.id, student.full_name)}
                          disabled={downloadingId === student.id}
                          className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            downloadingId === student.id
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {downloadingId === student.id ? (
                            <>
                              <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Downloading...</span>
                            </>
                          ) : (
                            <>
                              <i className="fas fa-download text-xs"></i>
                              <span>Download PDF</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedClassId && students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-users text-4xl mb-3 opacity-40"></i>
              <p>No students found in this class.</p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-hand-pointer text-4xl mb-3 opacity-40"></i>
              <p>Select a class to view students and download their report cards.</p>
            </div>
          )}
        </div>

        {/* ── Financial Reports ── */}
        {reports.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              <i className="fas fa-chart-bar text-blue-500 mr-2"></i>
              Financial Reports
            </h3>
            <ul>
              {reports.map((report, idx) => (
                <li key={idx} className="border-b py-3 last:border-0">
                  <h4 className="font-semibold text-gray-800">{report.title}</h4>
                  <p className="text-gray-600 text-sm">{report.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
