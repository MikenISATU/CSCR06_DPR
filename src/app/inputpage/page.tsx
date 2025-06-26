'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from './supbase';
import * as XLSX from 'xlsx';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import toast, { Toaster } from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type User = { id: string; username: string; role: string };
type Report = { id: string; type_of_record: string; period_covered: string; no_of_pages: number; created_at?: string };
type Category = { id: number; role: string; category: string };

export default function InputPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [typeOfRecord, setTypeOfRecord] = useState('');
  const [customType, setCustomType] = useState('');
  const [periodCovered, setPeriodCovered] = useState('');
  const [noOfPages, setNoOfPages] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [editReport, setEditReport] = useState<Report | null>(null);
  const [showMonthlySummary, setShowMonthlySummary] = useState(false);
  const [showYearlySummary, setShowYearlySummary] = useState(false);
  const [showSemestralSummary, setShowSemestralSummary] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const currentDate = new Date('2025-06-25T09:55:00-07:00'); // Set to 09:55 AM PST, June 25, 2025
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  useEffect(() => {
    const stored = localStorage.getItem('scanflow360_user');
    if (!stored) {
      router.replace('/');
      return;
    }
    const parsedUser = JSON.parse(stored);
    setUser(parsedUser);
    if (parsedUser && parsedUser.role !== 'ADMIN') {
      fetchCategories(parsedUser.role);
    } else {
      router.replace('/');
      toast.error('Access denied: Non-admin users only', { duration: 3000 });
    }
  }, [router]);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      fetchCategories(user.role);
      fetchReports();
      // Real-time subscription
      const reportsSubscription = supabase
        .channel('custom-all-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_reports1' }, () => fetchReports())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'record_categories' }, () => fetchCategories(user.role))
        .subscribe();
      return () => {
        supabase.removeChannel(reportsSubscription);
      };
    }
  }, [user]);

  async function fetchCategories(role: string) {
    const toastId = toast.loading('Fetching categories...', { duration: 3000 });
    try {
      const { data, error } = await supabase
        .from('record_categories')
        .select('category')
        .eq('role', role.toUpperCase());

      if (error) throw error;
      const categoryList = data?.map((item: { category: string }) => item.category) || [];
      setCategories([...categoryList, 'Other']);
      toast.success('Categories loaded successfully', { id: toastId, duration: 3000 });
    } catch (error) {
      const errorMsg = (error instanceof Error) ? error.message : String(error);
      toast.error(`Error fetching categories: ${errorMsg}`, { id: toastId, duration: 3000 });
    }
  }

  async function fetchReports() {
    if (!user) return;
    const toastId = toast.loading('Fetching reports...', { duration: 3000 });
    try {
      const { data, error } = await supabase
        .from('monthly_reports1')
        .select('id, type_of_record, period_covered, no_of_pages, created_at')
        .eq('useriud', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports(data || []);
      toast.success('Reports loaded successfully', { id: toastId, duration: 3000 });
    } catch (error) {
      const errorMsg = (error instanceof Error) ? error.message : String(error);
      toast.error(`Error fetching reports: ${errorMsg}`, { id: toastId, duration: 3000 });
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!typeOfRecord) return toast.error('Select a type of record', { duration: 3000 });
    if (!periodCovered) return toast.error('Enter period covered', { duration: 3000 });
    if (typeOfRecord === 'Other' && !customType) return toast.error('Enter a custom type of record', { duration: 3000 });

    const finalType = typeOfRecord === 'Other' ? customType : typeOfRecord;
    const toastId = toast.loading('Saving report...', { duration: 3000 });
    try {
      const { error } = await supabase.from('monthly_reports1').upsert({
        useriud: user!.id,
        type_of_record: finalType,
        period_covered: periodCovered,
        no_of_pages: noOfPages,
      });
      if (error) throw error;
      toast.success('Report saved successfully', { id: toastId, duration: 3000 });
      setTypeOfRecord('');
      setCustomType('');
      setPeriodCovered('');
      setNoOfPages(0);
      fetchReports();
    } catch (error) {
      const errorMsg = (error instanceof Error) ? error.message : String(error);
      toast.error(`Error saving report: ${errorMsg}`, { id: toastId, duration: 3000 });
    }
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editReport) return;
    if (!editReport.type_of_record) return toast.error('Select a type of record', { duration: 3000 });
    if (!editReport.period_covered) return toast.error('Enter period covered', { duration: 3000 });
    if (editReport.type_of_record === 'Other' && !customType) return toast.error('Enter a custom type of record', { duration: 3000 });

    const finalType = editReport.type_of_record === 'Other' ? customType : editReport.type_of_record;
    const toastId = toast.loading('Updating report...', { duration: 3000 });
    try {
      const { error } = await supabase.from('monthly_reports1').update({
        type_of_record: finalType,
        period_covered: editReport.period_covered,
        no_of_pages: editReport.no_of_pages,
      }).eq('id', editReport.id);
      if (error) throw error;
      toast.success('Report updated successfully', { id: toastId, duration: 3000 });
      setEditReport(null);
      setCustomType('');
      fetchReports();
    } catch (error) {
      const errorMsg = (error instanceof Error) ? error.message : String(error);
      toast.error(`Error updating report: ${errorMsg}`, { id: toastId, duration: 3000 });
    }
  }

  async function handleDelete(id: string) {
    const toastId = toast.loading('Deleting report...', { duration: 3000 });
    try {
      const { error } = await supabase.from('monthly_reports1').delete().eq('id', id);
      if (error) throw error;
      toast.success('Report deleted successfully', { id: toastId, duration: 3000 });
      fetchReports();
      setShowDeleteModal(false);
      setReportToDelete(null);
    } catch (error) {
      const errorMsg = (error instanceof Error) ? error.message : String(error);
      toast.error(`Error deleting report: ${errorMsg}`, { id: toastId, duration: 3000 });
    }
  }

  function logout() {
    const toastId = toast.loading('Logging out...', { duration: 3000 });
    localStorage.removeItem('scanflow360_user');
    router.replace('/');
    toast.success('Logged out successfully', { id: toastId, duration: 3000 });
  }

  function truncateRecordName(name: string, maxLength: number = 12): string {
    return name.length <= maxLength ? name : `${name.substring(0, maxLength - 3)}...`;
  }

  function applyStyles(
    worksheet: XLSX.WorkSheet,
    startRow: number,
    endRow: number,
    numCols: number,
    isHeader: boolean = false,
    centerText: boolean = false
  ) {
    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < numCols; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellRef]) continue;
        worksheet[cellRef].s = {
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          },
          alignment: {
            horizontal: centerText ? 'center' : 'left',
            vertical: 'center',
            wrapText: true,
          },
          font: isHeader ? { bold: true } : undefined,
        };
      }
    }
  }

  function generateReport(periodType: 'monthly' | 'semestral' | 'yearly') {
    let reportTitle: string;
    let filteredReports: Report[];
    let periodName: string;
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    if (periodType === 'monthly') {
      reportTitle = `the month of ${monthName} ${currentYear}`;
      periodName = `${monthName}_${currentYear}`;
      filteredReports = reports.filter((report) => {
        if (!report.created_at) return false;
        const reportDate = new Date(report.created_at);
        return reportDate.getMonth() + 1 === currentMonth && reportDate.getFullYear() === currentYear;
      });
    } else if (periodType === 'semestral') {
      const semester = parseInt(selectedMonth) <= 6 ? 'First' : 'Second';
      reportTitle = `${semester} Semester ${selectedYear}`;
      periodName = `${semester}_Semester_${selectedYear}`;
      filteredReports = reports.filter((report) => {
        if (!report.created_at) return false;
        const reportDate = new Date(report.created_at);
        return (
          reportDate.getFullYear() === parseInt(selectedYear) &&
          ((semester === 'First' && reportDate.getMonth() + 1 <= 6) || (semester === 'Second' && reportDate.getMonth() + 1 > 6))
        );
      });
    } else {
      reportTitle = `for the Year ${selectedYear}`;
      periodName = `Year_${selectedYear}`;
      filteredReports = reports.filter((report) => {
        if (!report.created_at) return false;
        const reportDate = new Date(report.created_at);
        return reportDate.getFullYear() === parseInt(selectedYear);
      });
    }

    if (filteredReports.length === 0) {
      toast.error(`No reports found for ${reportTitle}`, { duration: 3000 });
      return;
    }

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.sheet_add_aoa(worksheet, [[user?.role.toUpperCase()]], { origin: 'B1' });
    XLSX.utils.sheet_add_aoa(worksheet, [[reportTitle]], { origin: 'B2' });

    worksheet['!merges'] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
    ];

    applyStyles(worksheet, 0, 1, 4, true, true);

    let currentRow: number = 4;
    const tableHeader: string[] = ['No.', 'Type of Record', 'Period Covered', 'No. of Pages'];
    XLSX.utils.sheet_add_aoa(worksheet, [tableHeader], { origin: 'A' + currentRow });
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true);

    currentRow++;

    let reportIndex: number = 1;
    let totalPages: number = 0;

    filteredReports.forEach((report) => {
      const row = [reportIndex++, report.type_of_record, report.period_covered, report.no_of_pages];
      totalPages += report.no_of_pages;
      XLSX.utils.sheet_add_aoa(worksheet, [row], { origin: 'A' + currentRow });
      currentRow++;
    });

    applyStyles(worksheet, 4, currentRow - 1, tableHeader.length);

    const totalRow = ['', 'TOTAL NO. OF PAGES', '', totalPages];
    XLSX.utils.sheet_add_aoa(worksheet, [totalRow], { origin: 'A' + currentRow });
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true);

    worksheet['!cols'] = [{ wch: 5 }, { wch: 50 }, { wch: 30 }, { wch: 15 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${periodName}_Report`);
    XLSX.writeFile(workbook, `${periodName}_Report.xlsx`);
    toast.success(`Report generated: ${periodName}`, { duration: 3000 });
  }

  function viewMonthlySummary() {
    setShowMonthlySummary(true);
    setShowYearlySummary(false);
    setShowSemestralSummary(false);
  }

  function viewYearlySummary() {
    setShowYearlySummary(true);
    setShowMonthlySummary(false);
    setShowSemestralSummary(false);
  }

  function viewSemestralSummary() {
    setShowSemestralSummary(true);
    setShowMonthlySummary(false);
    setShowYearlySummary(false);
  }

  const currentMonthReports = reports.filter((report) => {
    if (!report.created_at) return false;
    const reportDate = new Date(report.created_at);
    return reportDate.getMonth() + 1 === currentMonth && reportDate.getFullYear() === currentYear;
  });

  const filteredReportsMonth = reports.filter((report) => {
    if (!report.created_at) return false;
    const reportDate = new Date(report.created_at);
    return (
      reportDate.getMonth() + 1 === parseInt(selectedMonth) &&
      reportDate.getFullYear() === parseInt(selectedYear)
    );
  });

  const yearlyReports = reports.filter((report) => {
    if (!report.created_at) return false;
    const reportDate = new Date(report.created_at);
    return reportDate.getFullYear() === parseInt(selectedYear);
  });

  const semestralReports = reports.filter((report) => {
    if (!report.created_at) return false;
    const reportDate = new Date(report.created_at);
    const semester = parseInt(selectedMonth) <= 6 ? 'First' : 'Second';
    return (
      reportDate.getFullYear() === parseInt(selectedYear) &&
      ((semester === 'First' && reportDate.getMonth() + 1 <= 6) || (semester === 'Second' && reportDate.getMonth() + 1 > 6))
    );
  });

  const dailyGroupedReports = currentMonthReports.reduce((acc, report) => {
    if (!report.created_at) return acc;
    const reportDate = new Date(report.created_at);
    const dateKey = reportDate.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = {};
    if (!acc[dateKey][report.type_of_record]) acc[dateKey][report.type_of_record] = 0;
    acc[dateKey][report.type_of_record] += report.no_of_pages;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  const chartData = (reportsData: Report[]) => {
    if (reportsData === currentMonthReports) {
      const dates = Object.keys(dailyGroupedReports).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateA.getTime() - dateB.getTime();
      });
      const types = [...new Set(currentMonthReports.map((r) => r.type_of_record))];
      const currentDateStr = currentDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      });
      const updatedLabels = dates.length > 0 ? dates : [currentDateStr];
      return {
        labels: updatedLabels,
        datasets: types.map((type, index) => ({
          label: type,
          data: updatedLabels.map((date) => dailyGroupedReports[date] ? dailyGroupedReports[date][type] || 0 : 0),
          backgroundColor: [
            '#003087', '#0087DC', '#C8102E', '#B39C6F', '#4B5EAA', '#A6192E', '#D4A017', '#6A7281', '#005670',
            '#E57373', '#90CAF9', '#FBC02D', '#3F51B5', '#D81B60', '#81C784',
          ][index % 15],
          stack: 'Stack',
        })),
      };
    }
    return {
      labels: [...new Set(reportsData.map((r) => r.type_of_record))],
      datasets: [
        {
          label: `Total Pages`,
          data: [...new Set(reportsData.map((r) => r.type_of_record))].map((type) =>
            reportsData.filter((r) => r.type_of_record === type).reduce((sum, r) => sum + r.no_of_pages, 0)
          ),
          backgroundColor: '#003087',
          borderColor: '#002060',
          borderWidth: 1,
        },
      ],
    };
  };

  const chartOptions = (reportsData: Report[]) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: reportsData === currentMonthReports
          ? `Daily Pages per Record Type (${monthName} ${currentYear})`
          : `Total Pages per Record Type (${showMonthlySummary ? `${months[parseInt(selectedMonth) - 1].label} ${selectedYear}` : showSemestralSummary ? `Semester ${selectedYear}` : `Year ${selectedYear}`})`,
        font: { size: 12 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Number of Pages', font: { size: 10 } },
        stacked: reportsData === currentMonthReports,
      },
      x: {
        title: {
          display: true,
          text: reportsData === currentMonthReports ? 'Date' : 'Type of Record',
          font: { size: 10 },
        },
        ticks: {
          font: { size: 8 },
          callback: function (value: string | number) {
            const label = String(value);
            return label.length > 10 ? label.substring(0, 7) + '...' : label;
          },
        },
        stacked: reportsData === currentMonthReports,
      },
    },
  });

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const years = ['2025', '2026', '2027', '2028', '2029', '2030'];

  const filteredSubmittedReports = reports.filter((report) =>
    report.type_of_record.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.period_covered.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F5F6F5] flex items-center justify-center p-2 sm:p-4 md:p-6">
      <Toaster position="top-right" />
      <div className="w-full max-w-6xl bg-white rounded-lg shadow-lg p-2 sm:p-4 md:p-6">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <Image
              src="/logo.png"
              alt="Website Logo"
              width={100}
              height={40}
              priority
              className="w-20 sm:w-24 md:w-32"
            />
            <div className="text-center sm:text-left">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-[#003087] font-['Poppins']">
                Monthly Reports Dashboard
              </h1>
              {user && (
                <p className="text-xs sm:text-sm text-gray-600">
                  Division: <span className="font-medium text-[#003087]">{user.role}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex space-x-2 sm:space-x-3">
            <a
              href="https://drive.google.com/file/d/YOUR_GDRIVE_PUBLIC_LINK/view"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#003087] hover:text-[#002060] font-medium transition-colors text-xs sm:text-sm"
            >
              User Manual
            </a>
            <button
              onClick={logout}
              className="text-[#C1272D] hover:text-[#a12025] font-medium transition-colors text-xs sm:text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {!showMonthlySummary && !showYearlySummary && !showSemestralSummary && !viewReport && !editReport && (
          <>
            <div className="mb-6">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#003087] mb-3 sm:mb-4">
                Current Month Reports ({monthName} {currentYear})
              </h2>
              <div className="h-40 sm:h-48 md:h-64">
                <Bar data={chartData(currentMonthReports)} options={chartOptions(currentMonthReports)} />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              <div>
                <label className="block mb-1 text-xs sm:text-sm font-medium text-[#003087]">
                  Type of Record
                </label>
                <select
                  value={typeOfRecord}
                  onChange={(e) => {
                    setTypeOfRecord(e.target.value);
                    if (e.target.value !== 'Other') setCustomType('');
                  }}
                  className="w-full p-1 sm:p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] placeholder-gray-500 text-xs sm:text-sm truncate"
                  required
                >
                  <option value="" disabled className="text-gray-500">Select Type of Record</option>
                  {categories.map((category, index) => (
                    <option key={index} value={category} className="text-[#003087] truncate">
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {typeOfRecord === 'Other' && (
                <div>
                  <label className="block mb-1 text-xs sm:text-sm font-medium text-[#003087]">
                    Custom Type of Record
                  </label>
                  <input
                    type="text"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    className="w-full p-1 sm:p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500 text-xs sm:text-sm"
                    placeholder="Enter custom record type"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block mb-1 text-xs sm:text-sm font-medium text-[#003087]">
                  Period Covered
                </label>
                <input
                  type="text"
                  value={periodCovered}
                  onChange={(e) => setPeriodCovered(e.target.value)}
                  className="w-full p-1 sm:p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500 text-xs sm:text-sm"
                  placeholder="Enter period covered (e.g., Jan-Jun 2025)"
                  required
                />
              </div>
              <div>
                <label className="block mb-1 text-xs sm:text-sm font-medium text-[#003087]">
                  Number of Pages
                </label>
                <input
                  type="number"
                  value={noOfPages}
                  onChange={(e) => setNoOfPages(Number(e.target.value))}
                  className="w-full p-1 sm:p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500 text-xs sm:text-sm"
                  min={0}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
              >
                Save Report
              </button>
            </form>
          </>
        )}

        {!showMonthlySummary && !showYearlySummary && !showSemestralSummary && !viewReport && !editReport && (
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
            <button
              onClick={viewMonthlySummary}
              className="w-full sm:w-auto flex-1 py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
            >
              View Monthly Summary
            </button>
            <button
              onClick={viewSemestralSummary}
              className="w-full sm:w-auto flex-1 py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
            >
              View Semestral Summary
            </button>
            <button
              onClick={viewYearlySummary}
              className="w-full sm:w-auto flex-1 py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
            >
              View Yearly Summary
            </button>
            <button
              onClick={() => generateReport('monthly')}
              className="w-full sm:w-auto flex-1 py-1 sm:py-2 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
            >
              Download Monthly Report
            </button>
            <button
              onClick={() => generateReport('semestral')}
              className="w-full sm:w-auto flex-1 py-1 sm:py-2 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
            >
              Download Semestral Report
            </button>
            <button
              onClick={() => generateReport('yearly')}
              className="w-full sm:w-auto flex-1 py-1 sm:py-2 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
            >
              Download Yearly Report
            </button>
          </div>
        )}

        {!showMonthlySummary && !showYearlySummary && !showSemestralSummary && !viewReport && !editReport && (
          <div className="mt-6">
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#003087] mb-3 sm:mb-4">Submitted Reports</h2>
            <div className="mb-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-1/2 p-1 sm:p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500 text-xs sm:text-sm"
                placeholder="Search by type or period"
              />
            </div>
            <div className="relative max-h-60 overflow-y-auto">
              <table className="w-full border-collapse table-auto text-xs">
                <thead>
                  <tr className="bg-[#003087] text-white sticky top-0 z-10">
                    <th className="p-1 text-left w-24 sm:w-32">Type of Record</th>
                    <th className="p-1 text-left w-24 sm:w-28">Period Covered</th>
                    <th className="p-1 text-left w-16 sm:w-20">No. of Pages</th>
                    <th className="p-1 text-left w-20 sm:w-24">Submitted</th>
                    <th className="p-1 text-left w-24 sm:w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmittedReports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-1 text-center text-gray-500 text-xs sm:text-sm">
                        No reports found.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmittedReports.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                        <td className="p-1 truncate text-[#003087]" title={r.type_of_record}>
                          {truncateRecordName(r.type_of_record)}
                        </td>
                        <td className="p-1 truncate text-[#003087]" title={r.period_covered}>
                          {truncateRecordName(r.period_covered)}
                        </td>
                        <td className="p-1 truncate text-[#003087]" title={String(r.no_of_pages)}>
                          {r.no_of_pages}
                        </td>
                        <td className="p-1 truncate text-[#003087]" title={r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'}>
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="p-1">
                          <div className="flex space-x-2 sm:space-x-3">
                            <button
                              onClick={() => {
                                setReportToDelete(r.id);
                                setShowDeleteModal(true);
                              }}
                              className="text-[#C1272D] hover:text-[#a12025] font-medium transition-colors text-xs sm:text-sm"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setEditReport(r)}
                              className="text-[#003087] hover:text-[#002060] font-medium transition-colors text-xs sm:text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setViewReport(r)}
                              className="text-[#003087] hover:text-[#002060] font-medium transition-colors text-xs sm:text-sm"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-2 sm:p-3 md:p-4 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#003087] mb-2 sm:mb-3 font-['Poppins']">
                Report Details
              </h2>
              <p className="text-gray-700 text-xs sm:text-sm">
                <span className="font-medium text-[#003087]">Type of Record:</span>{' '}
                {viewReport?.type_of_record}
              </p>
              <p className="text-gray-700 text-xs sm:text-sm">
                <span className="font-medium text-[#003087]">Period Covered:</span>{' '}
                {viewReport?.period_covered}
              </p>
              <p className="text-gray-700 text-sm">
                <span className="font-medium text-[#003087]">Total Pages:</span>{' '}
                {viewReport?.no_of_pages}
              </p>
              <p className="text-gray-700 text-xs sm:text-sm">
                <span className="font-medium text-[#003087]">Submitted:</span>{' '}
                {viewReport.created_at ? new Date(viewReport.created_at).toLocaleDateString() : 'N/A'}
              </p>
              <button
                onClick={() => setViewReport(null)}
                className="mt-2 sm:mt-3 w-full py-1 sm:p-sm bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {editReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-2 sm:p-3 md:p-4 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#003087] mb-2 sm:mb-3 font-['Poppins']">
                Edit Report
              </h2>
              <form onSubmit={handleEditSubmit} className="space-y-2 sm:space-y-3">
                <div>
                  <label className="block mb-1 text-xs sm:text-sm font-medium text-[#003087]">
                    Type of Record
                  </label>
                  <select
                    value={editReport.type_of_record}
                    onChange={(e) => {
                      setEditReport({ ...editReport, type_of_record: e.target.value });
                      if (e.target.value !== 'Other') setCustomType('');
                    }}
                    className="w-full p-1 sm:p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] placeholder-gray-500 text-xs sm:text-sm truncate"
                    required
                  >
                    <option value="" disabled className="text-gray-500">
                      Select Type of Record
                    </option>
                    {categories.map((category, index) => (
                      <option key={index} value={category} className="text-[#003087] truncate">
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {editReport.type_of_record === 'Other' && (
                  <div>
                    <label className="block mb-1 text-xs sm:text-sm font-medium text-[#003087]">
                      Custom Type of Record
                    </label>
                    <input
                      type="text"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      className="w-full p-1 sm:p-2 border border-gray-300 rounded-md text-black placeholder-gray-500 text-xs sm:text-sm"
                      placeholder="Enter custom record type"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block mb-1 text-xs sm:text-sm font-medium text-[#003087]">
                    Period Covered
                  </label>
                  <input
                    type="text"
                    value={editReport.period_covered}
                    onChange={(e) => setEditReport({ ...editReport, period_covered: e.target.value })}
                    className="w-full p-1 sm:p-2 border border-gray-300 rounded-md text-black placeholder-gray-500 text-xs sm:text-sm"
                    placeholder="Enter period covered (e.g., Jan-Jun 2025)"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs sm:text-sm font-medium text-[#003087]">
                    Number of Pages
                  </label>
                  <input
                    type="number"
                    value={editReport.no_of_pages}
                    onChange={(e) => setEditReport({ ...editReport, no_of_pages: Number(e.target.value) })}
                    className="w-full p-1 sm:p-2 border border-gray-300 rounded-md text-black placeholder-gray-500 text-xs sm:text-sm"
                    min="0"
                    required
                  />
                </div>
                <div className="flex space-x-2 sm:space-x-3">
                  <button
                    type="submit"
                    className="flex-1 py-1 sm:p-2 bg-[#003087] text-white rounded-md hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditReport(null)}
                    className="flex-1 py-1 sm:p-2 bg-[#C1272D] text-white rounded-md hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {(showMonthlySummary || showYearlySummary || showSemestralSummary) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-2 sm:p-3 md:p-4 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#003087] font-['Poppins'] mb-2 sm:mb-3">
                {showMonthlySummary ? 'Monthly Summary' : showSemestralSummary ? 'Semestral Summary' : 'Yearly Summary'}
              </h2>
              {showMonthlySummary && (
                <div className="mb-2 sm:mb-3 flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full p-1 sm:p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#003087] text-xs sm:text-sm"
                  >
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full p-1 sm:p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#003087] text-xs sm:text-sm"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {showSemestralSummary && (
                <div className="mb-2 sm:mb-3 flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full p-1 sm:p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#003087] text-xs sm:text-sm"
                  >
                    <option value="6">First Semester (Jan-Jun)</option>
                    <option value="12">Second Semester (Jul-Dec)</option>
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full p-1 sm:p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#003087] text-xs sm:text-sm"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {showYearlySummary && (
                <div className="mb-2 sm:mb-3">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full p-1 sm:p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#003087] text-xs sm:text-sm"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-3 sm:mb-4 h-40 sm:h-48 md:h-64">
                <Bar
                  data={chartData(showMonthlySummary ? filteredReportsMonth : showSemestralSummary ? semestralReports : yearlyReports)}
                  options={chartOptions(showMonthlySummary ? filteredReportsMonth : showSemestralSummary ? semestralReports : yearlyReports)}
                />
              </div>
              <div className="relative max-h-60 overflow-y-auto">
                <table className="w-full border-collapse table-auto text-xs">
                  <thead>
                    <tr className="bg-[#003087] text-white sticky top-0 z-10">
                      <th className="p-1 text-left w-12">No.</th>
                      <th className="p-1 text-left w-24 sm:w-32">Type of Record</th>
                      <th className="p-1 text-left w-24 sm:w-28">Period Covered</th>
                      <th className="p-1 text-left w-16 sm:w-20">Total</th>
                      <th className="p-1 text-left w-20 sm:w-24">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showMonthlySummary ? filteredReportsMonth : showSemestralSummary ? semestralReports : yearlyReports).map(
                      (r, index) => (
                        <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                          <td className="p-1 truncate text-[#003087]" title={String(index + 1)}>
                            {index + 1}
                          </td>
                          <td className="p-1 truncate text-[#003087]" title={r.type_of_record}>
                            {truncateRecordName(r.type_of_record)}
                          </td>
                          <td className="p-1 truncate text-[#003087]" title={r.period_covered}>
                            {r.period_covered}
                          </td>
                          <td className="p-1 truncate text-[#003087]" title={String(r.no_of_pages)}>
                            {r.no_of_pages}
                          </td>
                          <td
                            className="p-1 truncate text-[#003087]"
                            title={r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'}
                          >
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      )
                    )}
                    <tr className="font-bold">
                      <td colSpan={3} className="p-1 text-right text-[#003087]">
                        Total No. of Pages
                      </td>
                      <td colSpan={2} className="p-1 text-[#003087]">
                        {(showMonthlySummary ? filteredReportsMonth : showSemestralSummary ? semestralReports : yearlyReports).reduce(
                          (sum, r) => sum + r.no_of_pages,
                          0
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => {
                  setShowMonthlySummary(false);
                  setShowYearlySummary(false);
                  setShowSemestralSummary(false);
                }}
                className="mt-2 sm:mt-3 w-full py-1 sm:p-2 bg-[#003087] text-white rounded-md hover:bg-[#002060] transition-colors font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50" style={{ zIndex: 1000 }}>
            <div className="bg-white p-2 sm:p-3 md:p-4 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#003087] mb-2 sm:mb-3 font-['Poppins']">
                Confirm Deletion
              </h2>
              <p className="text-gray-700 text-xs sm:text-sm mb-2 sm:mb-3">
                Are you sure you want to delete the report{' '}
                <span className="font-medium text-[#003087]" title={reports.find((r) => r.id === reportToDelete)?.type_of_record}>
                  {reports.find((r) => r.id === reportToDelete)?.type_of_record || ''}
                </span>? This action cannot be undone.
              </p>
              <div className="flex space-x-2 sm:space-x-3">
                <button
                  onClick={() => reportToDelete && handleDelete(reportToDelete)}
                  className="flex-1 py-1 sm:p-2 bg-[#C1272D] text-white rounded-md hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setReportToDelete(null);
                  }}
                  className="flex-1 py-1 sm:p-2 bg-[#003087] text-white rounded-md hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
