import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

// AdminSubjects Component - v2 with Add Subject functionality
export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: ''
  });

  useEffect(() => {
    fetchSubjects();
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
      console.error("Error creating subject:", error);
      alert("Failed to create subject: " + (error.message || "Unknown error"));
    }
  };

  const handleDelete = async (subjectId) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;
    try {
      await apiService.deleteSubject(subjectId);
      fetchSubjects();
    } catch (error) {
      console.error("Error deleting subject:", error);
      alert("Failed to delete subject");
    }
  };

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
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Mathematics, English, Science"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code *</label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., MATH, ENG, SCI"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Brief description of the subject..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="col-span-full">
                <button
                  type="submit"
                  className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600"
                >
                  <i className="fas fa-plus mr-2"></i>Create Subject
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {subjects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Teacher(s)</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-semibold">
                          {subject.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{subject.name}</td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{subject.description || '-'}</td>
                      <td className="px-6 py-4 text-blue-600">{subject.teacher_names || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDelete(subject.id)}
                          className="text-red-600 hover:text-red-800"
                        >
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
              <button
                onClick={() => setShowForm(true)}
                className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600"
              >
                <i className="fas fa-plus mr-2"></i>Add First Subject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
