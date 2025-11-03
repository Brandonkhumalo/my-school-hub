import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function TeacherMarks() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedStudent, setSelectedStudent] = useState("");
  const [examType, setExamType] = useState("Midterm");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [academicTerm, setAcademicTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadStudents();
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

  const loadStudents = async () => {
    try {
      const data = await apiService.getSubjectStudents(selectedSubject);
      setStudents(data);
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
        academic_year: academicYear
      });

      alert("Mark added successfully!");
      
      // Reset form
      setSelectedStudent("");
      setScore("");
      
      // Reload students to show updated scores
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

  const currentSubject = subjects.find(s => s.id === selectedSubject);

  return (
    <div>
      <Header title="Add Student Marks" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Enter Student Marks</h2>
          <p className="text-gray-600 mt-2">Add marks for your students by subject</p>
        </div>

        {subjects.length === 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-yellow-800">No subjects assigned. Contact administrator.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Marks Entry Form */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                <i className="fas fa-edit mr-2 text-blue-600"></i>
                Add New Mark
              </h3>

              {/* Subject Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedSubject || ""}
                  onChange={(e) => setSelectedSubject(parseInt(e.target.value))}
                >
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Student Selector */}
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
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.name} {student.surname} - {student.class}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Exam Type */}
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

                {/* Score and Max Score */}
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

                {/* Academic Term and Year */}
                <div className="grid grid-cols-2 gap-4 mb-6">
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
                      type="number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      placeholder="2025"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
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

            {/* Students List */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                <i className="fas fa-users mr-2 text-green-600"></i>
                Students in {currentSubject?.name}
              </h3>

              {students.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fas fa-user-graduate text-6xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500">No students found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {students.map(student => (
                    <div
                      key={student.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {student.name} {student.surname}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Class: {student.class} | #{student.student_number}
                          </p>
                          {student.latest_score !== null && (
                            <p className="text-sm text-blue-600 mt-1">
                              Latest: {student.latest_score}/{student.latest_max_score} ({student.latest_exam_type})
                            </p>
                          )}
                        </div>
                        {student.latest_score !== null && (
                          <div className="text-2xl font-bold text-green-600">
                            {Math.round((student.latest_score / student.latest_max_score) * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
