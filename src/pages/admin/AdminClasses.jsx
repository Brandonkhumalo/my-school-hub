import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [schoolType, setSchoolType] = useState('combined');
  const [formData, setFormData] = useState({
    grade_level: '',
    section: '',
    academic_year: new Date().getFullYear().toString(),
    class_teacher: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [classesData, teachersData, statsData] = await Promise.all([
        apiService.fetchClasses(),
        apiService.fetchTeachers(),
        apiService.getDashboardStats()
      ]);
      setClasses(classesData);
      setTeachers(teachersData);
      if (statsData.school_type) {
        setSchoolType(statsData.school_type);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getGradeLevelName = (level) => {
    if (level === 0) return 'ECD A';
    if (level === -1) return 'ECD B';
    if (level <= 7) return `Grade ${level}`;
    return `Form ${level - 7}`;
  };

  const generateClassName = () => {
    if (!formData.grade_level) return '';
    const levelName = getGradeLevelName(parseInt(formData.grade_level));
    const section = formData.section ? ` ${formData.section.toUpperCase()}` : '';
    return `${levelName}${section}`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const className = generateClassName();
      await apiService.createClass({
        name: className,
        grade_level: parseInt(formData.grade_level),
        academic_year: formData.academic_year,
        class_teacher: formData.class_teacher || null
      });
      setShowForm(false);
      setFormData({
        grade_level: '',
        section: '',
        academic_year: new Date().getFullYear().toString(),
        class_teacher: ''
      });
      fetchData();
    } catch (error) {
      console.error("Error creating class:", error);
      alert("Failed to create class: " + (error.message || "Unknown error"));
    }
  };

  const handleDelete = async (classId) => {
    if (!confirm("Are you sure you want to delete this class?")) return;
    try {
      await apiService.deleteClass(classId);
      fetchData();
    } catch (error) {
      console.error("Error deleting class:", error);
      alert("Failed to delete class");
    }
  };

  const showPrimary = schoolType === 'primary' || schoolType === 'combined';
  const showSecondary = schoolType === 'secondary' || schoolType === 'high' || schoolType === 'combined';

  if (isLoading) return (
    <div>
      <Header title="Classes" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Classes" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">All Classes ({classes.length})</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center"
          >
            <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'} mr-2`}></i>
            {showForm ? 'Cancel' : 'Add Class'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Add New Class</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade/Form Level *</label>
                <select
                  name="grade_level"
                  value={formData.grade_level}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select grade/form level...</option>
                  {showPrimary && (
                    <optgroup label="Primary (ECD - Grade 7)">
                      <option value="-1">ECD B</option>
                      <option value="0">ECD A</option>
                      <option value="1">Grade 1</option>
                      <option value="2">Grade 2</option>
                      <option value="3">Grade 3</option>
                      <option value="4">Grade 4</option>
                      <option value="5">Grade 5</option>
                      <option value="6">Grade 6</option>
                      <option value="7">Grade 7</option>
                    </optgroup>
                  )}
                  {showSecondary && (
                    <optgroup label="Secondary (Form 1 - Form 6)">
                      <option value="8">Form 1</option>
                      <option value="9">Form 2</option>
                      <option value="10">Form 3</option>
                      <option value="11">Form 4</option>
                      <option value="12">Form 5 (Lower 6)</option>
                      <option value="13">Form 6 (Upper 6)</option>
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section/Stream</label>
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  placeholder="e.g., A, B, C, Red, Blue"
                  maxLength="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: Add A, B, C or custom section name</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                <input
                  type="text"
                  name="academic_year"
                  value={formData.academic_year}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Teacher (Optional)</label>
                <select
                  name="class_teacher"
                  value={formData.class_teacher}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No class teacher assigned</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.user?.id}>
                      {teacher.user?.full_name || `${teacher.user?.first_name} ${teacher.user?.last_name}`}
                    </option>
                  ))}
                </select>
              </div>
              {formData.grade_level && (
                <div className="col-span-full">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      <i className="fas fa-info-circle mr-2"></i>
                      Class will be created as: <strong>{generateClassName()}</strong>
                    </p>
                  </div>
                </div>
              )}
              <div className="col-span-full">
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
                >
                  <i className="fas fa-plus mr-2"></i>Create Class
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {classes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Academic Year</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class Teacher</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {classes.map((cls) => (
                    <tr key={cls.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3">
                            <i className="fas fa-chalkboard"></i>
                          </div>
                          <span className="font-medium text-gray-900">{cls.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${cls.grade_level <= 7 ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                          {cls.grade_level <= 7 ? (cls.grade_level === 0 ? 'ECD A' : cls.grade_level === -1 ? 'ECD B' : `Grade ${cls.grade_level}`) : `Form ${cls.grade_level - 7}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cls.academic_year}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cls.class_teacher_name || cls.teacher_name || <span className="text-gray-400">Not assigned</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDelete(cls.id)}
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
              <i className="fas fa-chalkboard text-gray-400 text-6xl mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No classes found</h3>
              <p className="text-gray-500 mb-4">Create your first class to get started</p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
              >
                <i className="fas fa-plus mr-2"></i>Add First Class
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
