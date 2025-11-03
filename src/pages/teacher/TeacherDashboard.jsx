import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";

export default function TeacherDashboard() {
  const { user } = useAuth();

  const features = [
    {
      title: "Add Student Marks",
      description: "Enter and manage student marks for your subjects",
      icon: "fa-edit",
      color: "blue",
      link: "/teacher/marks"
    },
    {
      title: "Attendance Register",
      description: "Mark daily attendance for your students",
      icon: "fa-clipboard-list",
      color: "green",
      link: "/teacher/attendance"
    },
    {
      title: "Subject Performance",
      description: "View analytics and performance statistics",
      icon: "fa-chart-line",
      color: "purple",
      link: "/teacher/performance"
    }
  ];

  return (
    <div>
      <Header title="Teacher Dashboard" user={user} />
      
      <div className="p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800">
            Welcome, {user?.first_name}!
          </h2>
          <p className="text-gray-600 mt-2">Manage your classes, students, and academic records</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {features.map((feature, index) => (
            <Link
              key={index}
              to={feature.link}
              className="block bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition transform hover:-translate-y-1"
            >
              <div className="flex items-start">
                <div className={`w-12 h-12 bg-${feature.color}-100 rounded-lg flex items-center justify-center mr-4`}>
                  <i className={`fas ${feature.icon} text-2xl text-${feature.color}-600`}></i>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center text-blue-600 font-medium">
                <span>Get Started</span>
                <i className="fas fa-arrow-right ml-2"></i>
              </div>
            </Link>
          ))}
        </div>

        {/* Information Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">
              <i className="fas fa-lightbulb mr-2"></i>
              Quick Tips
            </h3>
            <ul className="space-y-2 text-sm text-blue-700">
              <li className="flex items-start">
                <i className="fas fa-check-circle mr-2 mt-1"></i>
                <span>Mark attendance daily to track student participation</span>
              </li>
              <li className="flex items-start">
                <i className="fas fa-check-circle mr-2 mt-1"></i>
                <span>Add marks regularly to monitor student progress</span>
              </li>
              <li className="flex items-start">
                <i className="fas fa-check-circle mr-2 mt-1"></i>
                <span>Review subject performance analytics to identify areas for improvement</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-3">
              <i className="fas fa-info-circle mr-2"></i>
              Your Responsibilities
            </h3>
            <ul className="space-y-2 text-sm text-green-700">
              <li className="flex items-start">
                <i className="fas fa-graduation-cap mr-2 mt-1"></i>
                <span>Teach assigned subjects and maintain class records</span>
              </li>
              <li className="flex items-start">
                <i className="fas fa-chart-bar mr-2 mt-1"></i>
                <span>Evaluate student performance through exams and assignments</span>
              </li>
              <li className="flex items-start">
                <i className="fas fa-users mr-2 mt-1"></i>
                <span>Track attendance and maintain accurate student records</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
