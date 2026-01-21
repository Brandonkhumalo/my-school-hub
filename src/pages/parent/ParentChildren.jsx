import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function ParentChildren() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [requesting, setRequesting] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  
  const [searchStep, setSearchStep] = useState("school");
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolResults, setSchoolResults] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [searchingSchools, setSearchingSchools] = useState(false);
  
  const [searchMode, setSearchMode] = useState("name");
  const [studentNumber, setStudentNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    try {
      setLoading(true);
      const childrenData = await apiService.getParentChildren();
      setChildren(childrenData);
    } catch (error) {
      console.error("Error loading children:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolSearch = async (e) => {
    e.preventDefault();
    setSearchError("");
    setSchoolResults([]);
    
    if (schoolQuery.trim().length < 2) {
      setSearchError("Please enter at least 2 characters to search for a school");
      return;
    }
    
    try {
      setSearchingSchools(true);
      const results = await apiService.searchSchools(schoolQuery.trim());
      setSchoolResults(results.schools || []);
      
      if ((results.schools || []).length === 0) {
        setSearchError("No schools found. Please check the name and try again.");
      }
    } catch (error) {
      console.error("Error searching schools:", error);
      setSearchError(error.message || "Failed to search schools. Please try again.");
    } finally {
      setSearchingSchools(false);
    }
  };

  const handleSelectSchool = (school) => {
    setSelectedSchool(school);
    setSearchStep("student");
    setSchoolResults([]);
    setSchoolQuery("");
    setSearchError("");
  };

  const handleBackToSchoolSearch = () => {
    setSearchStep("school");
    setSelectedSchool(null);
    setSearchResults([]);
    setHasSearched(false);
    setSearchError("");
    setStudentNumber("");
    setFirstName("");
    setLastName("");
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError("");
    setSearchResults([]);
    
    if (!selectedSchool) {
      setSearchError("Please select a school first");
      return;
    }
    
    if (searchMode === "student_number") {
      if (studentNumber.trim().length < 3) {
        setSearchError("Student number must be at least 3 characters");
        return;
      }
    } else {
      if (firstName.trim().length < 2 || lastName.trim().length < 2) {
        setSearchError("Both first name and last name are required (at least 2 characters each)");
        return;
      }
    }
    
    try {
      setSearching(true);
      setHasSearched(true);
      
      const params = searchMode === "student_number" 
        ? { student_number: studentNumber.trim(), school_id: selectedSchool.id }
        : { first_name: firstName.trim(), last_name: lastName.trim(), school_id: selectedSchool.id };
      
      const results = await apiService.searchStudents(params);
      setSearchResults(results);
      
      if (results.length === 0) {
        setSearchError("No students found. Please check the information and try again.");
      }
    } catch (error) {
      console.error("Error searching students:", error);
      setSearchError(error.message || "Failed to search. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleRequestLink = async (studentId) => {
    try {
      setRequesting(studentId);
      await apiService.requestChildLink(studentId);
      await loadChildren();
      setSearchResults(prev => prev.map(s => 
        s.id === studentId ? { ...s, is_linked: true } : s
      ));
      alert("Link request submitted successfully! An administrator will review and approve your request.");
    } catch (error) {
      console.error("Error requesting link:", error);
      alert("Failed to request link. It may already exist or is pending approval.");
    } finally {
      setRequesting(null);
    }
  };

  const clearSearch = () => {
    setSearchResults([]);
    setHasSearched(false);
    setSearchError("");
    setStudentNumber("");
    setFirstName("");
    setLastName("");
    setSearchStep("school");
    setSelectedSchool(null);
    setSchoolQuery("");
    setSchoolResults([]);
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
  const pendingChildren = children.filter(c => !c.is_confirmed);

  return (
    <div>
      <Header title="My Children" user={user} />
      
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Manage Your Children</h2>
          <p className="text-gray-600 mt-2">Link your children and view confirmed connections</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              <i className="fas fa-check-circle text-green-500 mr-2"></i>
              Confirmed Children
            </h3>
            
            {confirmedChildren.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-child text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No confirmed children yet</p>
                <p className="text-gray-400 text-sm mt-2">Search below to link your child</p>
              </div>
            ) : (
              <div className="space-y-4">
                {confirmedChildren.map((child) => (
                  <div key={child.id} className="p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center mr-4">
                          <i className="fas fa-user text-xl"></i>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">{child.name} {child.surname}</h4>
                          <p className="text-sm text-gray-600">Class: {child.class}</p>
                          <p className="text-sm text-gray-600">Student #: {child.student_number}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full">Confirmed</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              <i className="fas fa-clock text-yellow-500 mr-2"></i>
              Pending Admin Approval
            </h3>
            
            {pendingChildren.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-hourglass-half text-6xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingChildren.map((child) => (
                  <div key={child.id} className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-yellow-500 text-white rounded-full flex items-center justify-center mr-4">
                          <i className="fas fa-user text-xl"></i>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">{child.name} {child.surname}</h4>
                          <p className="text-sm text-gray-600">Class: {child.class}</p>
                          <p className="text-sm text-gray-600">Student #: {child.student_number}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-yellow-600 text-white text-xs rounded-full">Pending</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            <i className="fas fa-search text-blue-500 mr-2"></i>
            Link a New Child
          </h3>
          
          <div className="mb-6 flex items-center justify-center">
            <div className={`flex items-center ${searchStep === 'school' ? 'text-blue-600' : 'text-green-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${searchStep === 'school' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                {searchStep === 'school' ? '1' : <i className="fas fa-check"></i>}
              </div>
              <span className="ml-2 font-medium">Select School</span>
            </div>
            <div className="w-16 h-1 mx-4 bg-gray-300">
              <div className={`h-full ${searchStep === 'student' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            </div>
            <div className={`flex items-center ${searchStep === 'student' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${searchStep === 'student' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                2
              </div>
              <span className="ml-2 font-medium">Find Child</span>
            </div>
          </div>

          {searchStep === 'school' && (
            <div>
              <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                <p className="text-blue-700 text-sm">
                  <i className="fas fa-info-circle mr-2"></i>
                  First, search for the school your child attends by name or school code.
                </p>
              </div>
              
              <form onSubmit={handleSchoolSearch} className="mb-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">School Name or Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter school name or code..."
                      value={schoolQuery}
                      onChange={(e) => setSchoolQuery(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={searchingSchools}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition"
                    >
                      {searchingSchools ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                    </button>
                  </div>
                </div>
              </form>

              {searchError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  <i className="fas fa-exclamation-circle mr-2"></i>{searchError}
                </div>
              )}

              {schoolResults.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Select your child's school:</p>
                  {schoolResults.map((school) => (
                    <button
                      key={school.id}
                      onClick={() => handleSelectSchool(school)}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-800">{school.name}</h4>
                          <p className="text-sm text-gray-500">Code: {school.code} | {school.city || 'Location not specified'}</p>
                          <p className="text-xs text-gray-400 mt-1">{school.school_type} | {school.curriculum}</p>
                        </div>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {searchStep === 'student' && selectedSchool && (
            <div>
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Selected School:</p>
                    <p className="font-semibold text-green-800">{selectedSchool.name}</p>
                    <p className="text-xs text-green-600">Code: {selectedSchool.code}</p>
                  </div>
                  <button onClick={handleBackToSchoolSearch} className="text-green-600 hover:text-green-800 text-sm">
                    <i className="fas fa-edit mr-1"></i>Change School
                  </button>
                </div>
              </div>

              <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                <p className="text-blue-700 text-sm">
                  <i className="fas fa-info-circle mr-2"></i>
                  Now search for your child by their <strong>student number</strong> or <strong>full name</strong>.
                </p>
              </div>

              <div className="flex gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => { setSearchMode("name"); setSearchResults([]); setHasSearched(false); }}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition ${
                    searchMode === "name" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <i className="fas fa-user mr-2"></i>Search by Name
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchMode("student_number"); setSearchResults([]); setHasSearched(false); }}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition ${
                    searchMode === "student_number" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <i className="fas fa-id-card mr-2"></i>Search by Student Number
                </button>
              </div>

              <form onSubmit={handleSearch} className="mb-6">
                {searchMode === "student_number" ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Student Number</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter student number (e.g., STU2025001)"
                      value={studentNumber}
                      onChange={(e) => setStudentNumber(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter child's first name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name (Surname) <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter child's surname"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {searchError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    <i className="fas fa-exclamation-circle mr-2"></i>{searchError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={searching}
                    className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:bg-gray-400 font-medium"
                  >
                    {searching ? (
                      <span><i className="fas fa-spinner fa-spin mr-2"></i>Searching...</span>
                    ) : (
                      <span><i className="fas fa-search mr-2"></i>Search for Child</span>
                    )}
                  </button>
                  {hasSearched && (
                    <button type="button" onClick={clearSearch} className="py-3 px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition">
                      Clear
                    </button>
                  )}
                </div>
              </form>

              {hasSearched && (
                <div className="border-t pt-6">
                  <h4 className="font-medium text-gray-800 mb-4">Search Results ({searchResults.length} found)</h4>
                  
                  {searchResults.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <i className="fas fa-search text-5xl text-gray-300 mb-4"></i>
                      <p className="text-gray-500">No matching students found</p>
                      <p className="text-gray-400 text-sm mt-2">Please check the information and try again</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {searchResults.map((student) => (
                        <div key={student.id} className={`p-4 rounded-lg border-2 ${student.is_linked ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${student.is_linked ? 'bg-gray-400' : 'bg-blue-500'} text-white`}>
                                <i className="fas fa-user text-lg"></i>
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-800">{student.name} {student.surname}</h4>
                                <p className="text-sm text-gray-600">Class: {student.class}</p>
                                <p className="text-sm text-gray-500">Student #: {student.student_number}</p>
                              </div>
                            </div>
                            {student.is_linked ? (
                              <span className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm">
                                <i className="fas fa-link mr-2"></i>Already Linked
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRequestLink(student.id)}
                                disabled={requesting === student.id}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:bg-gray-400 text-sm font-medium"
                              >
                                {requesting === student.id ? (
                                  <span><i className="fas fa-spinner fa-spin mr-2"></i>Linking...</span>
                                ) : (
                                  <span><i className="fas fa-plus mr-2"></i>Link Child</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 bg-green-50 border-l-4 border-green-400 p-4 rounded">
          <div className="flex">
            <i className="fas fa-shield-alt text-green-600 text-xl mr-3"></i>
            <div>
              <h4 className="font-semibold text-green-800 mb-1">How it works</h4>
              <p className="text-green-700 text-sm">
                1. Search for your child's school by name or code<br />
                2. Search for your child by their student number or full name<br />
                3. Click "Link Child" to submit a link request<br />
                4. An administrator will verify and approve your request<br />
                5. Once approved, you can access your child's academic information
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
