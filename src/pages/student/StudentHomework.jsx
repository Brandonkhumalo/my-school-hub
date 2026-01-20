import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function StudentHomework() {
  const { user } = useAuth();
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHomework, setSelectedHomework] = useState(null);

  useEffect(() => {
    loadHomework();
  }, []);

  const loadHomework = async () => {
    try {
      setLoading(true);
      const data = await apiService.getStudentHomework();
      setHomework(data);
    } catch (error) {
      console.error("Error loading homework:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (homeworkId, fileName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiService.downloadStudentHomework(homeworkId), {
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

  const getDueStatus = (dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { label: "Past Due", class: "bg-red-100 text-red-800" };
    } else if (diffDays === 0) {
      return { label: "Due Today", class: "bg-yellow-100 text-yellow-800" };
    } else if (diffDays <= 2) {
      return { label: `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`, class: "bg-orange-100 text-orange-800" };
    } else {
      return { label: `Due in ${diffDays} days`, class: "bg-green-100 text-green-800" };
    }
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
        <h2 className="text-2xl font-bold text-gray-800 mb-6">My Homework</h2>

        {homework.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <i className="fas fa-book-open text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Homework Available</h3>
            <p className="text-gray-500">
              There is currently no homework assigned to your class.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {homework.map(hw => {
              const dueStatus = getDueStatus(hw.due_date);
              
              return (
                <div key={hw.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="bg-blue-900 text-white p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-semibold">{hw.title}</h4>
                        {hw.homework_title && (
                          <p className="text-blue-200 text-sm mt-1">{hw.homework_title}</p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${dueStatus.class}`}>
                        {dueStatus.label}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center text-gray-600 mb-3">
                      <i className="fas fa-calendar-alt mr-2"></i>
                      <span>Due: {new Date(hw.due_date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</span>
                    </div>
                    
                    <div className="flex items-center text-gray-600 mb-3">
                      <i className="fas fa-chalkboard-teacher mr-2"></i>
                      <span>Teacher: {hw.teacher_name}</span>
                    </div>
                    
                    <div className="flex items-center text-gray-600 mb-4">
                      <i className="fas fa-users mr-2"></i>
                      <span>Class: {hw.class_name}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      {hw.description && (
                        <button
                          onClick={() => setSelectedHomework(selectedHomework?.id === hw.id ? null : hw)}
                          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                          <i className={`fas fa-chevron-${selectedHomework?.id === hw.id ? 'up' : 'down'} mr-2`}></i>
                          {selectedHomework?.id === hw.id ? 'Hide' : 'View'} Details
                        </button>
                      )}
                      
                      {hw.has_file && (
                        <button
                          onClick={() => handleDownload(hw.id, hw.file_name)}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          <i className="fas fa-download mr-2"></i>
                          Download
                        </button>
                      )}
                    </div>
                    
                    {selectedHomework?.id === hw.id && hw.description && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h5 className="font-semibold text-gray-800 mb-2">Instructions</h5>
                        <p className="text-gray-600 whitespace-pre-wrap">{hw.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
