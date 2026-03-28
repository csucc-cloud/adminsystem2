import React, { useState, useEffect } from "react";
import { 
  Wallet, 
  History, 
  Search, 
  Plus, 
  Printer, 
  Mail, 
  CreditCard, 
  User, 
  FileText, 
  CheckCircle2, 
  X,
  ChevronRight,
  TrendingUp,
  Download,
  Filter,
  AlertCircle,
  RefreshCw,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import ConfirmModal from "./ConfirmModal";
import Toast from "./Toast";

interface FinanceRecord {
  receipt_id: string;
  student_id: string;
  name: string;
  amount: number;
  purpose: string;
  date: string;
  collector: string;
  course?: string;
  year_level?: string;
  email?: string;
  notes?: string;
}

interface PaymentStatus {
  student_id: string;
  name: string;
  course: string;
  year_level: string;
  receipt_id: string | null;
  amount: number | null;
  date: string | null;
}

const FinancialSystem = ({ user }: { user: any }) => {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus[]>([]);
  const [activeTab, setActiveTab] = useState<"ledger" | "status">("ledger");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPurpose, setSelectedPurpose] = useState("Membership Fee");
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    studentId: "",
    name: "",
    amount: "",
    purpose: "Membership Fee",
    notes: ""
  });
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [emailPromptRecord, setEmailPromptRecord] = useState<FinanceRecord | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

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
    fetchRecords();
    fetchStatus();
    const interval = setInterval(() => {
      fetchRecords();
      fetchStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedPurpose]);

  const fetchRecords = async () => {
    try {
      const res = await fetch("/api/finance");
      if (!res.ok) throw new Error("Failed to fetch records");
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) throw new Error("Invalid response format");
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch records error:", err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/finance/status?purpose=${encodeURIComponent(selectedPurpose)}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) throw new Error("Invalid response format");
      const data = await res.json();
      setPaymentStatus(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch status error:", err);
    }
  };

  const deleteRecord = async (receiptId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Payment Record",
      message: "Are you sure you want to delete this payment record? This action cannot be undone.",
      onConfirm: async () => {
        try {
          console.log(`Attempting to delete finance record with receiptId: ${receiptId}`);
          const res = await fetch(`/api/finance/${receiptId}`, { method: "DELETE" });
          if (res.ok) {
            await fetchRecords();
            await fetchStatus();
            setToast({ message: "Payment record deleted successfully.", type: "success" });
          } else {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to delete record");
          }
        } catch (err: any) {
          console.error("Delete record error:", err);
          setToast({ message: `Error: ${err.message}`, type: "error" });
        }
      }
    });
  };

  const handleEmailReceipt = async (record: FinanceRecord, overrideEmail?: string) => {
    const targetEmail = overrideEmail || record.email;

    if (!targetEmail?.trim()) {
      setEmailPromptRecord(record);
      setManualEmail("");
      setEmailStatus(null);
      return;
    }

    setEmailingId(record.receipt_id);
    setEmailStatus(null);
    
    try {
      const res = await fetch("/api/finance/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          receiptId: record.receipt_id,
          email: targetEmail !== record.email ? targetEmail : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setEmailStatus({ type: 'success', message: `Receipt successfully emailed to ${targetEmail}` });
        // Don't close immediately so they can see the success message
        setTimeout(() => {
          if (emailStatus?.type === 'success') setEmailPromptRecord(null);
        }, 2000);
      } else {
        setEmailStatus({ type: 'error', message: `Failed to send email: ${data.message}` });
      }
    } catch (err) {
      console.error(err);
      setEmailStatus({ type: 'error', message: "An error occurred while sending the email." });
    } finally {
      setEmailingId(null);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/finance/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          collector: user.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setLastReceipt({ ...formData, receiptId: data.receiptId, date: new Date().toISOString(), collector: user.name });
        setIsAdding(false);
        setFormData({ studentId: "", name: "", amount: "", purpose: "Membership Fee", notes: "" });
        fetchRecords();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const generatePDF = (receipt: any) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a5"
    });

    // Normalize data (handle both camelCase and snake_case)
    const data = {
      receiptId: String(receipt.receiptId || receipt.receipt_id || ""),
      date: receipt.date ? new Date(receipt.date).toLocaleString() : new Date().toLocaleString(),
      name: String(receipt.name || ""),
      studentId: String(receipt.studentId || receipt.student_id || ""),
      purpose: String(receipt.purpose || ""),
      amount: parseFloat(receipt.amount || 0),
      notes: String(receipt.notes || ""),
      collector: String(receipt.collector || "")
    };

    // Branding Colors
    const navy = [0, 0, 128];
    const gold = [255, 215, 0];

    // Header
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.rect(0, 0, 148, 40, "F");
    
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("HERO ORGANIZATION", 74, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text("INTEGRATED WEB SYSTEM - OFFICIAL RECEIPT", 74, 28, { align: "center" });

    // Content
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    let y = 55;
    const leftMargin = 15;
    const rightMargin = 133;

    doc.setFont("helvetica", "bold");
    doc.text("Receipt ID:", leftMargin, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.receiptId, 50, y);
    
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Date:", leftMargin, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.date, 50, y);

    y += 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(leftMargin, y, rightMargin, y);
    
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Student Name:", leftMargin, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.name, 50, y);

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Student ID:", leftMargin, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.studentId, 50, y);

    y += 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(leftMargin, y, rightMargin, y);

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Purpose:", leftMargin, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.purpose, 50, y);

    y += 10;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Amount Paid:", leftMargin, y);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text(`PHP ${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 50, y);

    if (data.notes && data.notes !== "undefined") {
      y += 15;
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("Notes:", leftMargin, y);
      doc.setFont("helvetica", "normal");
      const splitNotes = doc.splitTextToSize(data.notes, rightMargin - 50);
      doc.text(splitNotes, 50, y);
    }

    // Footer
    y = 180;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "italic");
    doc.text("This is a system-generated receipt.", 74, y, { align: "center" });
    
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text(`Collector: ${data.collector}`, 74, y, { align: "center" });

    doc.save(`HERO-Receipt-${data.receiptId}.pdf`);
  };

  const totalCollected = records.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hero-navy flex items-center gap-2">
            <Wallet className="text-hero-gold" /> Financial Management
          </h1>
          <p className="text-gray-500 text-sm">Organization Ledger & Receipt System</p>
        </div>
        
        <button 
          onClick={() => setIsAdding(true)}
          className="hero-btn-primary flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg"
        >
          <Plus size={20} />
          Record Payment
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Summary Cards */}
        <div className="lg:col-span-1 space-y-6">
          <div className="hero-card p-6 bg-hero-navy text-white">
            <p className="text-xs font-bold text-hero-gold uppercase tracking-widest mb-1">Total Collections</p>
            <h2 className="text-3xl font-black">₱{totalCollected.toLocaleString()}</h2>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-60">
              <span>Updated Today</span>
              <TrendingUp size={12} />
            </div>
          </div>

          <div className="hero-card p-6">
            <h3 className="font-bold text-hero-navy mb-4 flex items-center gap-2">
              <History size={18} className="text-hero-gold" /> Recent Purposes
            </h3>
            <div className="space-y-3">
              {["Membership Fee", "Sports Fest", "Seminar", "Donation"].map((p) => (
                <div key={p} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                  <span className="font-medium text-gray-600">{p}</span>
                  <ChevronRight size={12} className="text-gray-300" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="lg:col-span-3">
          <div className="hero-card h-full flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveTab("ledger")}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    activeTab === "ledger" ? "bg-hero-navy text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  Transaction Ledger
                </button>
                <button 
                  onClick={() => setActiveTab("status")}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    activeTab === "status" ? "bg-hero-navy text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  Payment Status
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                {activeTab === "status" && (
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-gray-400" />
                    <select 
                      className="text-xs font-bold text-hero-navy bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none"
                      value={selectedPurpose}
                      onChange={(e) => setSelectedPurpose(e.target.value)}
                    >
                      <option>Membership Fee</option>
                      <option>Sports Fest</option>
                      <option>Seminar</option>
                    </select>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-hero-navy"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              {activeTab === "ledger" ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Receipt ID</th>
                      <th className="px-6 py-3">Student</th>
                      <th className="px-6 py-3">Purpose</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Notes</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map((record) => (
                      <tr key={record.receipt_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-[10px] font-bold text-hero-navy">
                          {record.receipt_id}
                        </td>
                        <td className="px-6 py-4 relative group">
                          <div 
                            className="cursor-help"
                            onMouseEnter={() => setHoveredStudent(record.receipt_id)}
                            onMouseLeave={() => setHoveredStudent(null)}
                          >
                            <div className="font-bold text-hero-navy group-hover:text-hero-gold transition-colors">{record.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{record.student_id}</div>
                          </div>
                          
                          <AnimatePresence>
                            {hoveredStudent === record.receipt_id && (record.course || record.year_level) && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute left-6 top-full mt-1 z-[120] w-48 bg-hero-navy text-white p-3 rounded-xl shadow-xl border border-white/10"
                              >
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                                  <User size={12} className="text-hero-gold" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Student Details</span>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-400">Course:</span>
                                    <span className="text-[10px] font-bold text-hero-gold">{record.course || "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-400">Year:</span>
                                    <span className="text-[10px] font-bold text-hero-gold">{record.year_level || "N/A"}</span>
                                  </div>
                                </div>
                                <div className="absolute -top-1 left-4 w-2 h-2 bg-hero-navy rotate-45 border-t border-l border-white/10"></div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-gray-600">
                          {record.purpose}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-black text-hero-navy">
                            ₱{record.amount.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[10px] text-gray-500 max-w-[150px] truncate italic">
                            {record.notes || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => generatePDF({ ...record, receiptId: record.receipt_id })}
                              className="p-1.5 text-gray-400 hover:text-hero-navy transition-colors"
                              title="Print Receipt"
                            >
                              <Printer size={14} />
                            </button>
                            <button 
                              onClick={() => handleEmailReceipt(record)}
                              disabled={emailingId === record.receipt_id}
                              className={`p-1.5 transition-colors ${
                                emailingId === record.receipt_id ? "text-hero-gold animate-pulse" : "text-gray-400 hover:text-hero-navy"
                              }`}
                              title="Email Receipt"
                            >
                              <Mail size={14} />
                            </button>
                            <button 
                              onClick={() => deleteRecord(record.receipt_id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Student</th>
                      <th className="px-6 py-3">Course/Year</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Receipt</th>
                      <th className="px-6 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paymentStatus.map((s) => (
                      <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-hero-navy">{s.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{s.student_id}</div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-gray-600">
                          {s.course} - {s.year_level}
                        </td>
                        <td className="px-6 py-4">
                          {s.receipt_id ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-full">
                              Paid
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 w-fit">
                              <AlertCircle size={10} /> Unpaid
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-[10px] text-gray-400">
                          {s.receipt_id || "N/A"}
                        </td>
                        <td className="px-6 py-4 font-bold text-hero-navy">
                          {s.amount ? `₱${s.amount.toLocaleString()}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Record Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-hero-navy/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-hero-gold p-6 flex items-center justify-between">
                <h2 className="text-hero-navy font-bold text-xl flex items-center gap-2">
                  <CreditCard size={24} /> Record New Payment
                </h2>
                <button onClick={() => setIsAdding(false)} className="text-hero-navy hover:bg-black/5 p-1 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <User size={12} /> Student ID
                    </label>
                    <input 
                      type="text" 
                      className="hero-input" 
                      placeholder="2024-0001"
                      required
                      value={formData.studentId}
                      onChange={async (e) => {
                        const id = e.target.value;
                        setFormData({ ...formData, studentId: id });
                        if (id.length >= 4) {
                          try {
                            const res = await fetch(`/api/students/${id}`);
                            if (res.ok) {
                              const student = await res.json();
                              setFormData(prev => ({ ...prev, name: student.name }));
                            }
                          } catch (err) {
                            // Silently fail if not found
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <User size={12} /> Student Name
                    </label>
                    <input 
                      type="text" 
                      className="hero-input" 
                      placeholder="Full Name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Wallet size={12} /> Amount (₱)
                    </label>
                    <input 
                      type="number" 
                      className="hero-input" 
                      placeholder="0.00"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <FileText size={12} /> Purpose
                    </label>
                    <select 
                      className="hero-input"
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    >
                      <option>Membership Fee</option>
                      <option>Sports Fest</option>
                      <option>Seminar</option>
                      <option>Donation</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <FileText size={12} /> Custom Notes / Message
                  </label>
                  <textarea 
                    className="hero-input min-h-[80px] py-3 resize-none" 
                    placeholder="Add a short message or note for the receipt..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 hero-btn-primary py-3 text-lg">
                    Generate Receipt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Success Modal */}
      <AnimatePresence>
        {lastReceipt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-hero-navy/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center mb-6">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="text-2xl font-black text-hero-navy uppercase tracking-tighter">Payment Recorded</h2>
              <p className="text-gray-500 text-sm mt-2">Receipt ID: <span className="font-mono font-bold text-hero-navy">{lastReceipt.receiptId}</span></p>
              
              <div className="mt-8 space-y-3">
                <button 
                  onClick={() => generatePDF(lastReceipt)}
                  className="w-full hero-btn-primary flex items-center justify-center gap-2 py-3"
                >
                  <Printer size={20} /> Print Receipt
                </button>
                <button 
                  onClick={() => generatePDF(lastReceipt)}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <Download size={20} /> Download PDF
                </button>
                <button onClick={() => setLastReceipt(null)} className="w-full py-3 text-sm font-bold text-hero-navy hover:underline">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {emailPromptRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-hero-navy p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Mail size={20} className="text-hero-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter">Send Receipt</h3>
                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Manual Email Entry</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEmailPromptRecord(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8">
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-4">
                    This student does not have an email address registered. Please enter an email address to send the receipt to:
                  </p>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="email"
                      placeholder="student@example.com"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-hero-gold focus:ring-0 transition-all font-bold text-hero-navy"
                      autoFocus
                    />
                  </div>
                </div>

                {emailStatus && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                      emailStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {emailStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <p className="text-xs font-bold">{emailStatus.message}</p>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setEmailPromptRecord(null)}
                    className="flex-1 py-4 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleEmailReceipt(emailPromptRecord, manualEmail)}
                    disabled={emailingId === emailPromptRecord.receipt_id || !manualEmail.includes('@')}
                    className="flex-1 hero-btn-primary py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emailingId === emailPromptRecord.receipt_id ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <Mail size={18} /> Send Receipt
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

export default FinancialSystem;
