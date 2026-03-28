import React, { useState, useEffect, useRef } from "react";
import { 
  Users, 
  UserPlus, 
  Upload, 
  Search, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  AlertCircle,
  Download,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import ConfirmModal from "./ConfirmModal";
import Toast from "./Toast";

interface Student {
  student_id: string;
  name: string;
  course: string;
  year_level: string;
  email?: string;
}

const StudentManagement = ({ user }: { user: any }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [limit] = useState(50);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Student>({
    student_id: "",
    name: "",
    course: "",
    year_level: "1st Year",
    email: ""
  });
  const [bulkStatus, setBulkStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchStudents();
  }, [currentPage, debouncedSearch]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students?page=${currentPage}&limit=${limit}&search=${debouncedSearch}`);
      
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Invalid response format from server");
      }

      const data = await res.json();
      setStudents(Array.isArray(data.students) ? data.students : []);
      setTotalPages(data.totalPages || 1);
      setTotalStudents(data.total || 0);
      setLoading(false);
    } catch (err) {
      console.error("Fetch students error:", err);
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setIsAdding(false);
        setFormData({ student_id: "", name: "", course: "", year_level: "1st Year", email: "" });
        fetchStudents();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        fetchStudents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Student",
      message: "Are you sure you want to delete this student? This action cannot be undone.",
      onConfirm: async () => {
        try {
          console.log(`Attempting to delete student with id: ${id}`);
          const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
          if (res.ok) {
            await fetchStudents();
            setToast({ message: "Student record deleted successfully.", type: "success" });
          } else {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to delete student");
          }
        } catch (err: any) {
          console.error("Delete student error:", err);
          setToast({ message: `Error: ${err.message}`, type: "error" });
        }
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const processData = async (parsedData: any[]) => {
      const formattedStudents = parsedData.map(row => ({
        student_id: row.student_id || row["Student ID"] || row.id || row["ID"],
        name: row.name || row["Name"] || row.full_name || row["Full Name"],
        course: row.course || row["Course"] || row.program || row["Program"],
        year_level: row.year_level || row["Year Level"] || row.year || row["Year"] || "1st Year",
        email: row.email || row["Email"]
      })).filter(s => s.student_id && s.name);

      if (formattedStudents.length === 0) {
        setBulkStatus({ type: 'error', message: "No valid student data found in file." });
        return;
      }

      try {
        const res = await fetch("/api/students/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: formattedStudents })
        });
        const data = await res.json();
        if (data.success) {
          setBulkStatus({ type: 'success', message: `Successfully imported ${data.count} students.` });
          fetchStudents();
        } else {
          setBulkStatus({ type: 'error', message: data.message });
        }
      } catch (err) {
        setBulkStatus({ type: 'error', message: "Failed to upload students." });
      }
    };

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data)
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processData(data);
      };
      reader.readAsBinaryString(file);
    } else {
      setBulkStatus({ type: 'error', message: "Unsupported file format. Please use CSV or Excel." });
    }
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([
      { student_id: "2024-0001", name: "Juan Dela Cruz", course: "BSIT", year_level: "1st Year", email: "juan@example.com" }
    ]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "student_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-hero-navy">Student Management</h1>
          <p className="text-gray-500">Manage your organization's student database ({totalStudents} total).</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsAdding(true)}
            className="hero-btn-primary flex items-center gap-2"
          >
            <UserPlus size={18} /> Add Student
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="hero-btn-secondary flex items-center gap-2"
          >
            <Upload size={18} /> Bulk Import
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv, .xlsx, .xls" 
            className="hidden" 
          />
          <button 
            onClick={downloadTemplate}
            className="p-2 text-gray-500 hover:text-hero-navy transition-colors"
            title="Download CSV Template"
          >
            <Download size={20} />
          </button>
        </div>
      </header>

      {bulkStatus && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-center gap-3 ${
            bulkStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {bulkStatus.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{bulkStatus.message}</span>
          <button onClick={() => setBulkStatus(null)} className="ml-auto"><X size={18} /></button>
        </motion.div>
      )}

      <div className="hero-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, ID, or course..." 
              className="hero-input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student ID</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Full Name</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Email</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Course</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Year Level</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {isAdding && (
                  <motion.tr 
                    initial={{ opacity: 0, bg: "rgba(234, 179, 8, 0.1)" }}
                    animate={{ opacity: 1, bg: "transparent" }}
                    className="border-b border-gray-50 bg-yellow-50/30"
                  >
                    <td className="py-3 px-4">
                      <input 
                        type="text" 
                        className="hero-input text-sm py-1" 
                        placeholder="ID"
                        value={formData.student_id}
                        onChange={(e) => setFormData({...formData, student_id: e.target.value})}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input 
                        type="text" 
                        className="hero-input text-sm py-1" 
                        placeholder="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input 
                        type="email" 
                        className="hero-input text-sm py-1" 
                        placeholder="Email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input 
                        type="text" 
                        className="hero-input text-sm py-1" 
                        placeholder="Course"
                        value={formData.course}
                        onChange={(e) => setFormData({...formData, course: e.target.value})}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <select 
                        className="hero-input text-sm py-1"
                        value={formData.year_level}
                        onChange={(e) => setFormData({...formData, year_level: e.target.value})}
                      >
                        <option>1st Year</option>
                        <option>2nd Year</option>
                        <option>3rd Year</option>
                        <option>4th Year</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button onClick={handleAdd} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check size={18} /></button>
                      <button onClick={() => setIsAdding(false)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><X size={18} /></button>
                    </td>
                  </motion.tr>
                )}

                {students.map((student) => (
                  <motion.tr 
                    key={student.student_id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group"
                  >
                    {editingId === student.student_id ? (
                      <>
                        <td className="py-3 px-4 text-sm font-mono font-bold text-hero-navy">{student.student_id}</td>
                        <td className="py-3 px-4">
                          <input 
                            type="text" 
                            className="hero-input text-sm py-1" 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input 
                            type="email" 
                            className="hero-input text-sm py-1" 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input 
                            type="text" 
                            className="hero-input text-sm py-1" 
                            value={formData.course}
                            onChange={(e) => setFormData({...formData, course: e.target.value})}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <select 
                            className="hero-input text-sm py-1"
                            value={formData.year_level}
                            onChange={(e) => setFormData({...formData, year_level: e.target.value})}
                          >
                            <option>1st Year</option>
                            <option>2nd Year</option>
                            <option>3rd Year</option>
                            <option>4th Year</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button onClick={() => handleUpdate(student.student_id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check size={18} /></button>
                          <button onClick={() => setEditingId(null)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><X size={18} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-4 px-4 text-sm font-mono font-bold text-hero-navy">{student.student_id}</td>
                        <td className="py-4 px-4 text-sm font-bold text-gray-700">{student.name}</td>
                        <td className="py-4 px-4 text-sm text-gray-500">{student.email || "N/A"}</td>
                        <td className="py-4 px-4 text-sm text-gray-500">{student.course}</td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded uppercase tracking-wider">
                            {student.year_level}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingId(student.student_id);
                              setFormData(student);
                            }} 
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(student.student_id)} 
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </>
                    )}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {students.length === 0 && !loading && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="text-gray-300" size={32} />
              </div>
              <p className="text-gray-500 font-medium">No students found.</p>
              <button onClick={() => setIsAdding(true)} className="text-hero-gold font-bold text-sm mt-2 hover:underline">
                Add your first student
              </button>
            </div>
          )}
          
          {totalPages > 1 && (
            <div className="p-4 flex items-center justify-between border-t border-gray-50 bg-gray-50/30">
              <div className="text-xs text-gray-500">
                Showing <span className="font-bold text-hero-navy">{(currentPage - 1) * limit + 1}</span> to <span className="font-bold text-hero-navy">{Math.min(currentPage * limit, totalStudents)}</span> of <span className="font-bold text-hero-navy">{totalStudents}</span> students
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft size={16} />
                  <span className="text-xs font-bold pr-1">Prev</span>
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          currentPage === pageNum 
                            ? "bg-hero-navy text-white shadow-md" 
                            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  <span className="text-xs font-bold pl-1">Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="hero-card p-6 bg-hero-navy text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-hero-gold rounded-lg">
              <FileSpreadsheet className="text-hero-navy" size={20} />
            </div>
            <h3 className="font-bold text-lg">Bulk Import Guide</h3>
          </div>
          <p className="text-sm text-gray-300 mb-4 leading-relaxed">
            To import your 5,000+ students, prepare a CSV or Excel file with the following columns:
            <br /><br />
            <code className="bg-white/10 px-2 py-1 rounded text-hero-gold">student_id</code>, 
            <code className="bg-white/10 px-2 py-1 rounded text-hero-gold">name</code>, 
            <code className="bg-white/10 px-2 py-1 rounded text-hero-gold">email</code>, 
            <code className="bg-white/10 px-2 py-1 rounded text-hero-gold">course</code>, 
            <code className="bg-white/10 px-2 py-1 rounded text-hero-gold">year_level</code>
          </p>
          <button 
            onClick={downloadTemplate}
            className="text-xs font-bold text-hero-gold hover:underline flex items-center gap-1"
          >
            <Download size={14} /> Download Sample Template
          </button>
        </div>

        <div className="hero-card p-6 border-2 border-dashed border-gray-200 bg-transparent flex flex-col items-center justify-center text-center">
          <Upload className="text-gray-300 mb-4" size={48} />
          <h3 className="font-bold text-gray-700">Ready to upload?</h3>
          <p className="text-sm text-gray-500 mb-4">Select your CSV or Excel file to populate the database.</p>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="hero-btn-secondary"
          >
            Choose File
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />

      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentManagement;
