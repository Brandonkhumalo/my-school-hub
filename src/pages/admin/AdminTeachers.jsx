import React, { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import PaginationControls from "../../components/PaginationControls";
import { formatDate, toInputDate } from "../../utils/dateFormat";

export default function AdminTeachers() {
  const PAGE_SIZE = 20;
  const getInitialFormData = () => ({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    gender: '',
    hire_date: new Date().toISOString().split('T')[0],
    qualification: '',
    salary: '',
    password: '',
    is_secondary_teacher: false,
    subject_ids: [],
    teaching_class_ids: [],
    assigned_class_id: ''
  });

  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [showCredentials, setShowCredentials] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [formData, setFormData] = useState(getInitialFormData());

  const resetForm = () => {
    setFormData(getInitialFormData());
    setShowForm(false);
    setEditingTeacher(null);
  };

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

  const filteredTeachers = useMemo(() => {
    if (!searchQuery) return teachers;
    const query = searchQuery.toLowerCase();
    return teachers.filter(teacher => {
      const fullName = (
        teacher.user?.full_name ||
        `${teacher.user?.first_name || ''} ${teacher.user?.last_name || ''}`.trim()
      ).toLowerCase();
      const email = teacher.user?.email?.toLowerCase() || '';
      const staffNumber = teacher.user?.student_number?.toLowerCase() || '';
      return fullName.includes(query) || email.includes(query) || staffNumber.includes(query);
    });
  }, [teachers, searchQuery]);

  const getTeacherName = (teacher) => {
    const explicitName =
      teacher?.user?.full_name ||
      `${teacher?.user?.first_name || ''} ${teacher?.user?.last_name || ''}`.trim();
    if (explicitName) return explicitName;
    const emailFallback = teacher?.user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
    return emailFallback || '-';
  };

  const availableClasses = useMemo(() => {
    if (!Array.isArray(classes)) return [];
    const editableClassIds = new Set(
      (editingTeacher?.class_taught || []).map((cls) => String(cls.id))
    );
    return classes.filter(
      (cls) =>
        !cls.class_teacher ||
        !cls.class_teacher_name ||
        editableClassIds.has(String(cls.id))
    );
  }, [classes, editingTeacher]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredTeachers.length / PAGE_SIZE)),
    [filteredTeachers.length]
  );

  const paginatedTeachers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTeachers.slice(start, start + PAGE_SIZE);
  }, [filteredTeachers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (
      formData.assigned_class_id &&
      !availableClasses.some((cls) => String(cls.id) === String(formData.assigned_class_id))
    ) {
      setFormData((prev) => ({ ...prev, assigned_class_id: '' }));
    }
  }, [availableClasses, formData.assigned_class_id]);

  useEffect(() => {
    if (!Array.isArray(classes) || classes.length === 0 || !Array.isArray(formData.teaching_class_ids)) {
      return;
    }
    const validClassIds = new Set(classes.map((cls) => cls.id));
    const filtered = formData.teaching_class_ids.filter((id) => validClassIds.has(id));
    if (filtered.length !== formData.teaching_class_ids.length) {
      setFormData((prev) => ({ ...prev, teaching_class_ids: filtered }));
    }
  }, [classes, formData.teaching_class_ids]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      if (name === 'is_secondary_teacher' && !checked) {
        next.subject_ids = [];
      }
      return next;
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
      setFormData({
        ...formData,
        subject_ids: [...currentSubjects, subjectId]
      });
    }
  };

  const handleTeachingClassToggle = (classId) => {
    const currentClassIds = formData.teaching_class_ids || [];
    if (currentClassIds.includes(classId)) {
      setFormData({
        ...formData,
        teaching_class_ids: currentClassIds.filter((id) => id !== classId)
      });
    } else {
      setFormData({
        ...formData,
        teaching_class_ids: [...currentClassIds, classId]
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.is_secondary_teacher && formData.subject_ids.length < 1) {
      alert("Secondary teachers must be assigned at least one subject");
      return;
    }

    try {
      const assignedClassId = formData.assigned_class_id ? parseInt(formData.assigned_class_id, 10) : null;
      const subjectIds = formData.is_secondary_teacher ? formData.subject_ids : [];
      const teachingClassIds = (formData.teaching_class_ids || []).map((id) => parseInt(id, 10)).filter(Boolean);

      if (editingTeacher) {
        const submitData = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone_number: formData.phone_number,
          hire_date: formData.hire_date,
          qualification: formData.qualification,
          salary: formData.salary === '' ? undefined : formData.salary,
          subject_ids: subjectIds,
          teaching_class_ids: teachingClassIds,
          assigned_class_id: assignedClassId
        };
        if (formData.password) submitData.password = formData.password;

        const updatedTeacher = await apiService.updateTeacher(editingTeacher.id, submitData);
        setSelectedTeacher((prev) => (prev && prev.id === editingTeacher.id ? updatedTeacher : prev));
        alert("Teacher updated successfully.");
        resetForm();
      } else {
        const submitData = {
          ...formData,
          salary: formData.salary === '' ? undefined : formData.salary,
          subject_ids: subjectIds,
          teaching_class_ids: teachingClassIds,
          assigned_class_id: assignedClassId
        };
        const response = await apiService.createTeacher(submitData);
        setShowCredentials(response);
        resetForm();
      }
      fetchData();
    } catch (error) {
      console.error("Error saving teacher:", error);
      alert("Failed to save teacher: " + (error.message || "Unknown error"));
    }
  };

  const handleEditTeacher = (teacher) => {
    setEditingTeacher(teacher);
    const currentSubjects = Array.isArray(teacher.subjects)
      ? teacher.subjects.map((subject) => (typeof subject === 'object' ? subject.id : subject)).filter(Boolean)
      : [];
    const currentTeachingClassIds = Array.isArray(teacher.teaching_classes)
      ? teacher.teaching_classes
          .map((cls) => (typeof cls === 'object' ? cls.id : cls))
          .filter(Boolean)
      : [];
    const currentClassId = teacher.class_taught?.[0]?.id || '';
    setFormData({
      first_name: teacher.user?.first_name || '',
      last_name: teacher.user?.last_name || '',
      email: teacher.user?.email || '',
      phone_number: teacher.user?.phone_number || '',
      gender: teacher.user?.gender || '',
      hire_date: teacher.hire_date ? toInputDate(teacher.hire_date) : new Date().toISOString().split('T')[0],
      qualification: teacher.qualification || '',
      salary: teacher.user?.salary != null ? String(teacher.user.salary) : '',
      password: '',
      is_secondary_teacher: currentSubjects.length > 0,
      subject_ids: currentSubjects,
      teaching_class_ids: currentTeachingClassIds,
      assigned_class_id: currentClassId ? String(currentClassId) : ''
    });
    setShowCredentials(null);
    setShowForm(true);
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
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setEditingTeacher(null);
                setFormData(getInitialFormData());
                setShowForm(true);
              }
            }}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center"
          >
            <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'} mr-2`}></i>
            {showForm ? 'Cancel' : 'Add Teacher'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Teachers</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or staff number..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              </div>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="ml-4 mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Showing {filteredTeachers.length} of {teachers.length} teachers
          </div>
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
            <h3 className="text-xl font-semibold mb-4">{editingTeacher ? "Edit Teacher" : "Add New Teacher"}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleInputChange} placeholder="+263..." className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender {editingTeacher && '(Read-only)'}</label>
                <select 
                  name="gender" 
                  value={formData.gender} 
                  onChange={handleInputChange} 
                  disabled={!!editingTeacher}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${editingTeacher ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select gender...</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                  <option value="P">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date *</label>
                <input type="date" name="hire_date" value={formData.hire_date} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                <input type="text" name="qualification" value={formData.qualification} onChange={handleInputChange} placeholder="e.g., B.Ed., M.Ed., Ph.D." className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
                <input
                  type="number"
                  name="salary"
                  value={formData.salary}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  placeholder="e.g., 850.00"
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
                  required={!editingTeacher}
                  minLength="6"
                  placeholder={editingTeacher ? "Leave blank to keep current password" : "Minimum 6 characters"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="col-span-full">
                <label className="flex items-center">
                  <input type="checkbox" name="is_secondary_teacher" checked={formData.is_secondary_teacher} onChange={handleInputChange} className="mr-2" />
                  <span className="text-sm font-medium text-gray-700">Secondary School Teacher (assign subjects)</span>
                </label>
              </div>
              {formData.is_secondary_teacher && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subjects (Select all that apply) *</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Array.isArray(subjects) && subjects.map((subject) => (
                      <label key={subject.id} className="flex items-center p-2 border rounded hover:bg-gray-50">
                        <input type="checkbox" checked={formData.subject_ids.includes(subject.id)} onChange={() => handleSubjectToggle(subject.id)} className="mr-2" />
                        <span className="text-sm">{subject.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">Forms/Grades This Teacher Can Teach</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {Array.isArray(classes) && classes.length > 0 ? classes.map((cls) => (
                    <label key={cls.id} className="flex items-center p-2 border rounded hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.teaching_class_ids.includes(cls.id)}
                        onChange={() => handleTeachingClassToggle(cls.id)}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        {cls.name} ({cls.grade_level <= 7 ? `Grade ${cls.grade_level}` : `Form ${cls.grade_level - 7}`})
                      </span>
                    </label>
                  )) : (
                    <p className="text-sm text-gray-500">No classes available.</p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use this to allow one teacher to teach the selected forms/grades across their assigned subjects.
                </p>
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Responsibility (Class Teacher)</label>
                <select name="assigned_class_id" value={formData.assigned_class_id} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">No class responsibility (optional)...</option>
                  {availableClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name} ({cls.grade_level <= 7 ? `Grade ${cls.grade_level}` : `Form ${cls.grade_level - 7}`})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Only unassigned classes are shown to prevent assigning one class to multiple teachers.
                </p>
                {availableClasses.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    All classes already have class teachers assigned.
                  </p>
                )}
              </div>
              <div className="col-span-full">
                <button type="submit" className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600">
                  {editingTeacher ? "Save Changes" : "Add Teacher"}
                </button>
                {editingTeacher && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="ml-3 px-6 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {selectedTeacher ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button onClick={() => setSelectedTeacher(null)} className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium">
              <i className="fas fa-arrow-left mr-2"></i>Back to List
            </button>
            <button
              onClick={() => handleEditTeacher(selectedTeacher)}
              className="mb-4 ml-4 px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              <i className="fas fa-edit mr-2"></i>Edit Teacher
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">{getTeacherName(selectedTeacher)}</h3>
                <div className="space-y-3">
                  <p><i className="fas fa-id-badge text-blue-500 mr-2 w-5"></i><strong>Staff Number:</strong> {selectedTeacher.user?.student_number || '-'}</p>
                  <p><i className="fas fa-envelope text-blue-500 mr-2 w-5"></i><strong>Email:</strong> {selectedTeacher.user?.email}</p>
                  <p><i className="fas fa-phone text-blue-500 mr-2 w-5"></i><strong>Phone:</strong> {selectedTeacher.user?.phone_number || '-'}</p>
                  <p><i className="fas fa-venus-mars text-blue-500 mr-2 w-5"></i><strong>Gender:</strong> {
                    selectedTeacher.user?.gender ? {
                      'M': 'Male',
                      'F': 'Female',
                      'O': 'Other',
                      'P': 'Prefer not to say'
                    }[selectedTeacher.user.gender] : '-'
                  }</p>
                  <p><i className="fas fa-money-bill-wave text-blue-500 mr-2 w-5"></i><strong>Salary:</strong> {selectedTeacher.user?.salary != null ? Number(selectedTeacher.user.salary).toFixed(2) : '-'}</p>
                  <p><i className="fas fa-graduation-cap text-blue-500 mr-2 w-5"></i><strong>Qualification:</strong> {selectedTeacher.qualification || '-'}</p>
                  <p><i className="fas fa-calendar text-blue-500 mr-2 w-5"></i><strong>Hire Date:</strong> {formatDate(selectedTeacher.hire_date)}</p>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Teaching Assignments</h4>
                <div className="space-y-2">
                  {selectedTeacher.subjects && selectedTeacher.subjects.length > 0 ? (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-2">Subjects:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTeacher.subjects.map((subject, idx) => (
                          <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{subject.name || subject}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No subjects assigned</p>
                  )}
                  {selectedTeacher.class_taught && selectedTeacher.class_taught.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Class Responsibility:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTeacher.class_taught.map((cls, idx) => (
                          <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">{cls.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedTeacher.teaching_classes && selectedTeacher.teaching_classes.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Teaching Forms/Grades:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTeacher.teaching_classes.map((cls, idx) => (
                          <span key={idx} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">{cls.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {filteredTeachers.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subjects</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedTeachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getTeacherName(teacher)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.user?.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.user?.phone_number || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                              {teacher.subjects && teacher.subjects.length > 0 ? (
                                teacher.subjects.map((subject, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{subject.name || subject}</span>
                                ))
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                              {teacher.class_taught && teacher.class_taught.length > 0 ? (
                                teacher.class_taught.map((cls, idx) => (
                                  <span key={`ct-${idx}`} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">{cls.name}</span>
                                ))
                              ) : (
                                <span className="text-gray-400">No class responsibility</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {teacher.teaching_classes && teacher.teaching_classes.length > 0 ? (
                                teacher.teaching_classes.map((cls, idx) => (
                                  <span key={`tc-${idx}`} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs">{cls.name}</span>
                                ))
                              ) : (
                                <span className="text-gray-400">No teaching forms set</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button onClick={() => setSelectedTeacher(teacher)} className="text-blue-600 hover:text-blue-800">
                              <i className="fas fa-eye mr-1"></i>View
                            </button>
                            <button onClick={() => handleEditTeacher(teacher)} className="ml-3 text-green-600 hover:text-green-800">
                              <i className="fas fa-edit mr-1"></i>Edit
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
                  totalItems={filteredTeachers.length}
                  pageSize={PAGE_SIZE}
                  onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                />
              </>
            ) : (
              <div className="text-center py-12">
                <i className="fas fa-chalkboard-teacher text-gray-400 text-6xl mb-4"></i>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  {searchQuery ? 'No teachers found matching your search' : 'No teachers found'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery ? 'Try a different search term' : 'Add teachers to get started'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
