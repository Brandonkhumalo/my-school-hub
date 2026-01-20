import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function TeacherHomework() {
  const { user } = useAuth();
  const [homework, setHomework] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    subject_id: "",
    class_id: "",
    description: "",
    due_date: "",
    file: null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [homeworkData, subjectsData, classesData] = await Promise.all([
        apiService.getTeacherHomework(),
        apiService.getTeacherSubjects(),
        apiService.getTeacherHomeworkClasses()
      ]);
      setHomework(homeworkData);
      setSubjects(subjectsData);
      setClasses(classesData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['pdf', 'doc', 'docx'].includes(ext)) {
        alert("Only PDF and Word documents are allowed");
        e.target.value = '';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        e.target.value = '';
        return;
      }
      setFormData(prev => ({ ...prev, file }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.subject_id || !formData.class_id || !formData.due_date) {
      alert("Please fill in all required fields");
      return;
    }

    if (!formData.description && !formData.file) {
      alert("Please either type homework description or upload a file");
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('title', formData.title);
      data.append('subject_id', formData.subject_id);
      data.append('class_id', formData.class_id);
      data.append('description', formData.description);
      data.append('due_date', formData.due_date);
      if (formData.file) {
        data.append('file', formData.file);
      }
      
      await apiService.createHomework(data);
      
      setFormData({
        title: "",
        subject_id: "",
        class_id: "",
        description: "",
        due_date: "",
        file: null
      });
      setShowForm(false);
      await loadData();
      alert("Homework created successfully!");
    } catch (error) {
      console.error("Error creating homework:", error);
      alert("Failed to create homework: " + (error.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (homeworkId) => {
    if (!confirm("Are you sure you want to delete this homework?")) {
      return;
    }
    
    try {
      await apiService.deleteHomework(homeworkId);
      await loadData();
    } catch (error) {
      console.error("Error deleting homework:", error);
      alert("Failed to delete homework");
    }
  };

  const handleDownload = async (homeworkId, fileName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiService.downloadHomework(homeworkId), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Download failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file");
    }
  };

  const getSubjectName = (subjectId) => {
    const subject = subjects.find(s => s.id === parseInt(subjectId));
    return subject ? subject.name : '';
  };

  if (loading) {
    return (
      <div>
        <Header title="Homework" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Homework" user={user} />
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Manage Homework</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
          >
            {showForm ? (
              <>
                <i className="fas fa-times"></i>
                Cancel
              </>
            ) : (
              <>
                <i className="fas fa-plus"></i>
                Add Homework
              </>
            )}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Homework</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="subject_id"
                    value={formData.subject_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="class_id"
                    value={formData.class_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Homework Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Chapter 5 Exercises"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {formData.subject_id && (
                  <p className="text-sm text-gray-500 mt-1">
                    Title will display as: <strong>{getSubjectName(formData.subject_id)} Homework - {formData.title || "..."}</strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Homework Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Type the homework details here..."
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload File (PDF or Word)
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Maximum file size: 10MB
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:bg-gray-400"
                >
                  {submitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2"></i>
                      Create Homework
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {homework.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <i className="fas fa-book-open text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Homework Created</h3>
            <p className="text-gray-500 mb-4">Click "Add Homework" to create your first homework assignment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homework.map(hw => (
              <div key={hw.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-blue-600 px-4 py-3">
                  <h4 className="text-lg font-semibold text-white">{hw.subject.name} Homework</h4>
                </div>
                <div className="p-4">
                  <h5 className="font-semibold text-gray-800 mb-2">{hw.title}</h5>
                  <div className="text-sm text-gray-600 mb-3 space-y-1">
                    <p><i className="fas fa-users-class mr-2"></i>Class: {hw.assigned_class.name}</p>
                    <p><i className="fas fa-calendar mr-2"></i>Due: {new Date(hw.due_date).toLocaleDateString()}</p>
                    <p><i className="fas fa-clock mr-2"></i>Created: {new Date(hw.date_created).toLocaleDateString()}</p>
                  </div>
                  
                  {hw.description && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {hw.description}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-3 border-t">
                    {hw.has_file ? (
                      <button
                        onClick={() => handleDownload(hw.id, hw.file_name)}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        <i className="fas fa-download"></i>
                        {hw.file_name}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">No file attached</span>
                    )}
                    
                    <button
                      onClick={() => handleDelete(hw.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete homework"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
