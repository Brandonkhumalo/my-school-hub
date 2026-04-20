import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

function buildComponentOptions(plan) {
  if (!plan) return [];
  const options = [];

  (plan.effective_papers || []).forEach((paperNumber) => {
    options.push({
      label: `Paper ${paperNumber}`,
      value: `paper_${paperNumber}`,
      component_kind: "paper",
      component_index: paperNumber,
      exam_type: `Paper ${paperNumber}`,
    });
  });

  for (let i = 1; i <= Number(plan.num_tests || 0); i += 1) {
    options.push({
      label: `Test ${i}`,
      value: `test_${i}`,
      component_kind: "test",
      component_index: i,
      exam_type: `Test ${i}`,
    });
  }

  for (let i = 1; i <= Number(plan.num_assignments || 0); i += 1) {
    options.push({
      label: `Assignment ${i}`,
      value: `assignment_${i}`,
      component_kind: "assignment",
      component_index: i,
      exam_type: `Assignment ${i}`,
    });
  }

  options.push({
    label: "Other (ad-hoc)",
    value: "other",
    component_kind: "",
    component_index: null,
    exam_type: "",
  });

  return options;
}

export default function TeacherMarks() {
  const { user } = useAuth();
  const { currentAcademicYear, currentTerm } = useSchoolSettings();

  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [academicYear, setAcademicYear] = useState(String(currentAcademicYear));
  const [academicTerm, setAcademicTerm] = useState(currentTerm);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("");
  const [manualExamType, setManualExamType] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [includeInReport, setIncludeInReport] = useState(true);
  const [reportTerm, setReportTerm] = useState("");

  const [assessmentPlan, setAssessmentPlan] = useState(null);
  const [componentOptions, setComponentOptions] = useState([]);
  const [planBannerMessage, setPlanBannerMessage] = useState("");

  const filteredStudents = useMemo(() => {
    if (!selectedClassId) return students;
    return students.filter((s) => String(s.class_id) === String(selectedClassId));
  }, [students, selectedClassId]);

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      try {
        const data = await apiService.getTeacherSubjects();
        const normalized = Array.isArray(data) ? data : [];
        setSubjects(normalized);
        if (normalized.length > 0) {
          setSelectedSubject(String(normalized[0].id));
        }
      } catch (error) {
        console.error("Error loading subjects:", error);
        alert("Failed to load subjects.");
      } finally {
        setLoading(false);
      }
    };
    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedSubject) return;
    const loadSubjectData = async () => {
      setLoadingStudents(true);
      try {
        const data = await apiService.getSubjectStudents(selectedSubject);
        const rows = Array.isArray(data) ? data : [];
        setStudents(rows);
        const classMap = new Map();
        rows.forEach((s) => {
          if (!s.class_id) return;
          if (!classMap.has(String(s.class_id))) {
            classMap.set(String(s.class_id), {
              id: String(s.class_id),
              name: s.class || "Not Assigned",
              grade_level: s.grade_level,
            });
          }
        });
        const uniqueClasses = Array.from(classMap.values());
        setClasses(uniqueClasses);
        setSelectedClassId((prev) => (
          uniqueClasses.some((c) => c.id === String(prev)) ? String(prev) : (uniqueClasses[0]?.id || "")
        ));
      } catch (error) {
        console.error("Error loading students:", error);
        setStudents([]);
        setClasses([]);
        setSelectedClassId("");
      } finally {
        setLoadingStudents(false);
      }
    };
    loadSubjectData();
  }, [selectedSubject]);

  useEffect(() => {
    if (!selectedSubject || !academicYear || !academicTerm) return;
    const loadPlan = async () => {
      setLoadingPlan(true);
      setPlanBannerMessage("");
      try {
        const payload = await apiService.getAssessmentPlanForTeacher(
          selectedSubject,
          academicYear,
          academicTerm,
          selectedClassId
        );
        const plan = payload?.plan || null;
        setAssessmentPlan(plan);
        const options = buildComponentOptions(plan);
        setComponentOptions(options);
        setSelectedComponent("");
        setManualExamType("");
        setIncludeInReport(true);

        if (!plan) {
          setPlanBannerMessage(
            "No assessment plan set — contact admin. You can still enter marks but they'll be flagged as ad-hoc."
          );
        }
      } catch (error) {
        console.error("Error loading assessment plan:", error);
        setAssessmentPlan(null);
        setComponentOptions([]);
        setSelectedComponent("");
        setManualExamType("");
        setPlanBannerMessage(
          "No assessment plan set — contact admin. You can still enter marks but they'll be flagged as ad-hoc."
        );
      } finally {
        setLoadingPlan(false);
      }
    };
    loadPlan();
  }, [selectedSubject, academicYear, academicTerm, selectedClassId]);

  const selectedOption = componentOptions.find((opt) => opt.value === selectedComponent) || null;
  const isAdHocEntry = !assessmentPlan || selectedComponent === "other";

  useEffect(() => {
    if (selectedComponent === "other") {
      setIncludeInReport(false);
    } else if (selectedComponent) {
      setIncludeInReport(true);
    }
  }, [selectedComponent]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const scoreNum = Number(score);
    const maxScoreNum = Number(maxScore);
    if (!selectedSubject || !selectedStudent || !Number.isFinite(scoreNum) || !Number.isFinite(maxScoreNum)) {
      alert("Please fill in all required fields.");
      return;
    }
    if (maxScoreNum <= 0) {
      alert("Max score must be greater than 0.");
      return;
    }
    if (scoreNum < 0) {
      alert("Score cannot be negative.");
      return;
    }
    if (scoreNum > maxScoreNum) {
      alert("Score cannot exceed max score.");
      return;
    }

    if (assessmentPlan && !selectedComponent) {
      alert("Select a planned component or choose Other.");
      return;
    }

    const examType =
      isAdHocEntry
        ? (manualExamType || "").trim()
        : (selectedOption?.exam_type || "").trim();

    if (!examType) {
      alert("Enter an assessment type for ad-hoc entries.");
      return;
    }

    const payload = {
      student_id: selectedStudent,
      subject_id: selectedSubject,
      exam_type: examType,
      // Send raw values; backend handles exact normalization/rounding.
      score: String(score).trim(),
      max_score: String(maxScore).trim(),
      academic_term: academicTerm,
      academic_year: academicYear,
      include_in_report: selectedComponent === "other" ? false : includeInReport,
      report_term: reportTerm,
    };

    if (assessmentPlan && selectedOption && selectedComponent !== "other") {
      payload.assessment_plan = assessmentPlan.id;
      payload.component_kind = selectedOption.component_kind;
      payload.component_index = selectedOption.component_index;
    }

    setSubmitting(true);
    try {
      await apiService.addStudentMark(payload);
      alert("Mark added successfully.");
      setSelectedStudent("");
      setSelectedComponent("");
      setManualExamType("");
      setScore("");
    } catch (error) {
      console.error("Error adding mark:", error);
      alert(error.message || "Failed to add mark.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="Add Student Marks" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Add Student Marks" user={user} />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Enter Student Marks</h2>
          <p className="text-gray-600 mt-2">Plan-linked mark entry with ad-hoc fallback.</p>
        </div>

        {planBannerMessage && (
          <div className="mb-6 px-4 py-3 rounded-lg border-l-4 bg-yellow-50 border-yellow-400 text-yellow-800">
            <div className="flex items-start">
              <i className="fas fa-exclamation-triangle mr-3 mt-0.5"></i>
              <p className="text-sm">{planBannerMessage}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedClassId("");
                    setSelectedStudent("");
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={String(subject.id)}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedStudent("");
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Classes</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}{cls.grade_level ? ` (Grade ${cls.grade_level})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[...Array(5)].map((_, i) => {
                    const y = String(parseInt(currentAcademicYear, 10) - i);
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                <select
                  value={academicTerm}
                  onChange={(e) => setAcademicTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                  <option value="Term 4">Term 4</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={loadingStudents}
              >
                <option value="">Select student...</option>
                {filteredStudents.map((student) => (
                  <option key={student.id} value={String(student.id)}>
                    {student.name} {student.surname} - {student.class}
                  </option>
                ))}
              </select>
            </div>

            {loadingPlan ? (
              <div className="flex items-center text-sm text-gray-600">
                <i className="fas fa-spinner fa-spin mr-2"></i>Loading plan components...
              </div>
            ) : (
              <>
                {assessmentPlan ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Component <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedComponent}
                      onChange={(e) => setSelectedComponent(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select planned component...</option>
                      {componentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {(isAdHocEntry || !assessmentPlan) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assessment Type <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualExamType}
                      onChange={(e) => setManualExamType(e.target.value)}
                      placeholder="e.g. Quiz, Paper 2 Rewrite, Practical"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={isAdHocEntry}
                    />
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Score <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Score <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-3">
                <i className="fas fa-file-pdf mr-1"></i>Report Card Options
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">Include in report card</span>
                  <div
                    onClick={() => {
                      if (selectedComponent === "other") return;
                      setIncludeInReport(!includeInReport);
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      (selectedComponent === "other" ? false : includeInReport) ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        (selectedComponent === "other" ? false : includeInReport) ? "left-[22px]" : "left-0.5"
                      }`}
                    ></span>
                  </div>
                </label>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Report term (override)</label>
                  <select
                    value={reportTerm}
                    onChange={(e) => setReportTerm(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Same as term above</option>
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                    <option value="Term 4">Term 4</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedStudent}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:bg-gray-400"
            >
              {submitting ? (
                <span><i className="fas fa-spinner fa-spin mr-2"></i>Submitting...</span>
              ) : (
                <span><i className="fas fa-check mr-2"></i>Add Mark</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
