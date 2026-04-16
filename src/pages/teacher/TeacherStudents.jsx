import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import PaginationControls from "../../components/PaginationControls";

export default function TeacherStudents() {
  const PAGE_SIZE = 20;
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.fetchTeacherStudents();
        setStudents(data);
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const paginatedStudents = students.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="My Students" />
      <div className="bg-white rounded-lg shadow-sm p-6">
        {students.length > 0 ? (
          <>
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Class</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student, idx) => (
                  <tr key={idx}>
                    <td>{student.id}</td>
                    <td>{student.full_name}</td>
                    <td>{student.class_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={students.length}
              pageSize={PAGE_SIZE}
              onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            />
          </>
        ) : (
          <p>No students available.</p>
        )}
      </div>
    </div>
  );
}
