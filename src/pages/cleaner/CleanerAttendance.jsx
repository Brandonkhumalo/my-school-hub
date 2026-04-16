import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function CleanerAttendance() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiService.getStaffAttendance();
        setRecords(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load attendance", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <Header title="My Attendance" />
      <div className="p-6 bg-white rounded-lg shadow">
        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Check In</th>
                  <th className="text-left px-3 py-2">Check Out</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-3 py-2">{record.date}</td>
                    <td className="px-3 py-2">{record.check_in_time || "-"}</td>
                    <td className="px-3 py-2">{record.check_out_time || "-"}</td>
                    <td className="px-3 py-2 capitalize">{record.status || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length === 0 && <p className="text-center py-6 text-gray-500">No attendance records found.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
