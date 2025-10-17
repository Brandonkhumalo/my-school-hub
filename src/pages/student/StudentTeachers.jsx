import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function StudentTeachers() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      const data = await apiService.getStudentTeachers();
      setTeachers(data);
    } catch (error) {
      console.error("Error loading teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="My Teachers" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="My Teachers" user={user} />
      
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">My Teachers</h2>
          
          {teachers.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-chalkboard-teacher text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No teachers assigned</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-lg shadow-md hover:shadow-lg transition border border-gray-200"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl mb-4">
                      <i className="fas fa-user-tie"></i>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-800 mb-1">
                      {teacher.title} {teacher.surname}
                    </h3>
                    
                    <div className="flex items-center justify-center bg-blue-100 px-3 py-1 rounded-full mb-3">
                      <i className="fas fa-book text-blue-600 text-sm mr-2"></i>
                      <span className="text-blue-700 font-semibold text-sm">{teacher.subject}</span>
                    </div>

                    {teacher.email && (
                      <div className="mt-3 flex items-center text-gray-600 text-sm">
                        <i className="fas fa-envelope mr-2"></i>
                        <span>{teacher.email}</span>
                      </div>
                    )}

                    {teacher.phone && (
                      <div className="mt-2 flex items-center text-gray-600 text-sm">
                        <i className="fas fa-phone mr-2"></i>
                        <span>{teacher.phone}</span>
                      </div>
                    )}

                    {teacher.office && (
                      <div className="mt-2 flex items-center text-gray-600 text-sm">
                        <i className="fas fa-door-open mr-2"></i>
                        <span>{teacher.office}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
