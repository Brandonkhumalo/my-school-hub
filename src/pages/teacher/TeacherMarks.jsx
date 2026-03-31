import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSchoolSettings } from "../../context/SchoolSettingsContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function TeacherMarks() {
  const { user } = useAuth();
  const { currentAcademicYear, currentTerm } = useSchoolSettings();
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const currentYear = currentAcademicYear;

  const [selectedStudent, setSelectedStudent] = useState("");
  const [examType, setExamType] = useState("Midterm");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [academicTerm, setAcademicTerm] = useState(currentTerm);
  const [includeInReport, setIncludeInReport] = useState(true);
  const [reportTerm, setReportTerm] = useState("");

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadStudents();
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedClass && students.length > 0) {
      const filtered = students.filter(s => s.class === selectedClass);
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents(students);
    }
    setSelectedStudent("");
  }, [selectedClass, students]);

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

  const loadStudents = async () => {
    try {
      const data = await apiService.getSubjectStudents(selectedSubject);
      setStudents(data);
      
      const uniqueClasses = [...new Set(data.map(s => s.class).filter(Boolean))];
      setClasses(uniqueClasses);
      
      if (uniqueClasses.length > 0 && !selectedClass) {
        setSelectedClass(uniqueClasses[0]);
      }
    } catch (error) {
      console.error("Error loading students:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedStudent || !score || !maxScore) {
      alert("Please fill in all required fields");
      return;
    }

    const scoreNum = parseFloat(score);
    const maxScoreNum = parseFloat(maxScore);

    if (scoreNum > maxScoreNum) {
      alert("Score cannot exceed maximum score");
      return;
    }

    try {
      setSubmitting(true);
      await apiService.addStudentMark({
        student_id: selectedStudent,
        subject_id: selectedSubject,
        exam_type: examType,
        score: scoreNum,
        max_score: maxScoreNum,
        academic_term: academicTerm,
        academic_year: currentYear,
        include_in_report: includeInReport,
        report_term: reportTerm
      });

      alert("Mark added successfully!");
      
      setSelectedStudent("");
      setScore("");
      
      await loadStudents();
    } catch (error) {
      console.error("Error adding mark:", error);
      alert("Failed to add mark. Please try again.");
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
          <p className="text-gray-600 mt-2">Add marks for your students by subject and class</p>
        </div>

        {subjects.length === 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-yellow-800">No subjects assigned. Contact administrator.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              <i className="fas fa-edit mr-2 text-blue-600"></i>
              Add New Mark
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedSubject || ""}
                  onChange={(e) => {
                    setSelectedSubject(parseInt(e.target.value));
                    setSelectedClass("");
                  }}
                >
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">All Classes</option>
                  {classes.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  required
                >
                  <option value="">Select a student...</option>
                  {filteredStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name} {student.surname} - {student.class}
                    </option>
                  ))}
                </select>
                {filteredStudents.length === 0 && selectedClass && (
                  <p className="text-sm text-gray-500 mt-1">No students in this class</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exam Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  required
                >
                  <option value="Midterm">Midterm</option>
                  <option value="Final">Final Exam</option>
                  <option value="Quiz">Quiz</option>
                  <option value="Assignment">Assignment</option>
                  <option value="Test">Class Test</option>
                  <option value="Project">Project</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Score <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="e.g., 85"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Score <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    placeholder="e.g., 100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Term
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={academicTerm}
                    onChange={(e) => setAcademicTerm(e.target.value)}
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                    <option value="Term 4">Term 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    value={currentYear}
                    disabled
                    readOnly
                  />
                </div>
              </div>

              {/* Report Card Options */}
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">
                  <i className="fas fa-file-pdf mr-1"></i> Report Card Options
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-gray-700">Include in report card</span>
                      <div
                        onClick={() => setIncludeInReport(!includeInReport)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${includeInReport ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includeInReport ? 'left-[22px]' : 'left-0.5'}`}></span>
                      </div>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Report term <span className="text-xs text-gray-400">(override)</span>
                    </label>
                    <select
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={reportTerm}
                      onChange={(e) => setReportTerm(e.target.value)}
                    >
                      <option value="">Same as term above</option>
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
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
                  <span>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Submitting...
                  </span>
                ) : (
                  <span>
                    <i className="fas fa-check mr-2"></i>
                    Add Mark
                  </span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
