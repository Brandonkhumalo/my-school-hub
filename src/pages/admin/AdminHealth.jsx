import React, { useState, useEffect } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import PaginationControls from "../../components/PaginationControls";
import { formatDateTime } from "../../utils/dateFormat";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function AdminHealth() {
  const PAGE_SIZE = 20;
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [healthRecord, setHealthRecord] = useState(null);
  const [clinicVisits, setClinicVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHealthForm, setShowHealthForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [activeTab, setActiveTab] = useState("record");
  const [currentPage, setCurrentPage] = useState(1);

  const [healthForm, setHealthForm] = useState({
    blood_type: "", allergies: "", chronic_conditions: "",
    medications: "", emergency_contact_name: "", emergency_contact_phone: "",
    emergency_contact_relationship: "", medical_aid_name: "",
    medical_aid_number: "", notes: "",
  });

  const [visitForm, setVisitForm] = useState({
    student: "", complaint: "", diagnosis: "",
    treatment: "", nurse_notes: "", parent_notified: false,
    follow_up_required: false,
  });

  useEffect(() => {
    loadStudents();
    loadClinicVisits();
  }, []);

  const loadStudents = async () => {
    try {
      const data = await apiService.fetchStudents();
      setStudents(Array.isArray(data) ? data : []);
    } catch (error) {
      setStudents([]);
    }
  };

  const loadClinicVisits = async (studentId) => {
    try {
      const params = {};
      if (studentId) params.student_id = studentId;
      const data = await apiService.getClinicVisits(params);
      setClinicVisits(Array.isArray(data) ? data : []);
    } catch (error) {
      setClinicVisits([]);
    }
  };

  const selectStudent = async (student) => {
    setSelectedStudent(student);
    setIsLoading(true);
    setActiveTab("record");
    try {
      const record = await apiService.getStudentHealthRecord(student.id);
      setHealthRecord(record);
      setHealthForm({
        blood_type: record.blood_type || "",
        allergies: record.allergies || "",
        chronic_conditions: record.chronic_conditions || "",
        medications: record.medications || "",
        emergency_contact_name: record.emergency_contact_name || "",
        emergency_contact_phone: record.emergency_contact_phone || "",
        emergency_contact_relationship: record.emergency_contact_relationship || "",
        medical_aid_name: record.medical_aid_name || "",
        medical_aid_number: record.medical_aid_number || "",
        notes: record.notes || "",
      });
    } catch {
      setHealthRecord(null);
      setHealthForm({
        blood_type: "", allergies: "", chronic_conditions: "",
        medications: "", emergency_contact_name: "", emergency_contact_phone: "",
        emergency_contact_relationship: "", medical_aid_name: "",
        medical_aid_number: "", notes: "",
      });
    }
    loadClinicVisits(student.id);
    setIsLoading(false);
  };

  const handleHealthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (healthRecord) {
        await apiService.updateHealthRecord(selectedStudent.id, healthForm);
        setMessage({ text: "Health record updated", type: "success" });
      } else {
        await apiService.createHealthRecord(selectedStudent.id, healthForm);
        setMessage({ text: "Health record created", type: "success" });
      }
      setShowHealthForm(false);
      selectStudent(selectedStudent);
    } catch (error) {
      setMessage({ text: error.message || "Failed to save health record", type: "error" });
    }
  };

  const handleVisitSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiService.createClinicVisit({ ...visitForm, student: selectedStudent.id });
      setMessage({ text: "Clinic visit recorded", type: "success" });
      setShowVisitForm(false);
      setVisitForm({ student: "", complaint: "", diagnosis: "", treatment: "", nurse_notes: "", parent_notified: false, follow_up_required: false });
      loadClinicVisits(selectedStudent.id);
    } catch (error) {
      setMessage({ text: error.message || "Failed to record visit", type: "error" });
    }
  };

  const filteredStudents = students.filter((s) => {
    const name = (s.user?.full_name || s.full_name || `${s.first_name || ""} ${s.last_name || ""}`).toLowerCase();
    const num = (s.user?.student_number || s.student_number || "").toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || num.includes(q);
  });

  const getStudentName = (s) => s?.user?.full_name || s?.full_name || `${s?.first_name || ""} ${s?.last_name || ""}`;
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div>
      <Header title="Student Health Records" />

      {message.text && (
        <div className={`mb-4 p-3 rounded ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.text}
          <button className="float-right font-bold" onClick={() => setMessage({ text: "", type: "" })}>&times;</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-3">Select Student</h2>
          <input
            type="text"
            placeholder="Search by name or student number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mb-3"
          />
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {paginatedStudents.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStudent(s)}
                className={`w-full text-left px-3 py-2 rounded transition text-sm ${
                  selectedStudent?.id === s.id ? "bg-blue-100 text-blue-800 font-medium" : "hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">{getStudentName(s)}</div>
                <div className="text-xs text-gray-500">{s.user?.student_number || s.student_number || ""}</div>
              </button>
            ))}
            {filteredStudents.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No students found</p>}
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredStudents.length}
            pageSize={PAGE_SIZE}
            onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          />
        </div>

        {/* Health Details */}
        <div className="lg:col-span-2">
          {!selectedStudent ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400">
              <i className="fas fa-heartbeat text-5xl mb-4 block"></i>
              <p>Select a student to view their health records</p>
            </div>
          ) : isLoading ? (
            <LoadingSpinner />
          ) : (
            <div>
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold">{getStudentName(selectedStudent)}</h2>
                    <p className="text-sm text-gray-500">{selectedStudent.user?.student_number || selectedStudent.student_number || ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowHealthForm(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                    >
                      <i className="fas fa-edit mr-1"></i>{healthRecord ? "Edit Record" : "Create Record"}
                    </button>
                    <button
                      onClick={() => { setVisitForm({ ...visitForm, student: selectedStudent.id }); setShowVisitForm(true); }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
                    >
                      <i className="fas fa-plus mr-1"></i>New Visit
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("record")}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === "record" ? "bg-white text-blue-700 shadow" : "text-gray-600"}`}
                >
                  <i className="fas fa-file-medical mr-2"></i>Health Record
                </button>
                <button
                  onClick={() => setActiveTab("visits")}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === "visits" ? "bg-white text-blue-700 shadow" : "text-gray-600"}`}
                >
                  <i className="fas fa-stethoscope mr-2"></i>Clinic Visits
                </button>
              </div>

              {activeTab === "record" && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  {healthRecord ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-3 border-b pb-2">Medical Information</h3>
                        <div className="space-y-2 text-sm">
                          <div><span className="text-gray-500">Blood Type:</span> <span className="font-medium">{healthRecord.blood_type || "Not recorded"}</span></div>
                          <div><span className="text-gray-500">Allergies:</span> <span className="font-medium">{healthRecord.allergies || "None"}</span></div>
                          <div><span className="text-gray-500">Chronic Conditions:</span> <span className="font-medium">{healthRecord.chronic_conditions || "None"}</span></div>
                          <div><span className="text-gray-500">Medications:</span> <span className="font-medium">{healthRecord.medications || "None"}</span></div>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-3 border-b pb-2">Emergency Contact</h3>
                        <div className="space-y-2 text-sm">
                          <div><span className="text-gray-500">Name:</span> <span className="font-medium">{healthRecord.emergency_contact_name || "-"}</span></div>
                          <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{healthRecord.emergency_contact_phone || "-"}</span></div>
                          <div><span className="text-gray-500">Relationship:</span> <span className="font-medium">{healthRecord.emergency_contact_relationship || "-"}</span></div>
                        </div>
                        <h3 className="font-semibold text-gray-700 mt-4 mb-3 border-b pb-2">Medical Aid</h3>
                        <div className="space-y-2 text-sm">
                          <div><span className="text-gray-500">Provider:</span> <span className="font-medium">{healthRecord.medical_aid_name || "-"}</span></div>
                          <div><span className="text-gray-500">Number:</span> <span className="font-medium">{healthRecord.medical_aid_number || "-"}</span></div>
                        </div>
                      </div>
                      {healthRecord.notes && (
                        <div className="md:col-span-2">
                          <h3 className="font-semibold text-gray-700 mb-2 border-b pb-2">Notes</h3>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{healthRecord.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <i className="fas fa-notes-medical text-4xl mb-3 block"></i>
                      <p>No health record found for this student.</p>
                      <button onClick={() => setShowHealthForm(true)} className="mt-3 text-blue-600 hover:underline text-sm">
                        Create health record
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "visits" && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  {clinicVisits.length > 0 ? (
                    <div className="space-y-4">
                      {clinicVisits.map((visit) => (
                        <div key={visit.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="text-sm text-gray-500">{formatDateTime(visit.visit_date)}</div>
                            <div className="flex gap-2">
                              {visit.parent_notified && (
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">Parent Notified</span>
                              )}
                              {visit.follow_up_required && (
                                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">Follow-up Required</span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500 font-medium">Complaint:</span>
                              <p className="text-gray-800">{visit.complaint}</p>
                            </div>
                            {visit.diagnosis && (
                              <div>
                                <span className="text-gray-500 font-medium">Diagnosis:</span>
                                <p className="text-gray-800">{visit.diagnosis}</p>
                              </div>
                            )}
                            {visit.treatment && (
                              <div>
                                <span className="text-gray-500 font-medium">Treatment:</span>
                                <p className="text-gray-800">{visit.treatment}</p>
                              </div>
                            )}
                            {visit.nurse_notes && (
                              <div>
                                <span className="text-gray-500 font-medium">Notes:</span>
                                <p className="text-gray-800">{visit.nurse_notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-400">No clinic visits recorded.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Health Record Form Modal ── */}
      {showHealthForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{healthRecord ? "Edit Health Record" : "Create Health Record"}</h2>
            <form onSubmit={handleHealthSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                  <select value={healthForm.blood_type}
                    onChange={(e) => setHealthForm({ ...healthForm, blood_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2">
                    <option value="">Select...</option>
                    {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
                  <input type="text" value={healthForm.allergies}
                    onChange={(e) => setHealthForm({ ...healthForm, allergies: e.target.value })}
                    placeholder="e.g. Peanuts, Penicillin"
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chronic Conditions</label>
                  <input type="text" value={healthForm.chronic_conditions}
                    onChange={(e) => setHealthForm({ ...healthForm, chronic_conditions: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medications</label>
                  <input type="text" value={healthForm.medications}
                    onChange={(e) => setHealthForm({ ...healthForm, medications: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>

              <h3 className="font-semibold text-gray-700 pt-2">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={healthForm.emergency_contact_name}
                    onChange={(e) => setHealthForm({ ...healthForm, emergency_contact_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={healthForm.emergency_contact_phone}
                    onChange={(e) => setHealthForm({ ...healthForm, emergency_contact_phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                  <input type="text" value={healthForm.emergency_contact_relationship}
                    onChange={(e) => setHealthForm({ ...healthForm, emergency_contact_relationship: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>

              <h3 className="font-semibold text-gray-700 pt-2">Medical Aid</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
                  <input type="text" value={healthForm.medical_aid_name}
                    onChange={(e) => setHealthForm({ ...healthForm, medical_aid_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member Number</label>
                  <input type="text" value={healthForm.medical_aid_number}
                    onChange={(e) => setHealthForm({ ...healthForm, medical_aid_number: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={healthForm.notes}
                  onChange={(e) => setHealthForm({ ...healthForm, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" rows="3" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowHealthForm(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {healthRecord ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Clinic Visit Form Modal ── */}
      {showVisitForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Record Clinic Visit</h2>
            <form onSubmit={handleVisitSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complaint *</label>
                <textarea required value={visitForm.complaint}
                  onChange={(e) => setVisitForm({ ...visitForm, complaint: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" rows="2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                <textarea value={visitForm.diagnosis}
                  onChange={(e) => setVisitForm({ ...visitForm, diagnosis: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" rows="2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Treatment</label>
                <textarea value={visitForm.treatment}
                  onChange={(e) => setVisitForm({ ...visitForm, treatment: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" rows="2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nurse Notes</label>
                <textarea value={visitForm.nurse_notes}
                  onChange={(e) => setVisitForm({ ...visitForm, nurse_notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" rows="2" />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={visitForm.parent_notified}
                    onChange={(e) => setVisitForm({ ...visitForm, parent_notified: e.target.checked })}
                    className="rounded" />
                  Parent Notified
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={visitForm.follow_up_required}
                    onChange={(e) => setVisitForm({ ...visitForm, follow_up_required: e.target.checked })}
                    className="rounded" />
                  Follow-up Required
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowVisitForm(false)}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Record Visit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
