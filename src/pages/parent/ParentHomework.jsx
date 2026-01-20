import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function ParentHomework() {
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
      const data = await apiService.getParentHomework();
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
      const response = await fetch(apiService.downloadParentHomework(homeworkId), {
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
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Children's Homework</h2>

        {homework.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <i className="fas fa-book-open text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Homework Available</h3>
            <p className="text-gray-500">
              There is currently no homework assigned to your children's classes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {homework.map(hw => {
              const dueStatus = getDueStatus(hw.due_date);
              
              return (
                <div key={hw.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="bg-blue-600 px-4 py-3 flex justify-between items-center">
                    <h4 className="text-lg font-semibold text-white">{hw.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${dueStatus.class}`}>
                      {dueStatus.label}
                    </span>
                  </div>
                  
                  <div className="p-4">
                    <h5 className="font-semibold text-gray-800 mb-3">{hw.homework_title}</h5>
                    
                    <div className="text-sm text-gray-600 mb-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-book text-blue-500 w-5"></i>
                        <span>Subject: <strong>{hw.subject.name}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="fas fa-users text-blue-500 w-5"></i>
                        <span>Class: <strong>{hw.assigned_class.name}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="fas fa-chalkboard-teacher text-blue-500 w-5"></i>
                        <span>Teacher: <strong>{hw.teacher.name}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="fas fa-calendar-alt text-blue-500 w-5"></i>
                        <span>Due: <strong>{new Date(hw.due_date).toLocaleDateString('en-GB', { 
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}</strong></span>
                      </div>
                    </div>

                    {hw.children && hw.children.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          <i className="fas fa-child mr-2"></i>
                          For: {hw.children.map(c => c.name).join(', ')}
                        </p>
                      </div>
                    )}
                    
                    {hw.description ? (
                      <div className="mb-4">
                        <button
                          onClick={() => setSelectedHomework(selectedHomework === hw.id ? null : hw.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                        >
                          <i className={`fas fa-chevron-${selectedHomework === hw.id ? 'up' : 'down'}`}></i>
                          {selectedHomework === hw.id ? 'Hide Details' : 'View Details'}
                        </button>
                        
                        {selectedHomework === hw.id && (
                          <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                            {hw.description}
                          </div>
                        )}
                      </div>
                    ) : null}
                    
                    {hw.has_file && (
                      <div className="pt-3 border-t">
                        <button
                          onClick={() => handleDownload(hw.id, hw.file_name)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center justify-center gap-2"
                        >
                          <i className="fas fa-download"></i>
                          Download {hw.file_name.endsWith('.pdf') ? 'PDF' : 'Document'}
                        </button>
                        <p className="text-xs text-gray-500 mt-1 text-center">{hw.file_name}</p>
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
