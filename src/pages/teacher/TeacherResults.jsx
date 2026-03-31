import { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import { useAuth } from "../../context/AuthContext";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function TeacherResults() {
  const { user } = useAuth();
  const { currentAcademicYear, currentTerm } = useSchoolSettings();
  const [results, setResults] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [reportYear, setReportYear] = useState(currentAcademicYear);
  const [reportTerm, setReportTerm] = useState(currentTerm);

  // Report settings state
  const [reportTab, setReportTab] = useState('cards'); // 'cards' or 'settings'
  const [settingsClassId, setSettingsClassId] = useState('');
  const [settingsSubjectId, setSettingsSubjectId] = useState('');
  const [settingsYear, setSettingsYear] = useState(currentAcademicYear);
  const [reportResults, setReportResults] = useState([]);
  const [loadingReportResults, setLoadingReportResults] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [resultsData, classesData, subjectsData] = await Promise.all([
          apiService.fetchTeacherResults(),
          apiService.getTeacherClasses(),
          apiService.getTeacherSubjects(),
        ]);
        setResults(resultsData);
        const classList = classesData.classes || classesData || [];
        setClasses(classList);
        setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
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

  // ── Report Settings functions ──────────────────────────────────────
  const loadReportResults = async () => {
    if (!settingsClassId || !settingsSubjectId) return;
    setLoadingReportResults(true);
    setSettingsMessage(null);
    setPendingChanges({});
    try {
      const data = await apiService.getResultsForReport({
        class_id: settingsClassId,
        subject_id: settingsSubjectId,
        year: settingsYear,
      });
      setReportResults(data.results || []);
    } catch (error) {
      console.error("Error loading report results:", error);
      setSettingsMessage({ type: 'error', text: 'Failed to load results' });
    } finally {
      setLoadingReportResults(false);
    }
  };

  const handleToggleInclude = (resultId, currentValue) => {
    setPendingChanges(prev => ({
      ...prev,
      [resultId]: {
        ...prev[resultId],
        include_in_report: prev[resultId]?.include_in_report !== undefined
          ? !prev[resultId].include_in_report
          : !currentValue,
      }
    }));
  };

  const handleReportTermChange = (resultId, newTerm) => {
    setPendingChanges(prev => ({
      ...prev,
      [resultId]: {
        ...prev[resultId],
        report_term: newTerm,
      }
    }));
  };

  const getEffectiveValue = (result, field) => {
    if (pendingChanges[result.id] && pendingChanges[result.id][field] !== undefined) {
      return pendingChanges[result.id][field];
    }
    return result[field];
  };

  const saveReportSettings = async () => {
    const updates = Object.entries(pendingChanges).map(([id, changes]) => ({
      id: parseInt(id),
      ...changes,
    }));

    if (updates.length === 0) {
      setSettingsMessage({ type: 'info', text: 'No changes to save' });
      return;
    }

    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const data = await apiService.updateReportSettings({ updates });
      setSettingsMessage({ type: 'success', text: data.message || 'Settings saved successfully' });
      setPendingChanges({});
      // Reload to reflect saved state
      await loadReportResults();
    } catch (error) {
      setSettingsMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div>
      <Header title="Results & Report Cards" user={user} />
      <div className="p-6">
        {/* Results Table */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Results Overview</h3>
          {results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Student</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Subject</th>
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((res, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{res.student_name}</td>
                      <td className="px-4 py-3">{res.subject}</td>
                      <td className="px-4 py-3">{res.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No results available yet.</p>
          )}
        </div>

        {/* Report Cards & Settings Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Tab switcher */}
          <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setReportTab('cards')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                reportTab === 'cards'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <i className="fas fa-file-pdf mr-2"></i>Download Reports
            </button>
            <button
              onClick={() => setReportTab('settings')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                reportTab === 'settings'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <i className="fas fa-cog mr-2"></i>Report Card Settings
            </button>
          </div>

          {/* ── Download Reports Tab ── */}
          {reportTab === 'cards' && (
            <>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                <i className="fas fa-file-pdf text-red-500 mr-2"></i>
                Student Report Cards
              </h3>
              <p className="text-gray-600 mb-4">Download PDF report cards for students in your classes.</p>

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
                        {cls.name} ({cls.student_count} students)
                        {cls.is_class_teacher ? ' - Class Teacher' : ''}
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
            </>
          )}

          {/* ── Report Card Settings Tab ── */}
          {reportTab === 'settings' && (
            <>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                <i className="fas fa-cog text-blue-500 mr-2"></i>
                Report Card Settings
              </h3>
              <p className="text-gray-600 mb-4">
                Choose which results appear on the report card and assign them to the correct term.
                The report card will show one combined row per subject with the total score from all included results.
              </p>

              <div className="flex flex-wrap items-end gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Class</label>
                  <select
                    value={settingsClassId}
                    onChange={(e) => setSettingsClassId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Subject</label>
                  <select
                    value={settingsSubjectId}
                    onChange={(e) => setSettingsSubjectId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a subject</option>
                    {subjects.map((subj) => (
                      <option key={subj.id} value={subj.id}>{subj.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Year</label>
                  <select
                    value={settingsYear}
                    onChange={(e) => setSettingsYear(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {[...Array(5)].map((_, i) => {
                      const y = parseInt(currentAcademicYear) - i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
                <button
                  onClick={loadReportResults}
                  disabled={!settingsClassId || !settingsSubjectId || loadingReportResults}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-sm"
                >
                  {loadingReportResults ? 'Loading...' : 'Load Results'}
                </button>
              </div>

              {settingsMessage && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                  settingsMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                  settingsMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {settingsMessage.text}
                </div>
              )}

              {loadingReportResults ? (
                <div className="flex justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : reportResults.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-3 text-sm font-semibold text-gray-700">Student</th>
                          <th className="px-3 py-3 text-sm font-semibold text-gray-700">Exam Type</th>
                          <th className="px-3 py-3 text-sm font-semibold text-gray-700 text-center">Score</th>
                          <th className="px-3 py-3 text-sm font-semibold text-gray-700 text-center">Max</th>
                          <th className="px-3 py-3 text-sm font-semibold text-gray-700 text-center">%</th>
                          <th className="px-3 py-3 text-sm font-semibold text-gray-700 text-center">Original Term</th>
                          <th className="px-3 py-3 text-sm font-semibold text-gray-700 text-center">Report Term</th>
                          <th className="px-3 py-3 text-sm font-semibold text-gray-700 text-center">Include</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reportResults.map((r) => {
                          const included = getEffectiveValue(r, 'include_in_report');
                          const rTerm = pendingChanges[r.id]?.report_term !== undefined
                            ? pendingChanges[r.id].report_term
                            : r.report_term;

                          return (
                            <tr key={r.id} className={`hover:bg-gray-50 ${!included ? 'opacity-50' : ''}`}>
                              <td className="px-3 py-3 text-sm">
                                <div className="font-medium">{r.student_name}</div>
                                <div className="text-xs text-gray-400">{r.student_number}</div>
                              </td>
                              <td className="px-3 py-3 text-sm">{r.exam_type}</td>
                              <td className="px-3 py-3 text-sm text-center">{r.score}</td>
                              <td className="px-3 py-3 text-sm text-center">{r.max_score}</td>
                              <td className="px-3 py-3 text-sm text-center font-medium">{r.percentage}%</td>
                              <td className="px-3 py-3 text-sm text-center text-gray-500">{r.academic_term}</td>
                              <td className="px-3 py-3 text-center">
                                <select
                                  value={rTerm}
                                  onChange={(e) => handleReportTermChange(r.id, e.target.value)}
                                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Same as original</option>
                                  <option value="Term 1">Term 1</option>
                                  <option value="Term 2">Term 2</option>
                                  <option value="Term 3">Term 3</option>
                                </select>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => handleToggleInclude(r.id, r.include_in_report)}
                                  className={`w-10 h-6 rounded-full transition-colors relative ${
                                    included ? 'bg-green-500' : 'bg-gray-300'
                                  }`}
                                >
                                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                    included ? 'left-[18px]' : 'left-0.5'
                                  }`}></span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Save button */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      {hasChanges
                        ? `${Object.keys(pendingChanges).length} unsaved change(s)`
                        : 'No unsaved changes'}
                    </p>
                    <button
                      onClick={saveReportSettings}
                      disabled={!hasChanges || savingSettings}
                      className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                        hasChanges
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {savingSettings ? (
                        <span className="flex items-center space-x-2">
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Saving...</span>
                        </span>
                      ) : (
                        <>
                          <i className="fas fa-save mr-2"></i>Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : settingsClassId && settingsSubjectId && !loadingReportResults ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-clipboard-list text-4xl mb-3 opacity-40"></i>
                  <p>No results found. Click "Load Results" after selecting a class and subject.</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-sliders-h text-4xl mb-3 opacity-40"></i>
                  <p>Select a class, subject, and year, then click "Load Results" to manage report card entries.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
