import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import PaginationControls from "../../components/PaginationControls";

export default function AdminSubjects() {
  const PAGE_SIZE = 20;
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });

  const togglePriority = async (subject) => {
    try {
      await apiService.updateSubject(subject.id, { is_priority: !subject.is_priority });
      fetchSubjects();
    } catch (error) {
      alert("Failed to update priority: " + (error.message || "Unknown error"));
    }
  };

  // Teacher assignment state
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectTeachers, setSubjectTeachers] = useState([]);
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [classes, setClasses] = useState([]);
  const [subjectClassAssignments, setSubjectClassAssignments] = useState([]);
  const [classSearch, setClassSearch] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [assignClassTeacherId, setAssignClassTeacherId] = useState("");
  const [assignAcademicYear, setAssignAcademicYear] = useState("");
  const [assignIsCore, setAssignIsCore] = useState(true);
  const [assignDuplicateStrategy, setAssignDuplicateStrategy] = useState("skip");
  const [loadingClassAssignments, setLoadingClassAssignments] = useState(false);

  useEffect(() => {
    fetchSubjects();
    fetchTeachers();
    fetchClasses();
  }, []);

  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.fetchSubjects();
      setSubjects(data);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const data = await apiService.fetchTeachers();
      setTeachers(data);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
  };

  const fetchClasses = async () => {
    try {
      const data = await apiService.getClasses();
      setClasses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiService.createSubject(formData);
      setShowForm(false);
      setFormData({ name: '', code: '', description: '' });
      fetchSubjects();
    } catch (error) {
      alert("Failed to create subject: " + (error.message || "Unknown error"));
    }
  };

  const handleDelete = async (subjectId) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;
    try {
      await apiService.deleteSubject(subjectId);
      if (selectedSubject?.id === subjectId) setSelectedSubject(null);
      fetchSubjects();
    } catch (error) {
      alert("Failed to delete subject");
    }
  };

  // Teacher assignment
  const openTeacherPanel = async (subject) => {
    setSelectedSubject(subject);
    setLoadingTeachers(true);
    try {
      const data = await apiService.getSubjectTeachers(subject.id);
      setSubjectTeachers(data);
      const classData = await apiService.getSubjectClassAssignments(subject.id);
      setSubjectClassAssignments(Array.isArray(classData) ? classData : []);
      setSelectedClassIds([]);
      setClassSearch("");
      setAssignClassTeacherId("");
      setAssignAcademicYear("");
      setAssignIsCore(true);
      setAssignDuplicateStrategy("skip");
    } catch (error) {
      console.error("Error loading subject teachers:", error);
      setSubjectTeachers([]);
      setSubjectClassAssignments([]);
    } finally {
      setLoadingTeachers(false);
      setLoadingClassAssignments(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!assignTeacherId || !selectedSubject) return;
    try {
      await apiService.assignTeacherToSubject(selectedSubject.id, assignTeacherId);
      setAssignTeacherId('');
      openTeacherPanel(selectedSubject);
      fetchSubjects();
    } catch (error) {
      alert(error.message || "Failed to assign teacher");
    }
  };

  const handleRemoveTeacher = async (teacherId) => {
    if (!confirm("Remove this teacher from the subject?")) return;
    try {
      await apiService.removeTeacherFromSubject(selectedSubject.id, teacherId);
      openTeacherPanel(selectedSubject);
      fetchSubjects();
    } catch (error) {
      alert("Failed to remove teacher");
    }
  };

  const toggleClassSelection = (classId) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const filteredClasses = classes.filter((cls) => {
    const q = classSearch.trim().toLowerCase();
    if (!q) return true;
    return `${cls.name} ${cls.grade_level} ${cls.academic_year}`.toLowerCase().includes(q);
  });

  const handleAssignToClasses = async () => {
    if (!selectedSubject || selectedClassIds.length === 0) return;
    try {
      setLoadingClassAssignments(true);
      const payload = {
        class_ids: selectedClassIds,
        teacher_id: assignClassTeacherId || null,
        academic_year: assignAcademicYear || "",
        is_core: assignIsCore,
        duplicate_strategy: assignDuplicateStrategy,
      };
      const res = await apiService.assignSubjectToClasses(selectedSubject.id, payload);
      if (res?.errors?.length) {
        alert(`Assigned with ${res.errors.length} error(s). Check your selections.`);
      }
      const classData = await apiService.getSubjectClassAssignments(selectedSubject.id);
      setSubjectClassAssignments(Array.isArray(classData) ? classData : []);
      setSelectedClassIds([]);
      fetchSubjects();
    } catch (error) {
      alert(error.message || "Failed to assign subject to classes");
    } finally {
      setLoadingClassAssignments(false);
    }
  };

  const handleRemoveClassAssignment = async (assignmentId) => {
    if (!selectedSubject) return;
    if (!confirm("Remove this class assignment?")) return;
    try {
      await apiService.removeSubjectClassAssignment(selectedSubject.id, assignmentId);
      const classData = await apiService.getSubjectClassAssignments(selectedSubject.id);
      setSubjectClassAssignments(Array.isArray(classData) ? classData : []);
    } catch (error) {
      alert(error.message || "Failed to remove class assignment");
    }
  };

  // Teachers not already assigned to the selected subject
  const availableTeachers = teachers.filter(
    t => !subjectTeachers.some(st => st.id === t.id)
  );
  const totalPages = Math.max(1, Math.ceil(subjects.length / PAGE_SIZE));
  const paginatedSubjects = subjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (isLoading) return (
    <div>
      <Header title="Subjects" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Subjects" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">All Subjects ({subjects.length})</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 flex items-center"
          >
            <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'} mr-2`}></i>
            {showForm ? 'Cancel' : 'Add Subject'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Add New Subject</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required
                  placeholder="e.g., Mathematics" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code *</label>
                <input type="text" name="code" value={formData.code} onChange={handleInputChange} required
                  placeholder="e.g., MATH" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3"
                  placeholder="Brief description..." className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="col-span-full">
                <button type="submit" className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600">
                  <i className="fas fa-plus mr-2"></i>Create Subject
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subject List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {subjects.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Priority</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Teacher(s)</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedSubjects.map((subject) => (
                        <tr key={subject.id} className={`hover:bg-gray-50 cursor-pointer ${selectedSubject?.id === subject.id ? 'bg-purple-50' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-semibold">
                              {subject.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{subject.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={(e) => { e.stopPropagation(); togglePriority(subject); }}
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                subject.is_priority
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                              title={subject.is_priority ? 'Priority: gets daily periods. Click to remove.' : 'Click to make priority (daily periods)'}
                            >
                              <i className={`fas fa-star mr-1 ${subject.is_priority ? 'text-amber-500' : 'text-gray-400'}`}></i>
                              {subject.is_priority ? 'Daily' : 'Normal'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-blue-600 text-sm">{subject.teacher_names || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                            <button onClick={() => openTeacherPanel(subject)}
                              className="text-purple-600 hover:text-purple-800 font-medium">
                              <i className="fas fa-user-edit mr-1"></i>Teachers
                            </button>
                            <button onClick={() => handleDelete(subject.id)}
                              className="text-red-600 hover:text-red-800">
                              <i className="fas fa-trash mr-1"></i>Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={subjects.length}
                    pageSize={PAGE_SIZE}
                    onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  />
                </>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-book text-gray-400 text-6xl mb-4"></i>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No subjects found</h3>
                  <p className="text-gray-500 mb-4">Create your first subject to get started</p>
                  <button onClick={() => setShowForm(true)}
                    className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600">
                    <i className="fas fa-plus mr-2"></i>Add First Subject
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Teacher Assignment Panel */}
          <div className="lg:col-span-1">
            {selectedSubject ? (
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
                <h3 className="text-lg font-bold text-gray-800 mb-1">
                  <i className="fas fa-chalkboard-teacher mr-2 text-purple-600"></i>
                  Assign Teachers
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {selectedSubject.code} — {selectedSubject.name}
                </p>

                {/* Add teacher */}
                <div className="flex space-x-2 mb-4">
                  <select value={assignTeacherId} onChange={(e) => setAssignTeacherId(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                    <option value="">Select teacher...</option>
                    {availableTeachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.first_name || t.user?.first_name} {t.last_name || t.user?.last_name}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleAssignTeacher} disabled={!assignTeacherId}
                    className="bg-purple-500 text-white px-3 py-2 rounded hover:bg-purple-600 disabled:opacity-50 text-sm">
                    <i className="fas fa-plus"></i>
                  </button>
                </div>

                {/* Assigned teachers list */}
                {loadingTeachers ? (
                  <div className="text-center py-4 text-gray-500">Loading...</div>
                ) : subjectTeachers.length > 0 ? (
                  <ul className="space-y-2">
                    {subjectTeachers.map(t => (
                      <li key={t.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{t.first_name} {t.last_name}</p>
                          <p className="text-xs text-gray-500">{t.email}</p>
                        </div>
                        <button onClick={() => handleRemoveTeacher(t.id)}
                          className="text-red-500 hover:text-red-700 text-sm">
                          <i className="fas fa-times"></i>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No teachers assigned yet</p>
                )}

                <hr className="my-6" />

                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  <i className="fas fa-layer-group mr-2 text-purple-600"></i>
                  Assign To Classes
                </h3>
                <p className="text-xs text-gray-500 mb-3">Select one or many classes for this subject.</p>

                <input
                  type="text"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Search classes (Form 1A, Grade 2 Red)"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2"
                />

                <div className="max-h-32 overflow-y-auto border rounded-md p-2 mb-3">
                  {filteredClasses.length ? filteredClasses.map((cls) => (
                    <label key={cls.id} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={selectedClassIds.includes(cls.id)}
                        onChange={() => toggleClassSelection(cls.id)}
                      />
                      <span>{cls.name} • Grade {cls.grade_level} • {cls.academic_year}</span>
                    </label>
                  )) : <p className="text-xs text-gray-500">No classes found</p>}
                </div>

                <div className="space-y-2 mb-3">
                  <select
                    value={assignClassTeacherId}
                    onChange={(e) => setAssignClassTeacherId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">No teacher (optional)</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name || t.user?.first_name} {t.last_name || t.user?.last_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={assignAcademicYear}
                    onChange={(e) => setAssignAcademicYear(e.target.value)}
                    placeholder="Academic year (optional)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <select
                    value={assignDuplicateStrategy}
                    onChange={(e) => setAssignDuplicateStrategy(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="skip">Duplicate: skip</option>
                    <option value="update">Duplicate: update</option>
                    <option value="error">Duplicate: error</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={assignIsCore}
                      onChange={(e) => setAssignIsCore(e.target.checked)}
                    />
                    <span>Core subject</span>
                  </label>
                </div>

                <button
                  onClick={handleAssignToClasses}
                  disabled={!selectedClassIds.length || loadingClassAssignments}
                  className="w-full bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm"
                >
                  {loadingClassAssignments ? "Assigning..." : `Assign to ${selectedClassIds.length} class(es)`}
                </button>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Current Class Assignments</p>
                  {subjectClassAssignments.length ? (
                    <ul className="space-y-2 max-h-44 overflow-y-auto">
                      {subjectClassAssignments.map((a) => (
                        <li key={a.id} className="flex items-start justify-between bg-gray-50 px-3 py-2 rounded">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{a.class_name}</p>
                            <p className="text-xs text-gray-500">
                              {a.academic_year} • {a.is_core ? "Core" : "Optional"}{a.teacher_name ? ` • ${a.teacher_name}` : ""}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveClassAssignment(a.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">No class assignments yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
                <p className="text-sm">Select a subject to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
