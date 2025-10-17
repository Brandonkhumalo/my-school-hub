import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCredentials, setShowCredentials] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    hire_date: new Date().toISOString().split('T')[0],
    qualification: '',
    password: '',
    is_secondary_teacher: false,
    subject_ids: [],
    assigned_class_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [teachersData, subjectsData, classesData] = await Promise.all([
        apiService.fetchTeachers(),
        apiService.fetchSubjects(),
        apiService.fetchClasses()
      ]);
      setTeachers(teachersData);
      setSubjects(subjectsData);
      setClasses(classesData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubjectToggle = (subjectId) => {
    const currentSubjects = formData.subject_ids;
    if (currentSubjects.includes(subjectId)) {
      setFormData({
        ...formData,
        subject_ids: currentSubjects.filter(id => id !== subjectId)
      });
    } else {
      if (currentSubjects.length < 3) {
        setFormData({
          ...formData,
          subject_ids: [...currentSubjects, subjectId]
        });
      } else {
        alert("Maximum 3 subjects allowed");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.is_secondary_teacher && (formData.subject_ids.length < 1 || formData.subject_ids.length > 3)) {
      alert("Secondary teachers must be assigned 1-3 subjects");
      return;
    }
    
    try {
      const response = await apiService.createTeacher(formData);
      setShowCredentials(response);
      setShowForm(false);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        hire_date: new Date().toISOString().split('T')[0],
        qualification: '',
        password: '',
        is_secondary_teacher: false,
        subject_ids: [],
        assigned_class_id: ''
      });
      fetchData();
    } catch (error) {
      console.error("Error creating teacher:", error);
      alert("Failed to create teacher: " + (error.message || "Unknown error"));
    }
  };

  if (isLoading) return (
    <div>
      <Header title="Teachers" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Teachers" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">All Teachers ({teachers.length})</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center"
          >
            <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'} mr-2`}></i>
            {showForm ? 'Cancel' : 'Add Teacher'}
          </button>
        </div>

        {showCredentials && (
          <div className="bg-green-50 border border-green-400 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-3">Teacher Created Successfully!</h3>
                <div className="space-y-2">
                  <p className="text-gray-700"><strong>Name:</strong> {showCredentials.full_name}</p>
                  <p className="text-gray-700"><strong>Staff Number:</strong> <span className="font-mono bg-green-100 px-2 py-1 rounded">{showCredentials.staff_number}</span></p>
                  <p className="text-gray-700"><strong>Email:</strong> {showCredentials.email}</p>
                  <p className="text-gray-700"><strong>Password:</strong> <span className="font-mono bg-green-100 px-2 py-1 rounded">{showCredentials.password}</span></p>
                  <p className="text-sm text-green-700 mt-2">Use the staff number and password to log in</p>
                </div>
              </div>
              <button onClick={() => setShowCredentials(null)} className="text-green-600 hover:text-green-800">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Add New Teacher</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date *</label>
                <input
                  type="date"
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                <input
                  type="text"
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleInputChange}
                  placeholder="e.g., B.Ed., M.Ed., Ph.D."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength="6"
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="col-span-full">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_secondary_teacher"
                    checked={formData.is_secondary_teacher}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Secondary School Teacher (assign subjects)</span>
                </label>
              </div>

              {formData.is_secondary_teacher && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subjects (Select 1-3) *</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Array.isArray(subjects) && subjects.map((subject) => (
                      <label key={subject.id} className="flex items-center p-2 border rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={formData.subject_ids.includes(subject.id)}
                          onChange={() => handleSubjectToggle(subject.id)}
                          className="mr-2"
                        />
                        <span className="text-sm">{subject.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!formData.is_secondary_teacher && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Class (Primary Teacher)</label>
                  <select
                    name="assigned_class_id"
                    value={formData.assigned_class_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select a class (optional)...</option>
                    {Array.isArray(classes) && classes.filter(c => c.grade_level <= 7).map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="col-span-full">
                <button
                  type="submit"
                  className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
                >
                  Add Teacher
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {teachers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qualification</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hire Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{teacher.user.full_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.user.phone_number || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.qualification || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.hire_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-chalkboard-teacher text-gray-400 text-6xl mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No teachers found</h3>
              <p className="text-gray-500 mb-4">Add teachers to get started</p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
              >
                <i className="fas fa-plus mr-2"></i>
                Add Teacher
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
