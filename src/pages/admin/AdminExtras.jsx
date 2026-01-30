import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function AdminExtras() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  
  const [timetableStats, setTimetableStats] = useState(null);
  const [generating, setGenerating] = useState(false);
  
  const [schoolFees, setSchoolFees] = useState([]);
  const [schoolType, setSchoolType] = useState('combined');
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  
  const [additionalFees, setAdditionalFees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [showAdditionalFeeForm, setShowAdditionalFeeForm] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [additionalFeeForm, setAdditionalFeeForm] = useState({
    fee_name: '',
    amount: '',
    reason: '',
    student: '',
    student_class: '',
    apply_to: 'class',
    academic_year: new Date().getFullYear().toString(),
    academic_term: 'term_1',
    currency: 'USD'
  });
  
  const [feeForm, setFeeForm] = useState({
    grade_level: '',
    grade_name: '',
    tuition_fee: '',
    levy_fee: '0',
    sports_fee: '0',
    computer_fee: '0',
    other_fees: '0',
    academic_year: new Date().getFullYear().toString(),
    academic_term: 'term_1',
    currency: 'USD'
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [statsData, dashboardData] = await Promise.all([
        apiService.getTimetableStats(),
        apiService.getDashboardStats()
      ]);
      setTimetableStats(statsData);
      if (dashboardData.school_type) {
        setSchoolType(dashboardData.school_type);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadSchoolFees = async () => {
    try {
      setLoading(true);
      const data = await apiService.getSchoolFees();
      setSchoolFees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading school fees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTimetable = async () => {
    if (!window.confirm('This will generate new timetables for all classes. Existing timetables will be replaced. Continue?')) {
      return;
    }
    
    setGenerating(true);
    setMessage(null);
    
    try {
      const result = await apiService.generateTimetable({
        academic_year: new Date().getFullYear().toString(),
        clear_existing: true
      });
      
      if (result.success) {
        setMessage({ type: 'success', text: `${result.message} (${result.entries_count} entries created)` });
        const stats = await apiService.getTimetableStats();
        setTimetableStats(stats);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to generate timetable' });
    } finally {
      setGenerating(false);
    }
  };

  const handleFeeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    
    try {
      const feeData = {
        ...feeForm,
        grade_level: parseInt(feeForm.grade_level),
        tuition_fee: parseFloat(feeForm.tuition_fee),
        levy_fee: parseFloat(feeForm.levy_fee || 0),
        sports_fee: parseFloat(feeForm.sports_fee || 0),
        computer_fee: parseFloat(feeForm.computer_fee || 0),
        other_fees: parseFloat(feeForm.other_fees || 0)
      };
      
      if (editingFee) {
        await apiService.updateSchoolFees(editingFee.id, feeData);
        setMessage({ type: 'success', text: 'School fees updated successfully!' });
      } else {
        await apiService.createSchoolFees(feeData);
        setMessage({ type: 'success', text: 'School fees created successfully!' });
      }
      
      setShowFeeForm(false);
      setEditingFee(null);
      resetFeeForm();
      await loadSchoolFees();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to save school fees' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditFee = (fee) => {
    setEditingFee(fee);
    setFeeForm({
      grade_level: fee.grade_level.toString(),
      grade_name: fee.grade_name,
      tuition_fee: fee.tuition_fee.toString(),
      levy_fee: fee.levy_fee.toString(),
      sports_fee: fee.sports_fee.toString(),
      computer_fee: fee.computer_fee.toString(),
      other_fees: fee.other_fees.toString(),
      academic_year: fee.academic_year,
      academic_term: fee.academic_term,
      currency: fee.currency
    });
    setShowFeeForm(true);
  };

  const handleDeleteFee = async (feeId) => {
    if (!window.confirm('Are you sure you want to delete this fee record?')) return;
    
    try {
      await apiService.deleteSchoolFees(feeId);
      setMessage({ type: 'success', text: 'School fees deleted successfully!' });
      await loadSchoolFees();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete school fees' });
    }
  };

  const resetFeeForm = () => {
    setFeeForm({
      grade_level: '',
      grade_name: '',
      tuition_fee: '',
      levy_fee: '0',
      sports_fee: '0',
      computer_fee: '0',
      other_fees: '0',
      academic_year: new Date().getFullYear().toString(),
      academic_term: 'term_1',
      currency: 'USD'
    });
  };

  const loadAdditionalFees = async () => {
    try {
      setLoading(true);
      const [feesData, classesData, studentsData] = await Promise.all([
        apiService.getAdditionalFees(),
        apiService.fetchClasses(),
        apiService.getStudentsForPayment()
      ]);
      setAdditionalFees(Array.isArray(feesData) ? feesData : []);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setStudents(studentsData?.students || []);
    } catch (error) {
      console.error("Error loading additional fees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdditionalFee = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        fee_name: additionalFeeForm.fee_name,
        amount: additionalFeeForm.amount,
        reason: additionalFeeForm.reason,
        currency: additionalFeeForm.currency,
        academic_year: additionalFeeForm.academic_year,
        academic_term: additionalFeeForm.academic_term,
      };
      
      if (additionalFeeForm.apply_to === 'student' && additionalFeeForm.student) {
        payload.student = additionalFeeForm.student;
      } else if (additionalFeeForm.apply_to === 'class' && additionalFeeForm.student_class) {
        payload.student_class = additionalFeeForm.student_class;
      }
      
      await apiService.createAdditionalFee(payload);
      setMessage({ type: 'success', text: 'Additional fee created successfully!' });
      setShowAdditionalFeeForm(false);
      resetAdditionalFeeForm();
      await loadAdditionalFees();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to create additional fee' });
    }
  };

  const handleDeleteAdditionalFee = async (feeId) => {
    if (!window.confirm('Are you sure you want to delete this additional fee?')) return;
    
    try {
      await apiService.deleteAdditionalFee(feeId);
      setMessage({ type: 'success', text: 'Additional fee deleted successfully!' });
      await loadAdditionalFees();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete additional fee' });
    }
  };

  const resetAdditionalFeeForm = () => {
    setAdditionalFeeForm({
      fee_name: '',
      amount: '',
      reason: '',
      student: '',
      student_class: '',
      apply_to: 'class',
      academic_year: new Date().getFullYear().toString(),
      academic_term: 'term_1',
      currency: 'USD'
    });
    setStudentSearch('');
    setSelectedStudentName('');
    setShowStudentDropdown(false);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.class_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.student_number?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleStudentSelect = (student) => {
    setAdditionalFeeForm({...additionalFeeForm, student: student.id});
    setSelectedStudentName(`${student.name} (${student.class_name})`);
    setStudentSearch('');
    setShowStudentDropdown(false);
  };

  const getGradeName = (level) => {
    const l = parseInt(level);
    if (l === -1) return 'ECD B';
    if (l === 0) return 'ECD A';
    if (l <= 7) return `Grade ${l}`;
    return `Form ${l - 7}`;
  };

  const handleGradeSelect = (e) => {
    const gradeLevel = e.target.value;
    setFeeForm({
      ...feeForm,
      grade_level: gradeLevel,
      grade_name: getGradeName(gradeLevel)
    });
  };

  const showPrimary = schoolType === 'primary' || schoolType === 'combined';
  const showSecondary = schoolType === 'secondary' || schoolType === 'high' || schoolType === 'combined';

  return (
    <div>
      <Header title="Extras" user={user} />
      
      <div className="p-6">
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Admin Tools</h2>
          <p className="text-gray-600 mb-6">Select a tool to manage school operations</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => { setActiveSection('timetable'); }}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                activeSection === 'timetable' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-blue-300 bg-white'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-calendar-alt text-blue-600 text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Generate Timetables</h3>
                  <p className="text-gray-600 mt-1 text-sm">
                    Auto-generate conflict-free timetables using CSP algorithm. Prevents teacher, class, and room conflicts.
                  </p>
                  <div className="mt-3 flex items-center text-xs text-gray-500">
                    <i className="fas fa-info-circle mr-1"></i>
                    Uses backtracking with MRV heuristic
                  </div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => { setActiveSection('fees'); loadSchoolFees(); }}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                activeSection === 'fees' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-green-300 bg-white'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-dollar-sign text-green-600 text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">School Fees</h3>
                  <p className="text-gray-600 mt-1 text-sm">
                    Set tuition and fees for each grade/form. Parents and students will see their applicable fees.
                  </p>
                  <div className="mt-3 flex items-center text-xs text-gray-500">
                    <i className="fas fa-eye mr-1"></i>
                    Visible to parents & students
                  </div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => { setActiveSection('additional'); loadAdditionalFees(); }}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                activeSection === 'additional' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 hover:border-purple-300 bg-white'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className="w-14 h-14 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-plus-circle text-purple-600 text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Other Fees</h3>
                  <p className="text-gray-600 mt-1 text-sm">
                    Add extra charges like trip fees, uniforms, or special levies for classes or individual students.
                  </p>
                  <div className="mt-3 flex items-center text-xs text-gray-500">
                    <i className="fas fa-receipt mr-1"></i>
                    Added to student invoices
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {activeSection === 'timetable' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Timetable Generation</h3>
              <button
                onClick={() => setActiveSection(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Total Entries</p>
                <p className="text-2xl font-bold text-blue-700">{timetableStats?.total_entries || 0}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Classes Covered</p>
                <p className="text-2xl font-bold text-green-700">
                  {timetableStats?.classes_with_timetables || 0} / {timetableStats?.total_classes || 0}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Coverage</p>
                <p className="text-2xl font-bold text-purple-700">{timetableStats?.coverage_percent || 0}%</p>
              </div>
            </div>
            
            <button
              onClick={handleGenerateTimetable}
              disabled={generating}
              className={`w-full py-3 rounded-lg font-semibold text-white transition ${
                generating 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {generating ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Generating Timetables...
                </>
              ) : (
                <>
                  <i className="fas fa-magic mr-2"></i>
                  Generate Timetables for All Classes
                </>
              )}
            </button>
          </div>
        )}

        {activeSection === 'fees' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">School Fees Management</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => { setShowFeeForm(true); setEditingFee(null); resetFeeForm(); }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <i className="fas fa-plus mr-2"></i>Add Fees
                </button>
                <button
                  onClick={() => setActiveSection(null)}
                  className="text-gray-500 hover:text-gray-700 px-2"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {showFeeForm && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">
                  {editingFee ? 'Edit School Fees' : 'Add New School Fees'}
                </h4>
                <form onSubmit={handleFeeSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Grade/Form *</label>
                      {!editingFee ? (
                        <select
                          value={feeForm.grade_level}
                          onChange={handleGradeSelect}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          required
                        >
                          <option value="">Select Grade/Form...</option>
                          {showPrimary && (
                            <optgroup label="Primary (ECD - Grade 7)">
                              <option value="-1">ECD B</option>
                              <option value="0">ECD A</option>
                              <option value="1">Grade 1</option>
                              <option value="2">Grade 2</option>
                              <option value="3">Grade 3</option>
                              <option value="4">Grade 4</option>
                              <option value="5">Grade 5</option>
                              <option value="6">Grade 6</option>
                              <option value="7">Grade 7</option>
                            </optgroup>
                          )}
                          {showSecondary && (
                            <optgroup label="Secondary (Form 1 - Form 6)">
                              <option value="8">Form 1</option>
                              <option value="9">Form 2</option>
                              <option value="10">Form 3</option>
                              <option value="11">Form 4</option>
                              <option value="12">Form 5 (Lower 6)</option>
                              <option value="13">Form 6 (Upper 6)</option>
                            </optgroup>
                          )}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={feeForm.grade_name}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                          disabled
                        />
                      )}
                      {feeForm.grade_level && (
                        <p className="text-xs text-blue-600 mt-1">Fee will be set for: {feeForm.grade_name}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                      <input
                        type="text"
                        value={feeForm.academic_year}
                        onChange={(e) => setFeeForm({...feeForm, academic_year: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="e.g., 2026"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                      <select
                        value={feeForm.academic_term}
                        onChange={(e) => setFeeForm({...feeForm, academic_term: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        required
                      >
                        <option value="term_1">Term 1</option>
                        <option value="term_2">Term 2</option>
                        <option value="term_3">Term 3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={feeForm.currency}
                        onChange={(e) => setFeeForm({...feeForm, currency: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="ZWL">ZWL ($)</option>
                        <option value="ZAR">ZAR (R)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tuition Fee *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={feeForm.tuition_fee}
                        onChange={(e) => setFeeForm({...feeForm, tuition_fee: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Levy Fee</label>
                      <input
                        type="number"
                        step="0.01"
                        value={feeForm.levy_fee}
                        onChange={(e) => setFeeForm({...feeForm, levy_fee: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sports Fee</label>
                      <input
                        type="number"
                        step="0.01"
                        value={feeForm.sports_fee}
                        onChange={(e) => setFeeForm({...feeForm, sports_fee: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Computer Fee</label>
                      <input
                        type="number"
                        step="0.01"
                        value={feeForm.computer_fee}
                        onChange={(e) => setFeeForm({...feeForm, computer_fee: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Other Fees</label>
                      <input
                        type="number"
                        step="0.01"
                        value={feeForm.other_fees}
                        onChange={(e) => setFeeForm({...feeForm, other_fees: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : (editingFee ? 'Update Fees' : 'Create Fees')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowFeeForm(false); setEditingFee(null); }}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading && !showFeeForm ? (
              <LoadingSpinner />
            ) : (
              <div className="overflow-x-auto">
                {schoolFees.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-dollar-sign text-4xl mb-4 opacity-50"></i>
                    <p>No school fees configured yet.</p>
                    <p className="text-sm">Click "Add Fees" to set up fees for each grade/form.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Grade/Form</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Term</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Year</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Tuition</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Levy</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Sports</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Computer</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Other</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {schoolFees.map((fee) => (
                        <tr key={fee.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{fee.grade_name}</td>
                          <td className="px-4 py-3 capitalize">{fee.academic_term.replace('_', ' ')}</td>
                          <td className="px-4 py-3">{fee.academic_year}</td>
                          <td className="px-4 py-3 text-right">{fee.currency} {parseFloat(fee.tuition_fee).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">{parseFloat(fee.levy_fee).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">{parseFloat(fee.sports_fee).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">{parseFloat(fee.computer_fee).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">{parseFloat(fee.other_fees).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            {fee.currency} {parseFloat(fee.total_fee).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleEditFee(fee)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                              title="Edit"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              onClick={() => handleDeleteFee(fee.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {activeSection === 'additional' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Other Fees / Additional Charges</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAdditionalFeeForm(true)}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <i className="fas fa-plus mr-2"></i>
                  Add Other Fee
                </button>
                <button
                  onClick={() => setActiveSection(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
              <p className="text-purple-800 text-sm">
                <i className="fas fa-info-circle mr-2"></i>
                Add extra charges for trips, uniforms, books, or any special levies. These will be added to student invoices and visible to parents with the reason you provide.
              </p>
            </div>

            {showAdditionalFeeForm && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  Add New Fee
                </h4>
                <form onSubmit={handleCreateAdditionalFee} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fee Name *</label>
                      <input
                        type="text"
                        value={additionalFeeForm.fee_name}
                        onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, fee_name: e.target.value})}
                        placeholder="e.g., School Trip, Uniform Fee"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                      <div className="flex">
                        <select
                          value={additionalFeeForm.currency}
                          onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, currency: e.target.value})}
                          className="px-3 py-2 border rounded-l-lg bg-gray-100"
                        >
                          <option value="USD">USD</option>
                          <option value="ZWL">ZWL</option>
                          <option value="ZAR">ZAR</option>
                        </select>
                        <input
                          type="number"
                          value={additionalFeeForm.amount}
                          onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, amount: e.target.value})}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="flex-1 px-3 py-2 border-t border-r border-b rounded-r-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Description *</label>
                      <textarea
                        value={additionalFeeForm.reason}
                        onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, reason: e.target.value})}
                        placeholder="Explain to parents what this fee is for..."
                        rows="2"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Apply To *</label>
                      <select
                        value={additionalFeeForm.apply_to}
                        onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, apply_to: e.target.value, student: '', student_class: ''})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="class">Entire Class</option>
                        <option value="student">Specific Student</option>
                      </select>
                    </div>
                    {additionalFeeForm.apply_to === 'class' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Class *</label>
                        <select
                          value={additionalFeeForm.student_class}
                          onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, student_class: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        >
                          <option value="">-- Select Class --</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search & Select Student *</label>
                        {selectedStudentName ? (
                          <div className="flex items-center justify-between px-3 py-2 border rounded-lg bg-purple-50">
                            <span className="text-purple-700 font-medium">{selectedStudentName}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setAdditionalFeeForm({...additionalFeeForm, student: ''});
                                setSelectedStudentName('');
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={studentSearch}
                              onChange={(e) => {
                                setStudentSearch(e.target.value);
                                setShowStudentDropdown(true);
                              }}
                              onFocus={() => setShowStudentDropdown(true)}
                              placeholder="Type to search by name, class or student number..."
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            {showStudentDropdown && (
                              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {filteredStudents.length === 0 ? (
                                  <div className="px-4 py-3 text-gray-500 text-sm">
                                    {studentSearch ? 'No students found' : 'Start typing to search...'}
                                  </div>
                                ) : (
                                  filteredStudents.slice(0, 50).map((s) => (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => handleStudentSelect(s)}
                                      className="w-full px-4 py-2 text-left hover:bg-purple-50 flex justify-between items-center border-b last:border-b-0"
                                    >
                                      <span className="font-medium">{s.name}</span>
                                      <span className="text-sm text-gray-500">{s.class_name}</span>
                                    </button>
                                  ))
                                )}
                                {filteredStudents.length > 50 && (
                                  <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50">
                                    Showing first 50 results. Type more to narrow search.
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        <input type="hidden" value={additionalFeeForm.student} required={additionalFeeForm.apply_to === 'student'} />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                      <input
                        type="text"
                        value={additionalFeeForm.academic_year}
                        onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, academic_year: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                      <select
                        value={additionalFeeForm.academic_term}
                        onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, academic_term: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="term_1">Term 1</option>
                        <option value="term_2">Term 2</option>
                        <option value="term_3">Term 3</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      Add Fee
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAdditionalFeeForm(false); resetAdditionalFeeForm(); }}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading && !showAdditionalFeeForm ? (
              <LoadingSpinner />
            ) : (
              <div className="overflow-x-auto">
                {additionalFees.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <i className="fas fa-plus-circle text-4xl mb-4 opacity-50"></i>
                    <p>No additional fees added yet.</p>
                    <p className="text-sm">Click "Add Other Fee" to create extra charges for students.</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fee Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Applied To</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reason</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Term/Year</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {additionalFees.map((fee) => (
                        <tr key={fee.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{fee.fee_name}</td>
                          <td className="px-4 py-3">
                            {fee.student_name ? (
                              <span className="text-blue-600">{fee.student_name}</span>
                            ) : fee.class_name ? (
                              <span className="text-green-600">{fee.class_name} (Class)</span>
                            ) : (
                              <span className="text-gray-400">Not specified</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-purple-600">
                            {fee.currency} {parseFloat(fee.amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate" title={fee.reason}>
                            {fee.reason}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {fee.academic_term?.replace('_', ' ')} {fee.academic_year}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${fee.is_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {fee.is_paid ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteAdditionalFee(fee.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
