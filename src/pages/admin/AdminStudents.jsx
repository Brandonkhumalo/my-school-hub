import React, { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCredentials, setShowCredentials] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    student_class: "",
    admission_date: new Date().toISOString().split("T")[0],
    student_contact: "",
    student_address: "",
    password: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [studentsData, classesData] = await Promise.all([
        apiService.fetchStudents(),
        apiService.fetchClasses(),
      ]);
      setStudents(studentsData);
      setClasses(classesData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(student => {
      const firstName = student.user?.first_name?.toLowerCase() || '';
      const lastName = student.user?.last_name?.toLowerCase() || '';
      const fullName = `${firstName} ${lastName}`;
      const studentNumber = student.user?.student_number?.toLowerCase() || '';
      const className = student.class_name?.toLowerCase() || '';
      return fullName.includes(query) || studentNumber.includes(query) || className.includes(query);
    });
  }, [students, searchQuery]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formattedData = {
      user: {
        first_name: formData.first_name,
        last_name: formData.last_name,
        password: formData.password,
      },
      student_class: formData.student_class,
      admission_date: formData.admission_date,
      student_contact: formData.student_contact,
      student_address: formData.student_address,
    };

    try {
      const response = await apiService.createStudent(formattedData);
      setShowCredentials({
        full_name: `${response.user.first_name} ${response.user.last_name}`,
        student_number: response.user.student_number,
        password: formData.password,
      });
      setShowForm(false);
      setFormData({
        first_name: "",
        last_name: "",
        student_class: "",
        admission_date: new Date().toISOString().split("T")[0],
        student_contact: "",
        student_address: "",
        password: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error creating student:", error);
      alert("Failed to create student: " + (error.message || "Unknown error"));
    }
  };

  if (isLoading)
    return (
      <div>
        <Header title="Students" />
        <LoadingSpinner />
      </div>
    );

  return (
    <div>
      <Header title="Students" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            All Students ({students.length})
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center"
          >
            <i className={`fas ${showForm ? "fa-times" : "fa-plus"} mr-2`}></i>
            {showForm ? "Cancel" : "Add Student"}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Students</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, student number, or class..."
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
            Showing {filteredStudents.length} of {students.length} students
          </div>
        </div>

        {showCredentials && (
          <div className="bg-green-50 border border-green-400 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-3">Student Created Successfully!</h3>
                <div className="space-y-2">
                  <p className="text-gray-700"><strong>Name:</strong> {showCredentials.full_name}</p>
                  <p className="text-gray-700"><strong>Student Number:</strong> <span className="font-mono bg-green-100 px-2 py-1 rounded">{showCredentials.student_number}</span></p>
                  <p className="text-gray-700"><strong>Password:</strong> <span className="font-mono bg-green-100 px-2 py-1 rounded">{showCredentials.password}</span></p>
                  <p className="text-sm text-green-700 mt-2">Use the student number and password to log in.</p>
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
            <h3 className="text-xl font-semibold mb-4">Add New Student</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                <select name="student_class" value={formData.student_class} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select a class...</option>
                  {Array.isArray(classes) && classes.map((cls) => (<option key={cls.id} value={cls.id}>{cls.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date *</label>
                <input type="date" name="admission_date" value={formData.admission_date} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Contact</label>
                <input type="tel" name="student_contact" value={formData.student_contact} onChange={handleInputChange} placeholder="+263..." className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} required minLength="6" placeholder="Minimum 6 characters" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Address</label>
                <textarea name="student_address" value={formData.student_address} onChange={handleInputChange} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
              </div>
              <div className="col-span-full">
                <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">Add Student</button>
              </div>
            </form>
          </div>
        )}

        {selectedStudent ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button onClick={() => setSelectedStudent(null)} className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium">
              <i className="fas fa-arrow-left mr-2"></i>Back to List
            </button>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-user-graduate text-blue-500 mr-2"></i>
                  Personal Information
                </h3>
                <div className="space-y-3">
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Full Name:</span>
                    <span className="text-gray-800">{selectedStudent.user?.first_name} {selectedStudent.user?.last_name}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Student Number:</span>
                    <span className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{selectedStudent.user?.student_number}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Email:</span>
                    <span className="text-gray-800">{selectedStudent.user?.email || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Phone:</span>
                    <span className="text-gray-800">{selectedStudent.user?.phone_number || selectedStudent.student_contact || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Address:</span>
                    <span className="text-gray-800">{selectedStudent.student_address || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-school text-green-500 mr-2"></i>
                  Academic Information
                </h3>
                <div className="space-y-3">
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Class:</span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">{selectedStudent.class_name || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Admission Date:</span>
                    <span className="text-gray-800">{selectedStudent.admission_date}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm ${selectedStudent.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {selectedStudent.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-users text-purple-500 mr-2"></i>
                  Parent/Guardian Information
                </h3>
                <div className="space-y-3">
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Parent Contact:</span>
                    <span className="text-gray-800">{selectedStudent.parent_contact || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Parent Email:</span>
                    <span className="text-gray-800">{selectedStudent.parent_email || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-info-circle text-orange-500 mr-2"></i>
                  Additional Information
                </h3>
                <div className="space-y-3">
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Date of Birth:</span>
                    <span className="text-gray-800">{selectedStudent.date_of_birth || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Gender:</span>
                    <span className="text-gray-800">{selectedStudent.gender || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-40 text-gray-600 font-medium">Emergency Contact:</span>
                    <span className="text-gray-800">{selectedStudent.emergency_contact || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {filteredStudents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admission Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{student.user?.student_number}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {student.user ? `${student.user.first_name} ${student.user.last_name}` : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{student.class_name || "-"}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{student.admission_date}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{student.student_contact || student.parent_contact || "-"}</td>
                        <td className="px-6 py-4 text-sm">
                          <button onClick={() => setSelectedStudent(student)} className="text-blue-600 hover:text-blue-800">
                            <i className="fas fa-eye mr-1"></i>View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <i className="fas fa-user-graduate text-gray-400 text-6xl mb-4"></i>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  {searchQuery ? 'No students found matching your search' : 'No students found'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery ? 'Try a different search term' : 'Add students to get started'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
