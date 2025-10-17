import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCredentials, setShowCredentials] = useState(null);
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

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Format data for backend nested serializer
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

      // ✅ Read from nested user object
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
        {/* Header + Button */}
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

        {/* Success popup */}
        {showCredentials && (
          <div className="bg-green-50 border border-green-400 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-3">
                  Student Created Successfully!
                </h3>
                <div className="space-y-2">
                  <p className="text-gray-700">
                    <strong>Name:</strong> {showCredentials.full_name}
                  </p>
                  <p className="text-gray-700">
                    <strong>Student Number:</strong>{" "}
                    <span className="font-mono bg-green-100 px-2 py-1 rounded">
                      {showCredentials.student_number}
                    </span>
                  </p>
                  <p className="text-gray-700">
                    <strong>Password:</strong>{" "}
                    <span className="font-mono bg-green-100 px-2 py-1 rounded">
                      {showCredentials.password}
                    </span>
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    Use the student number and password to log in.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCredentials(null)}
                className="text-green-600 hover:text-green-800"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
          </div>
        )}

        {/* Add Student Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4">Add New Student</h3>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Class */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class *
                </label>
                <select
                  name="student_class"
                  value={formData.student_class}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a class...</option>
                  {Array.isArray(classes) &&
                    classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Admission Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admission Date *
                </label>
                <input
                  type="date"
                  name="admission_date"
                  value={formData.admission_date}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Contact
                </label>
                <input
                  type="tel"
                  name="student_contact"
                  value={formData.student_contact}
                  onChange={handleInputChange}
                  placeholder="+263..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength="6"
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Address */}
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student Address
                </label>
                <textarea
                  name="student_address"
                  value={formData.student_address}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              {/* Submit */}
              <div className="col-span-full">
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
                >
                  Add Student
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Student Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Student #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Admission Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contact
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {student.user?.student_number}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {student.user
                          ? `${student.user.first_name} ${student.user.last_name}`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {student.class_name || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {student.admission_date}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {student.parent_contact || "-"}
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
                No students found
              </h3>
              <p className="text-gray-500 mb-4">Add students to get started</p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
              >
                <i className="fas fa-plus mr-2"></i>
                Add Student
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
