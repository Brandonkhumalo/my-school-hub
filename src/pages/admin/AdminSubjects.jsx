import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
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

  useEffect(() => {
    fetchSubjects();
    fetchTeachers();
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
    } catch (error) {
      console.error("Error loading subject teachers:", error);
      setSubjectTeachers([]);
    } finally {
      setLoadingTeachers(false);
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

  // Teachers not already assigned to the selected subject
  const availableTeachers = teachers.filter(
    t => !subjectTeachers.some(st => st.id === t.id)
  );

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
                      {subjects.map((subject) => (
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
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
                <i className="fas fa-hand-pointer text-4xl mb-3 text-gray-300"></i>
                <p className="text-sm">Click "Teachers" on a subject to manage teacher assignments</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
