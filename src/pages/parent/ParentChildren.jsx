import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function ParentChildren() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(null);
  
  // Filter states
  const [nameFilter, setNameFilter] = useState("");
  const [surnameFilter, setSurnameFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Apply filters
    let filtered = [...allStudents];
    
    if (nameFilter) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }
    
    if (surnameFilter) {
      filtered = filtered.filter(s => 
        s.surname.toLowerCase().includes(surnameFilter.toLowerCase())
      );
    }
    
    if (classFilter) {
      filtered = filtered.filter(s => 
        s.class.toLowerCase().includes(classFilter.toLowerCase())
      );
    }
    
    setFilteredStudents(filtered);
  }, [nameFilter, surnameFilter, classFilter, allStudents]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [childrenData, studentsData] = await Promise.all([
        apiService.getParentChildren(),
        apiService.getAllStudents()
      ]);
      setChildren(childrenData);
      setAllStudents(studentsData);
      setFilteredStudents(studentsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestLink = async (studentId) => {
    try {
      setRequesting(studentId);
      await apiService.requestChildLink(studentId);
      await loadData();
      alert("Link request submitted successfully! An administrator will review and approve your request.");
    } catch (error) {
      console.error("Error requesting link:", error);
      alert("Failed to request link. It may already exist or is pending approval.");
    } finally {
      setRequesting(null);
    }
  };


  if (loading) {
    return (
      <div>
        <Header title="My Children" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  const confirmedChildren = children.filter(c => c.is_confirmed);
  const pendingChildren = allStudents.filter(s => s.is_linked && !confirmedChildren.some(c => c.id === s.id));

  return (
    <div>
      <Header title="My Children" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Manage Your Children</h2>
          <p className="text-gray-600 mt-2">Link your children, confirm pending requests, and view confirmed children</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Confirmed Children */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirmed Children</h3>
            
            {confirmedChildren.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-child text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No confirmed children yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {confirmedChildren.map((child) => (
                  <div
                    key={child.id}
                    className="p-4 bg-green-50 border-l-4 border-green-500 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center mr-4">
                          <i className="fas fa-user text-xl"></i>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {child.name} {child.surname}
                          </h4>
                          <p className="text-sm text-gray-600">Class: {child.class}</p>
                          <p className="text-sm text-gray-600">Student #: {child.student_number}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full">
                        Confirmed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Admin Approval */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Pending Admin Approval</h3>
            
            {pendingChildren.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-clock text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingChildren.map((child) => (
                  <div
                    key={child.id}
                    className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-yellow-500 text-white rounded-full flex items-center justify-center mr-4">
                          <i className="fas fa-user text-xl"></i>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {child.name} {child.surname}
                          </h4>
                          <p className="text-sm text-gray-600">Class: {child.class}</p>
                          <p className="text-sm text-gray-600">Student #: {child.student_number}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-yellow-600 text-white text-xs rounded-full">
                        Awaiting Approval
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Link New Child Section */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Link a New Child</h3>
          
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Name
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter first name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Surname
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter surname..."
                value={surnameFilter}
                onChange={(e) => setSurnameFilter(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Class
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter class..."
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Students List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-search text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No students found</p>
              </div>
            ) : (
              filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className={`p-4 rounded-lg border ${
                    student.is_linked
                      ? 'bg-gray-100 border-gray-300'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${
                        student.is_linked ? 'bg-gray-400' : 'bg-blue-500'
                      } text-white`}>
                        <i className="fas fa-user"></i>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          {student.name} {student.surname}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Class: {student.class} | Student #: {student.student_number}
                        </p>
                      </div>
                    </div>
                    {student.is_linked ? (
                      <span className="px-3 py-1 bg-gray-500 text-white text-xs rounded-full">
                        Already Linked
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRequestLink(student.id)}
                        disabled={requesting === student.id}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:bg-gray-400"
                      >
                        {requesting === student.id ? (
                          <span>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Requesting...
                          </span>
                        ) : (
                          <span>
                            <i className="fas fa-link mr-2"></i>
                            Link Child
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <div className="flex">
            <i className="fas fa-info-circle text-blue-600 text-xl mr-3"></i>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">How it works</h4>
              <p className="text-blue-700 text-sm">
                1. Browse all students and use filters to find your child<br />
                2. Click "Link Child" to submit a link request<br />
                3. Your request will appear in "Pending Admin Approval"<br />
                4. An administrator will review and approve your request<br />
                5. Once approved, you can access your child's academic information
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
