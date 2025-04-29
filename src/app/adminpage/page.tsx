"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image' 
import { supabase } from './supbase'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

type User = { id: string; username: string; role: string }
type Report = { id: string; useriud: string; type_of_record: string; period_covered: string; no_of_pages: number; role: string; created_at: string }

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [viewReport, setViewReport] = useState<Report | null>(null)
  const [yearlyReports, setYearlyReports] = useState<Report[]>([])
  const [showYearlyModal, setShowYearlyModal] = useState(false)
  const [isReportGenerated, setIsReportGenerated] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>('') // e.g., "01" for January
  const [selectedYear, setSelectedYear] = useState<string>('') // e.g., "2025"

  useEffect(() => {
    const stored = localStorage.getItem('scanflow360_user')
    if (!stored) return router.replace('/login')
    const parsedUser = JSON.parse(stored)
    setUser(parsedUser)
    if (parsedUser.role !== 'ADMIN') {
      alert('Access denied: Admins only')
      router.replace('/')
    }
  }, [router])

  useEffect(() => {
    if (user && user.role === 'ADMIN') fetchReports()
  }, [user])

  async function fetchReports() {
    const { data, error } = await supabase
      .from('monthly_reports1')
      .select('id, useriud, type_of_record, period_covered, no_of_pages, created_at, users2(role)')

    if (error) {
      alert('Error fetching reports: ' + error.message)
      return
    }

    console.log("Raw data from Supabase (monthly):", data)

    const formattedReports = data?.map((report: any) => {
      const role = report.users2?.role || 'Unknown'
      if (role === 'Unknown') {
        console.log(`No role found for useriud: ${report.useriud}`)
      }
      return {
        id: report.id,
        useriud: report.useriud,
        type_of_record: report.type_of_record,
        period_covered: report.period_covered,
        no_of_pages: report.no_of_pages,
        created_at: report.created_at,
        role: role,
      }
    }) || []

    console.log("All reports:", formattedReports)
    setReports(formattedReports)
  }

  async function fetchYearlyReports() {
    const { data, error } = await supabase
      .from('monthly_reports1')
      .select('id, useriud, type_of_record, period_covered, no_of_pages, created_at, users2(role)')

    if (error) {
      alert('Error fetching yearly reports: ' + error.message)
      return
    }

    const formattedReports = data?.map((report: any) => ({
      id: report.id,
      useriud: report.useriud,
      type_of_record: report.type_of_record,
      period_covered: report.period_covered,
      no_of_pages: report.no_of_pages,
      created_at: report.created_at,
      role: report.users2?.role || 'Unknown',
    })) || []

    setYearlyReports(formattedReports)
    setShowYearlyModal(true)
    setIsReportGenerated(true)
  }

  async function deleteOldReports() {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const { error } = await supabase
      .from('monthly_reports1')
      .delete()
      .lt('created_at', oneYearAgo.toISOString())

    if (error) {
      console.error('Error deleting old reports:', error)
      alert('Failed to delete old reports: ' + error.message)
      return
    }

    alert('Records older than 1 year have been deleted successfully!')
    await fetchReports()
    if (showYearlyModal) {
      await fetchYearlyReports()
    }
  }

  function logout() {
    localStorage.removeItem('scanflow360_user')
    router.replace('/')
  }

  function applyStyles(worksheet: XLSX.WorkSheet, startRow: number, endRow: number, numCols: number, isHeader: boolean = false, centerText: boolean = false) {
    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < numCols; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
        if (!worksheet[cellRef]) continue
        worksheet[cellRef].s = {
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          },
          alignment: { 
            horizontal: centerText ? 'center' : 'left', 
            vertical: 'center' 
          },
          font: isHeader ? { bold: true } : undefined,
        }
      }
    }
  }

  function downloadYearlyReport() {
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([])

    // Title and Header (spanning columns B and C)
    XLSX.utils.sheet_add_aoa(worksheet, [["Civil Service Commission Regional Office VI"]], { origin: "B1" })
    XLSX.utils.sheet_add_aoa(worksheet, [["DIGITIZATION OF RECORDS"]], { origin: "B2" })
    XLSX.utils.sheet_add_aoa(worksheet, [["For the All-Time Period"]], { origin: "B3" })
    XLSX.utils.sheet_add_aoa(worksheet, [["Target: 100% of Identified Records"]], { origin: "B4" })

    // Merge cells for headers (B1:C1, B2:C2, etc.)
    worksheet['!merges'] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    ]

    // Apply centered styling to headers
    applyStyles(worksheet, 0, 3, 4, true, true)

    let currentRow: number = 6
    let totalPagesOverall: number = 0

    const tableHeader: string[] = ["No.", "Type of Record", "Period Covered", "No. of Pages"]
    XLSX.utils.sheet_add_aoa(worksheet, [tableHeader], { origin: "A" + currentRow })
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true)

    currentRow++

    let reportIndex: number = 1
    const allReports = yearlyReports.filter(r => ['MSD', 'ESD', 'LSD'].includes(r.role.toUpperCase()))

    allReports.forEach((report) => {
      const periods = report.period_covered ? report.period_covered.split(',').map(p => p.trim()) : ['']
      const noOfPages = report.no_of_pages !== null && report.no_of_pages !== undefined ? report.no_of_pages : 'N/A'

      if (periods.length > 1) {
        // Main record row
        const mainRow = [reportIndex++, report.type_of_record, "", ""]
        XLSX.utils.sheet_add_aoa(worksheet, [mainRow], { origin: "A" + currentRow })
        currentRow++

        // Sub-rows for each period
        periods.forEach((period, idx) => {
          const pages = idx === 0 ? noOfPages : ""
          const subRow = ["", "", period, pages]
          XLSX.utils.sheet_add_aoa(worksheet, [subRow], { origin: "A" + currentRow })
          currentRow++
        })
      } else {
        // Single period record
        const singleRow = [reportIndex++, report.type_of_record, periods[0], noOfPages]
        XLSX.utils.sheet_add_aoa(worksheet, [singleRow], { origin: "A" + currentRow })
        currentRow++
      }

      if (noOfPages !== 'N/A') {
        totalPagesOverall += Number(noOfPages) || 0
      }
    })

    applyStyles(worksheet, 6, currentRow - 1, tableHeader.length)

    const totalRow = ["", "TOTAL NO. OF PAGES", "", totalPagesOverall]
    XLSX.utils.sheet_add_aoa(worksheet, [totalRow], { origin: "A" + currentRow })
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true)
    currentRow += 2

    // Footer (Consolidated by, Noted by)
    XLSX.utils.sheet_add_aoa(worksheet, [["Consolidated by:"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["MARIA THERESA J. AGUIRRE"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["Chief HRS, PALD"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["Digitization Project Head"]], { origin: "A" + currentRow })
    currentRow += 2
    XLSX.utils.sheet_add_aoa(worksheet, [["Noted by:"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["ATTY. ERNA T. ELIZAN"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["Director III"]], { origin: "A" + currentRow })

    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 50 },
      { wch: 30 },
      { wch: 15 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "All Time Report")
    XLSX.writeFile(workbook, "All_Time_Report.xlsx")
  }

  function downloadMonthlyReport() {
    if (!selectedMonth || !selectedYear) {
      alert('Please select both a month and a year to download the report.')
      return
    }

    const year = selectedYear
    const month = selectedMonth
    const monthName = new Date(`${year}-${month}-01`).toLocaleString('default', { month: 'long' })
    const filteredReports = reports.filter(r => {
      const reportDate = new Date(r.created_at)
      return reportDate.getFullYear() === parseInt(year) && (reportDate.getMonth() + 1) === parseInt(month)
    })

    // Check if there are no reports for the selected month and year
    if (filteredReports.length === 0) {
      alert(`No reports exist for ${monthName} ${year}.`)
      return
    }

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([])

    // Title and Header (spanning columns B and C)
    XLSX.utils.sheet_add_aoa(worksheet, [["Civil Service Commission Regional Office VI"]], { origin: "B1" })
    XLSX.utils.sheet_add_aoa(worksheet, [["DIGITIZATION OF RECORDS"]], { origin: "B2" })
    XLSX.utils.sheet_add_aoa(worksheet, [["For the month of " + monthName + " " + year]], { origin: "B3" })
    XLSX.utils.sheet_add_aoa(worksheet, [["Target: 100% of Identified Records"]], { origin: "B4" })

    // Merge cells for headers (B1:C1, B2:C2, etc.)
    worksheet['!merges'] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    ]

    // Apply centered styling to headers
    applyStyles(worksheet, 0, 3, 4, true, true)

    let currentRow: number = 6
    const tableHeader: string[] = ["No.", "Type of Record", "Period Covered", "No. of Pages"]
    XLSX.utils.sheet_add_aoa(worksheet, [tableHeader], { origin: "A" + currentRow })
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true)

    currentRow++

    let reportIndex: number = 1
    let totalPages: number = 0

    filteredReports.forEach((report) => {
      const periods = report.period_covered ? report.period_covered.split(',').map(p => p.trim()) : ['']
      const noOfPages = report.no_of_pages !== null && report.no_of_pages !== undefined ? report.no_of_pages : 'N/A'

      if (periods.length > 1) {
        // Main record row
        const mainRow = [reportIndex++, report.type_of_record, "", ""]
        XLSX.utils.sheet_add_aoa(worksheet, [mainRow], { origin: "A" + currentRow })
        currentRow++

        // Sub-rows for each period
        periods.forEach((period, idx) => {
          const pages = idx === 0 ? noOfPages : ""
          const subRow = ["", "", period, pages]
          XLSX.utils.sheet_add_aoa(worksheet, [subRow], { origin: "A" + currentRow })
          currentRow++
        })
      } else {
        // Single period record
        const singleRow = [reportIndex++, report.type_of_record, periods[0], noOfPages]
        XLSX.utils.sheet_add_aoa(worksheet, [singleRow], { origin: "A" + currentRow })
        currentRow++
      }

      if (noOfPages !== 'N/A') {
        totalPages += Number(noOfPages) || 0
      }
    })

    applyStyles(worksheet, 6, currentRow - 1, tableHeader.length)

    const totalRow = ["", "TOTAL NO. OF PAGES", "", totalPages]
    XLSX.utils.sheet_add_aoa(worksheet, [totalRow], { origin: "A" + currentRow })
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true)
    currentRow += 2

    // Footer
    XLSX.utils.sheet_add_aoa(worksheet, [["Consolidated by:"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [[""]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["MARIA THERESA J. AGUIRRE"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["Chief HRS, PALD"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["Digitization Project Head"]], { origin: "A" + currentRow })
    currentRow += 2
    XLSX.utils.sheet_add_aoa(worksheet, [["Noted by:"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["ATTY. ERNA T. ELIZAN"]], { origin: "A" + currentRow })
    currentRow++
    XLSX.utils.sheet_add_aoa(worksheet, [["Director III"]], { origin: "A" + currentRow })

    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 50 },
      { wch: 30 },
      { wch: 15 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, monthName + "_" + year + "_Report")
    XLSX.writeFile(workbook, monthName + "_" + year + "_Report.xlsx")
  }

  const msdReports = reports.filter(r => r.role.toUpperCase() === 'MSD')
  const esdReports = reports.filter(r => r.role.toUpperCase() === 'ESD')
  const lsdReports = reports.filter(r => r.role.toUpperCase() === 'LSD')

  const chartData = {
    labels: ['ESD', 'LSD', 'MSD'],
    datasets: [
      {
        label: 'Total Pages (All Time)',
        data: [
          yearlyReports.filter(r => r.role.toUpperCase() === 'ESD').reduce((sum, r) => sum + r.no_of_pages, 0),
          yearlyReports.filter(r => r.role.toUpperCase() === 'LSD').reduce((sum, r) => sum + r.no_of_pages, 0),
          yearlyReports.filter(r => r.role.toUpperCase() === 'MSD').reduce((sum, r) => sum + r.no_of_pages, 0),
        ],
        backgroundColor: ['#003087', '#C1272D', '#FFD700'],
        borderColor: ['#002060', '#a12025', '#e6c200'],
        borderWidth: 1,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Total Pages per Department (All Time)',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Pages',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Department',
        },
      },
    },
  }

  // Generate years from 2020 to 2030 for the dropdown
  const years = Array.from({ length: 11 }, (_, i) => (2020 + i).toString())

  // Array of months for dropdown
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]

  return (
    <div className="min-h-screen bg-[#F5F6F5] p-4">
      <div className="w-full max-w-5xl mx-auto bg-white rounded-lg shadow-lg p-6 mt-12">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="Website Logo"
              width={150}
              height={50}
              priority
              className="mr-4"
            />
            <div>
              <h1 className="text-2xl font-bold text-[#003087] font-['Poppins']">
                Admin Dashboard
              </h1>
              {user && (
                <p className="text-sm text-gray-600">
                  Role: <span className="font-medium text-[#003087]">{user.role}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="text-[#C1272D] hover:text-[#a12025] font-medium transition-colors"
          >
            Logout
          </button>
        </header>

        {['MSD', 'ESD', 'LSD'].map((role) => {
          const roleReports = role === 'MSD' ? msdReports : role === 'ESD' ? esdReports : lsdReports
          const totalPages = roleReports.reduce((sum, r) => sum + r.no_of_pages, 0)

          return (
            <div key={role} className="mb-8">
              <h2 className="text-xl font-semibold text-[#003087] mb-4 font-['Poppins']">
                {role} Reports
              </h2>
              {roleReports.length === 0 ? (
                <p className="text-gray-500">No reports submitted for {role}.</p>
              ) : (
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-[#003087] text-white sticky top-0">
                        <th className="p-2 text-left w-[50px]">No.</th>
                        <th className="p-2 text-left w-[200px]">Type of Record</th>
                        <th className="p-2 text-left w-[150px]">Period Covered</th>
                        <th className="p-2 text-left w-[100px]">No. of Pages</th>
                        <th className="p-2 text-left w-[100px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleReports.map((r, index) => (
                        <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                          <td className="p-2 truncate text-[#003087]" title={String(index + 1)}>{index + 1}</td>
                          <td className="p-2 truncate text-[#003087]" title={r.type_of_record}>{r.type_of_record}</td>
                          <td className="p-2 truncate text-[#003087]" title={r.period_covered}>{r.period_covered}</td>
                          <td className="p-2 truncate text-[#003087]" title={String(r.no_of_pages)}>{r.no_of_pages}</td>
                          <td className="p-2">
                            <button
                              onClick={() => setViewReport(r)}
                              className="text-[#003087] hover:text-[#002060] font-medium transition-colors"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td colSpan={3} className="p-2 text-right text-[#003087]">Total No. of Pages</td>
                        <td className="p-2 text-[#003087]">{totalPages}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[#003087] mb-4 font-['Poppins']">
            Yearly Summary
          </h2>
          <div className="flex flex-col space-y-4">
            <div className="flex space-x-4">
              <button
                onClick={fetchYearlyReports}
                className="py-2 px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors mb-4 font-medium"
              >
                View Summary
              </button>
              <button
                onClick={isReportGenerated ? downloadYearlyReport : fetchYearlyReports}
                className={
                  "py-2 px-4 font-medium text-white rounded transition-colors mb-4 " +
                  (isReportGenerated ? 'bg-[#C1272D] hover:bg-[#a12025]' : 'bg-[#003087] hover:bg-[#002060]')
                }
              >
                {isReportGenerated ? 'Download All-Time Report' : 'Generate Report'}
              </button>
              <button
                onClick={deleteOldReports}
                className="py-2 px-4 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium mb-4"
              >
                Delete Records
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <label className="text-[#003087] font-medium">Download Monthly Report:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded p-2"
              >
                <option value="" disabled>Select Month</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border border-gray-300 rounded p-2"
              >
                <option value="" disabled>Select Year</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <button
                onClick={downloadMonthlyReport}
                className="py-2 px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium"
              >
                Download
              </button>
            </div>
          </div>
        </div>

        {viewReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold text-[#003087] mb-4 font-['Poppins']">
                Report Details
              </h2>
              <p className="text-gray-700">
                <span className="font-medium text-[#003087]">Type of Record:</span> {viewReport?.type_of_record}
              </p>
              <p className="text-gray-700">
                <span className="font-medium text-[#003087]">Period Covered:</span> {viewReport?.period_covered}
              </p>
              <p className="text-gray-700">
                <span className="font-medium text-[#003087]">Number of Pages:</span> {viewReport?.no_of_pages}
              </p>
              <p className="text-gray-700">
                <span className="font-medium text-[#003087]">Role:</span> {viewReport?.role}
              </p>
              <button
                onClick={() => setViewReport(null)}
                className="mt-4 w-full py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showYearlyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl w-full">
              <h2 className="text-xl font-bold text-[#003087] mb-4 font-['Poppins']">
                All Time Summary
              </h2>

              <div className="mb-6">
                <Bar data={chartData} options={chartOptions} />
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full border-collapse table-fixed">
                  <thead>
                    <tr className="bg-[#003087] text-white sticky top-0">
                      <th className="p-2 text-left w-[50px]">No.</th>
                      <th className="p-2 text-left w-[200px]">Type of Record</th>
                      <th className="p-2 text-left w-[150px]">Period Covered</th>
                      <th className="p-2 text-left w-[100px]">No. of Pages</th>
                      <th className="p-2 text-left w-[100px]">Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyReports
                      .filter(r => ['MSD', 'ESD', 'LSD'].includes(r.role.toUpperCase()))
                      .map((r, index) => (
                        <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                          <td className="p-2 truncate" title={String(index + 1)}>{index + 1}</td>
                          <td className="p-2 truncate" title={r.type_of_record}>{r.type_of_record}</td>
                          <td className="p-2 truncate" title={r.period_covered}>{r.period_covered}</td>
                          <td className="p-2 truncate" title={String(r.no_of_pages)}>{r.no_of_pages}</td>
                          <td className="p-2 truncate" title={r.role}>{r.role}</td>
                        </tr>
                      ))}
                    <tr className="font-bold">
                      <td colSpan={3} className="p-2 text-right text-[#003087]">Total No. of Pages</td>
                      <td className="p-2 text-[#003087]">
                        {yearlyReports
                          .filter(r => ['MSD', 'ESD', 'LSD'].includes(r.role.toUpperCase()))
                          .reduce((sum, r) => sum + r.no_of_pages, 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => setShowYearlyModal(false)}
                className="mt-4 w-full py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
