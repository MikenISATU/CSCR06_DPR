"use client"

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from './supbase'
import * as XLSX from 'xlsx'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

type User = { id: string; username: string; role: string }
type Report = { id: string; type_of_record: string; period_covered: string; no_of_pages: number; created_at?: string }
type Category = { id: number; role: string; category: string }

export default function InputPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [typeOfRecord, setTypeOfRecord] = useState('')
  const [customType, setCustomType] = useState('')
  const [periodCovered, setPeriodCovered] = useState('')
  const [noOfPages, setNoOfPages] = useState(0)
  const [reports, setReports] = useState<Report[]>([])
  const [viewReport, setViewReport] = useState<Report | null>(null)
  const [showMonthlySummary, setShowMonthlySummary] = useState(false)
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('scanflow360_user')
    if (!stored) {
      router.replace('/')
      return
    }
    const parsedUser = JSON.parse(stored)
    setUser(parsedUser)
    if (parsedUser) {
      fetchCategories(parsedUser.role)
    }
  }, [router])

  useEffect(() => {
    if (user) fetchReports()
  }, [user])

  async function fetchCategories(role: string) {
    const { data, error } = await supabase
      .from('record_categories')
      .select('category')
      .eq('role', role.toUpperCase())

    if (error) {
      alert('Error fetching categories: ' + error.message)
      return
    }

    const categoryList = data?.map((item: { category: string }) => item.category) || []
    setCategories([...categoryList, 'Other'])
  }

  async function fetchReports() {
    const { data, error } = await supabase
      .from('monthly_reports1')
      .select('id, type_of_record, period_covered, no_of_pages, created_at')
      .eq('useriud', user!.id)
      .order('created_at', { ascending: false })
    if (error) {
      alert('Error fetching reports: ' + error.message)
      return
    }
    setReports(data || [])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!typeOfRecord) return alert('Select a type of record')
    if (!periodCovered) return alert('Enter period covered')
    if (typeOfRecord === 'Other' && !customType) return alert('Enter a custom type of record')

    const finalType = typeOfRecord === 'Other' ? customType : typeOfRecord

    const { error } = await supabase.from('monthly_reports1').upsert({
      useriud: user!.id,
      type_of_record: finalType,
      period_covered: periodCovered,
      no_of_pages: noOfPages,
    })
    if (error) {
      alert('Error saving report: ' + error.message)
      return
    }
    setTypeOfRecord('')
    setCustomType('')
    setPeriodCovered('')
    setNoOfPages(0)
    fetchReports()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('monthly_reports1').delete().eq('id', id)
    if (error) {
      alert('Error deleting report: ' + error.message)
      return
    }
    fetchReports()
  }

  function logout() {
    localStorage.removeItem('scanflow360_user')
    router.replace('/')
  }

  function truncateRecordName(name: string, maxLength: number = 20): string {
    if (name.length <= maxLength) return name
    return `${name.substring(0, maxLength - 3)}...`
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

  function generateReport(periodType: 'monthly' | 'semestral' | 'yearly') {
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1
    const currentYear = currentDate.getFullYear()
    let reportTitle: string
    let filteredReports: Report[]
    let periodName: string

    if (periodType === 'monthly') {
      reportTitle = `For the month of ${currentDate.toLocaleString('default', { month: 'long' })} ${currentYear}`
      periodName = `${currentDate.toLocaleString('default', { month: 'long' })}_${currentYear}`
      filteredReports = reports.filter((report) => {
        if (!report.created_at) return false
        const reportDate = new Date(report.created_at)
        return reportDate.getMonth() + 1 === currentMonth && reportDate.getFullYear() === currentYear
      })
    } else if (periodType === 'semestral') {
      const semester = currentMonth <= 6 ? 'First' : 'Second'
      reportTitle = `${semester} Semester ${currentYear}`
      periodName = `${semester}_Semester_${currentYear}`
      filteredReports = reports.filter((report) => {
        if (!report.created_at) return false
        const reportDate = new Date(report.created_at)
        return reportDate.getFullYear() === currentYear && 
               ((semester === 'First' && reportDate.getMonth() + 1 <= 6) ||
                (semester === 'Second' && reportDate.getMonth() + 1 > 6))
      })
    } else {
      reportTitle = `For the Year ${currentYear}`
      periodName = `Year_${currentYear}`
      filteredReports = reports.filter((report) => {
        if (!report.created_at) return false
        const reportDate = new Date(report.created_at)
        return reportDate.getFullYear() === currentYear
      })
    }

    if (filteredReports.length === 0) {
      alert(`No reports found for ${reportTitle}.`)
      return
    }

    const groupedReports: { [key: string]: { periods: { period: string; pages: number }[] } } = {}
    filteredReports.forEach((report) => {
      const key = report.type_of_record
      const period = report.period_covered
      if (!groupedReports[key]) {
        groupedReports[key] = { periods: [] }
      }
      groupedReports[key].periods.push({ period, pages: report.no_of_pages })
    })

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([])
    XLSX.utils.sheet_add_aoa(worksheet, [[user?.role.toUpperCase()]], { origin: "B1" })
    XLSX.utils.sheet_add_aoa(worksheet, [[reportTitle]], { origin: "B2" })

    worksheet['!merges'] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
    ]

    applyStyles(worksheet, 0, 1, 4, true, true)

    let currentRow: number = 4
    const tableHeader: string[] = ["No.", "Type of Record", "Period Covered", "No. of Pages"]
    XLSX.utils.sheet_add_aoa(worksheet, [tableHeader], { origin: "A" + currentRow })
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true)

    currentRow++

    let reportIndex: number = 1
    let totalPages: number = 0

    Object.entries(groupedReports).forEach(([type, { periods }]) => {
      if (periods.length > 1) {
        const mainRow = [reportIndex++, type, "", ""]
        XLSX.utils.sheet_add_aoa(worksheet, [mainRow], { origin: "A" + currentRow })
        currentRow++

        periods.forEach((p, idx) => {
          const pages = idx === 0 ? p.pages : ""
          totalPages += idx === 0 ? p.pages : 0
          const subRow = ["", "", p.period, pages]
          XLSX.utils.sheet_add_aoa(worksheet, [subRow], { origin: "A" + currentRow })
          currentRow++
        })
      } else {
        const singleRow = [reportIndex++, type, periods[0].period, periods[0].pages]
        totalPages += periods[0].pages
        XLSX.utils.sheet_add_aoa(worksheet, [singleRow], { origin: "A" + currentRow })
        currentRow++
      }
    })

    applyStyles(worksheet, 4, currentRow - 1, tableHeader.length)

    const totalRow = ["", "TOTAL NO. OF PAGES", "", totalPages]
    XLSX.utils.sheet_add_aoa(worksheet, [totalRow], { origin: "A" + currentRow })
    applyStyles(worksheet, currentRow - 1, currentRow - 1, tableHeader.length, true)

    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 50 },
      { wch: 30 },
      { wch: 15 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `${periodName}_Report`)
    XLSX.writeFile(workbook, `${periodName}_Report.xlsx`)
  }

  function viewMonthlySummary() {
    setShowMonthlySummary(true)
  }

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()
  const monthName = currentDate.toLocaleString('default', { month: 'long' })

  const monthlyReports = reports.filter((report) => {
    if (!report.created_at) return false
    const reportDate = new Date(report.created_at)
    return (
      reportDate.getMonth() + 1 === currentMonth &&
      reportDate.getFullYear() === currentYear
    )
  })

  const chartData = {
    labels: [...new Set(monthlyReports.map(r => r.type_of_record))],
    datasets: [
      {
        label: `Total Pages (${monthName} ${currentYear})`,
        data: [...new Set(monthlyReports.map(r => r.type_of_record))].map(type =>
          monthlyReports
            .filter(r => r.type_of_record === type)
            .reduce((sum, r) => sum + r.no_of_pages, 0)
        ),
        backgroundColor: '#003087',
        borderColor: '#002060',
        borderWidth: 1,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Total Pages per Record Type (${monthName} ${currentYear})`,
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
          text: 'Type of Record',
        },
      },
    },
  }

  const getViewReportChartData = (report: Report) => ({
    labels: [report.type_of_record],
    datasets: [
      {
        label: `Pages (${report.period_covered})`,
        data: [report.no_of_pages],
        backgroundColor: '#003087',
        borderColor: '#002060',
        borderWidth: 1,
      },
    ],
  })

  const viewReportChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Pages for ${viewReport?.type_of_record} (${viewReport?.period_covered})`,
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
          text: 'Type of Record',
        },
      },
    },
  }

  return (
    <div className="min-h-screen bg-[#F5F6F5] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl bg-white rounded-lg shadow-lg p-4 sm:p-6">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Image
              src="/logo.png"
              alt="Website Logo"
              width={120}
              height={40}
              priority
              className="w-32 sm:w-40"
            />
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-[#003087] font-['Poppins']">
                Monthly Reports
              </h1>
              {user && (
                <p className="text-xs sm:text-sm text-gray-600">
                  Role: <span className="font-medium text-[#003087]">{user.role}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="text-[#C1272D] hover:text-[#a12025] font-medium transition-colors text-sm sm:text-base"
          >
            Logout
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div>
            <label className="block mb-1 text-sm font-medium text-[#003087]">
              Type of Record
            </label>
            <select
              value={typeOfRecord}
              onChange={(e) => {
                setTypeOfRecord(e.target.value)
                if (e.target.value !== 'Other') setCustomType('')
              }}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] placeholder-gray-500 text-sm sm:text-base"
              required
            >
              <option value="" disabled className="text-gray-500">Select Type of Record</option>
              {categories.map((category, index) => (
                <option key={index} value={category} className="text-[#003087]">
                  {category}
                </option>
              ))}
            </select>
          </div>

          {typeOfRecord === 'Other' && (
            <div>
              <label className="block mb-1 text-sm font-medium text-[#003087]">
                Custom Type of Record
              </label>
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500 text-sm sm:text-base"
                placeholder="Enter custom record type"
                required
              />
            </div>
          )}

          <div>
            <label className="block mb-1 text-sm font-medium text-[#003087]">
              Period Covered
            </label>
            <input
              type="text"
              value={periodCovered}
              onChange={(e) => setPeriodCovered(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500 text-sm sm:text-base"
              placeholder="Enter period covered (e.g., Jan 2025)"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-[#003087]">
              Number of Pages
            </label>
            <input
              type="number"
              value={noOfPages}
              onChange={(e) => setNoOfPages(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500 text-sm sm:text-base"
              min={0}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-sm sm:text-base"
          >
            Save Report
          </button>
        </form>

        <div className="mb-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={viewMonthlySummary}
            className="w-full py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-sm sm:text-base"
          >
            View Summary for This Month
          </button>
          <button
            onClick={() => generateReport('monthly')}
            className="w-full py-2 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-sm sm:text-base"
          >
            Download Monthly Report
          </button>
          <button
            onClick={() => generateReport('semestral')}
            className="w-full py-2 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-sm sm:text-base"
          >
            Download Semestral Report
          </button>
          <button
            onClick={() => generateReport('yearly')}
            className="w-full py-2 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-sm sm:text-base"
          >
            Download Yearly Report
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto">
          <div className="space-y-4">
            {reports.length === 0 ? (
              <p className="text-center text-gray-500 text-sm sm:text-base">No reports submitted yet.</p>
            ) : (
              reports.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-[#F5F6F5] rounded-lg shadow-sm hover:shadow-md transition-shadow space-y-2 sm:space-y-0"
                >
                  <div>
                    <p className="text-[#003087] font-medium text-sm sm:text-base">
                      {truncateRecordName(r?.type_of_record)} - {r?.period_covered}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {r?.no_of_pages} pages
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-[#C1272D] hover:text-[#a12025] font-medium transition-colors text-sm sm:text-base"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setViewReport(r)}
                      className="text-[#003087] hover:text-[#002060] font-medium transition-colors text-sm sm:text-base"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {viewReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg sm:text-xl font-bold text-[#003087] mb-4 font-['Poppins']">
                Report Details
              </h2>
              <p className="text-gray-700 text-sm sm:text-base">
                <span className="font-medium text-[#003087]">Type of Record:</span>{' '}
                {viewReport?.type_of_record}
              </p>
              <p className="text-gray-700 text-sm sm:text-base">
                <span className="font-medium text-[#003087]">Period Covered:</span>{' '}
                {viewReport?.period_covered}
              </p>
              <p className="text-gray-700 text-sm sm:text-base">
                <span className="font-medium text-[#003087]">Number of Pages Scanned:</span>{' '}
                {viewReport?.no_of_pages}
              </p>
              <div className="mt-4 h-48">
                <Bar data={getViewReportChartData(viewReport)} options={viewReportChartOptions} />
              </div>
              <button
                onClick={() => setViewReport(null)}
                className="mt-4 w-full py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showMonthlySummary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg sm:text-xl font-bold text-[#003087] mb-4 font-['Poppins']">
                Summary for {monthName} {currentYear}
              </h2>
              <div className="mb-6 h-64 sm:h-80">
                <Bar data={chartData} options={chartOptions} />
              </div>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full border-collapse table-auto sm:table-fixed text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#003087] text-white sticky top-0">
                      <th className="p-2 text-left sm:w-[50px]">No.</th>
                      <th className="p-2 text-left sm:w-[200px]">Type of Record</th>
                      <th className="p-2 text-left sm:w-[150px]">Period Covered</th>
                      <th className="p-2 text-left sm:w-[100px]">No. of Pages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReports.map((r, index) => (
                      <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                        <td className="p-2 truncate text-[#003087]" title={String(index + 1)}>{index + 1}</td>
                        <td className="p-2 truncate text-[#003087]" title={r.type_of_record}>{r.type_of_record}</td>
                        <td className="p-2 truncate text-[#003087]" title={r.period_covered}>{r.period_covered}</td>
                        <td className="p-2 truncate text-[#003087]" title={String(r.no_of_pages)}>{r.no_of_pages}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td colSpan={3} className="p-2 text-right text-[#003087]">Total No. of Pages</td>
                      <td className="p-2 text-[#003087]">
                        {monthlyReports.reduce((sum, r) => sum + r.no_of_pages, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => setShowMonthlySummary(false)}
                className="mt-4 w-full py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-sm sm:text-base"
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
