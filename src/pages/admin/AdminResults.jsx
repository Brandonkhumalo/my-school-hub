import React, { useState, useEffect, useMemo } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminResults() {
  const [averages, setAverages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);

  useEffect(() => {
    const fetchAverages = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchClassAverages();
        setAverages(data);
      } catch (error) {
        console.error("Error fetching class averages:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAverages();
  }, []);

  const classSummaries = useMemo(() => {
    const classMap = {};
    
    averages.forEach(avg => {
      const className = avg.class_name || 'Unassigned';
      if (!classMap[className]) {
        classMap[className] = {
          name: className,
          subjects: [],
          totalPercentage: 0,
          subjectCount: 0,
          studentCount: 0
        };
      }
      classMap[className].subjects.push(avg);
      classMap[className].totalPercentage += avg.percentage;
      classMap[className].subjectCount += 1;
      classMap[className].studentCount = Math.max(classMap[className].studentCount, avg.student_count);
    });

    Object.values(classMap).forEach(cls => {
      cls.overallAverage = cls.subjectCount > 0 
        ? (cls.totalPercentage / cls.subjectCount).toFixed(1) 
        : 0;
    });

    return Object.values(classMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [averages]);

  const getGradeFromPercentage = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const getGradeColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) return (
    <div>
      <Header title="Class Results & Performance" />
      <LoadingSpinner />
    </div>
  );

  return (
    <div>
      <Header title="Class Results & Performance" />
      <div className="p-6">
        {selectedClass ? (
          <div>
            <button
              onClick={() => setSelectedClass(null)}
              className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to All Classes
            </button>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedClass.name}</h2>
                  <p className="text-gray-600 mt-1">Subject-by-Subject Performance Breakdown</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{selectedClass.overallAverage}%</div>
                  <div className="text-sm text-gray-600">Class Average</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Exam Type</th>
                    <th className="p-3">Avg Score</th>
                    <th className="p-3">Percentage</th>
                    <th className="p-3">Grade</th>
                    <th className="p-3">Students</th>
                    <th className="p-3">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClass.subjects.map((subject, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-800">{subject.subject_name}</td>
                      <td className="p-3 text-gray-600">{subject.exam_type}</td>
                      <td className="p-3">{subject.average_score.toFixed(1)}/{subject.average_max_score.toFixed(1)}</td>
                      <td className="p-3 font-semibold">{subject.percentage}%</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-white ${getGradeColor(subject.percentage)}`}>
                          {subject.grade}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{subject.student_count}</td>
                      <td className="p-3">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className={`h-2.5 rounded-full ${getGradeColor(subject.percentage)}`}
                            style={{ width: `${Math.min(subject.percentage, 100)}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Class Performance Overview</h2>
              <p className="text-gray-600 mt-1">Click on a class to view detailed subject performance</p>
            </div>

            {classSummaries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classSummaries.map((cls, idx) => (
                  <div 
                    key={idx} 
                    className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition cursor-pointer border-l-4 border-blue-500"
                    onClick={() => setSelectedClass(cls)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{cls.name}</h3>
                        <p className="text-sm text-gray-600">{cls.studentCount} students</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${getGradeColor(parseFloat(cls.overallAverage))}`}>
                        {getGradeFromPercentage(parseFloat(cls.overallAverage))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Class Average</span>
                        <span className="font-semibold">{cls.overallAverage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${getGradeColor(parseFloat(cls.overallAverage))}`}
                          style={{ width: `${Math.min(parseFloat(cls.overallAverage), 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        <i className="fas fa-book mr-1"></i>
                        {cls.subjectCount} subjects
                      </span>
                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                        View Details <i className="fas fa-arrow-right ml-1"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="text-center py-12 text-gray-500">
                  <i className="fas fa-chart-bar text-6xl mb-4"></i>
                  <p>No class averages available yet.</p>
                  <p className="text-sm mt-2">Results will appear here once teachers add student marks.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
