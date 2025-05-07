"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from './supbase'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

type User = { id: string; username: string; role: string }
type Report = { id: string; useriud: string; type_of_record: string; period_covered: string; no_of_pages: number; role: string; created_at: string }
type Category = { id: number; role: string; category: string }
type UserAccount = { id: string; username: string; role: string }

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [viewReport, setViewReport] = useState<Report | null>(null)
  const [yearlyReports, setYearlyReports] = useState<Report[]>([])
  const [showYearlyModal, setShowYearlyModal] = useState(false)
  const [isReportGenerated, setIsReportGenerated] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('MSD')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [activeSlider, setActiveSlider] = useState<'users' | 'admin' | null>(null)
  const [users, setUsers] = useState<UserAccount[]>([])
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null)
  const [newUsername, setNewUsername] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [adminNewUsername, setAdminNewUsername] = useState<string>('')
  const [adminNewPassword, setAdminNewPassword] = useState<string>('')

  useEffect(() => {
    const stored = localStorage.getItem('scanflow360_user')
    if (!stored) return router.replace('/')
    const parsedUser = JSON.parse(stored)
    setUser(parsedUser)
    if (parsedUser.role !== 'ADMIN') {
      alert('Access denied: Admins only')
      router.replace('/')
    }
  }, [router])

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      fetchReports()
      fetchCategories()
      fetchUsers()
    }
  }, [user])

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('users2')
      .select('id, username, role')
      .in('role', ['MSD', 'LSD', 'ESD', 'ADMIN'])

    if (error) {
      alert('Error fetching users: ' + error.message)
      return
    }

    setUsers(data || [])
  }

  async function fetchReports() {
    const { data, error } = await supabase
      .from('monthly_reports1')
      .select('id, useriud, type_of_record, period_covered, no_of_pages, created_at, users2(role)')

    if (error) {
      alert('Error fetching reports: ' + error.message)
      return
    }

    const formattedReports = data?.map((report: any) => {
      const role = report.users2?.role || 'Unknown'
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

    setReports(formattedReports)
  }

  async function fetchCategories() {
    const { data, error } = await supabase
      .from('record_categories')
      .select('id, role, category')

    if (error) {
      alert('Error fetching categories: ' + error.message)
      return
    }

    setCategories(data || [])
  }

  async function addCategory() {
    if (!newCategory) {
      alert('Please enter a category name.')
      return
    }

    const { error } = await supabase
      .from('record_categories')
      .insert({ role: selectedRole, category: newCategory })

    if (error) {
      alert('Error adding category: ' + error.message)
      return
    }

    setNewCategory('')
    fetchCategories()
  }

  async function updateCategory(categoryId: number, updatedCategory: string) {
    if (!updatedCategory) {
      alert('Please enter a category name.')
      return
    }

    const { error } = await supabase
      .from('record_categories')
      .update({ category: updatedCategory })
      .eq('id', categoryId)

    if (error) {
      alert('Error updating category: ' + error.message)
      return
    }

    setEditingCategory(null)
    fetchCategories()
  }

  async function deleteCategory(categoryId: number) {
    const { error } = await supabase
      .from('record_categories')
      .delete()
      .eq('id', categoryId)

    if (error) {
      alert('Error deleting category: ' + error.message)
      return
    }

    fetchCategories()
  }

  async function fetchYearlyReports() {
    const currentYear = new Date().getFullYear()
    const { data, error } = await supabase
      .from('monthly_reports1')
      .select('id, useriud, type_of_record, period_covered, no_of_pages, created_at, users2(role)')
      .gte('created_at', `${currentYear}-01-01T00:00:00Z`)
      .lte('created_at', `${currentYear}-12-31T23:59:59Z`)

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
      alert('Failed to delete old reports: ' + error.message)
      return
    }

    alert('Records older than 1 year have been deleted successfully!')
    await fetchReports()
    if (showYearlyModal) {
      await fetchYearlyReports()
    }
  }

  async function updateUserCredentials() {
    if (!selectedUser || !newUsername || !newPassword) {
      alert('Please select a user and provide both username and password.')
      return
    }

    const { error } = await supabase
      .from('users2')
      .update({ username: newUsername, password: newPassword })
      .eq('id', selectedUser.id)

    if (error) {
      alert('Error updating user credentials: ' + error.message)
      return
    }

    alert('User credentials updated successfully!')
    setNewUsername('')
    setNewPassword('')
    setSelectedUser(null)
    fetchUsers()
  }

  async function updateAdminCredentials() {
    if (!adminNewUsername || !adminNewPassword) {
      alert('Please provide both username and password.')
      return
    }

    const { error } = await supabase
      .from('users2')
      .update({ username: adminNewUsername, password: adminNewPassword })
      .eq('id', user!.id)

    if (error) {
      alert('Error updating admin credentials: ' + error.message)
      return
    }

    alert('Admin credentials updated successfully!')
    localStorage.setItem('scanflow360_user', JSON.stringify({ ...user, username: adminNewUsername }))
    setUser({ ...user!, username: adminNewUsername })
    setAdminNewUsername('')
    setAdminNewPassword('')
    fetchUsers()
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
            vertical: 'center',
          },
          font: isHeader ? { bold: true } : undefined,
        }
      }
    }
  }

  function downloadYearlyReport() {
    const currentYear = new Date().getFullYear()
    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([])

    XLSX.utils.sheet_add_aoa(worksheet, [["Civil Service Commission Regional Office VI"]], { origin: "B1" })
    XLSX.utils.sheet_add_aoa(worksheet, [["DIGITIZATION OF RECORDS"]], { origin: "B2" })
    XLSX.utils.sheet_add_aoa(worksheet, [[`For the Year ${currentYear}`]], { origin: "B3" })
    XLSX.utils.sheet_add_aoa(worksheet, [["Target: 100% of Identified Records"]], { origin: "B4" })

    worksheet['!merges'] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    ]

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
        const mainRow = [reportIndex++, report.type_of_record, "", ""]
        XLSX.utils.sheet_add_aoa(worksheet, [mainRow], { origin: "A" + currentRow })
        currentRow++

        periods.forEach((period, idx) => {
          const pages = idx === 0 ? noOfPages : ""
          const subRow = ["", "", period, pages]
          XLSX.utils.sheet_add_aoa(worksheet, [subRow], { origin: "A" + currentRow })
          currentRow++
        })
      } else {
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
    XLSX.utils.sheet_add_aoa(worksheet, [["Acting Director III"]], { origin: "A" + currentRow })

    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 50 },
      { wch: 30 },
      { wch: 15 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Year_${currentYear}_Report`)
    XLSX.writeFile(workbook, `Year_${currentYear}_Report.xlsx`)
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

    if (filteredReports.length === 0) {
      alert(`No reports exist for ${monthName} ${year}.`)
      return
    }

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([])

    XLSX.utils.sheet_add_aoa(worksheet, [["Civil Service Commission Regional Office VI"]], { origin: "B1" })
    XLSX.utils.sheet_add_aoa(worksheet, [["DIGITIZATION OF RECORDS"]], { origin: "B2" })
    XLSX.utils.sheet_add_aoa(worksheet, [["For the month of " + monthName + " " + year]], { origin: "B3" })
    XLSX.utils.sheet_add_aoa(worksheet, [["Target: 100% of Identified Records"]], { origin: "B4" })

    worksheet['!merges'] = [
      { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    ]

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
        const mainRow = [reportIndex++, report.type_of_record, "", ""]
        XLSX.utils.sheet_add_aoa(worksheet, [mainRow], { origin: "A" + currentRow })
        currentRow++

        periods.forEach((period, idx) => {
          const pages = idx === 0 ? noOfPages : ""
          const subRow = ["", "", period, pages]
          XLSX.utils.sheet_add_aoa(worksheet, [subRow], { origin: "A" + currentRow })
          currentRow++
        })
      } else {
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
        label: `Total Pages (Year ${new Date().getFullYear()})`,
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
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Total Pages per Department (Year ${new Date().getFullYear()})`,
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

  const years = Array.from({ length: 11 }, (_, i) => (2020 + i).toString())

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

  const roles = ['MSD', 'ESD', 'LSD']

  return (
    <div className="min-h-screen bg-[#F5F6F5] p-2 sm:p-4 md:p-6 relative">
      <div className="w-full max-w-full sm:max-w-5xl mx-auto bg-white rounded-lg shadow-lg p-3 sm:p-4 md:p-6 mt-6 sm:mt-8 md:mt-12">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <Image
              src="/logo.png"
              alt="Website Logo"
              width={120}
              height={40}
              priority
              className="w-24 sm:w-32 md:w-40"
            />
            <div className="text-center sm:text-left">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#003087] font-['Poppins']">
                Admin Dashboard
              </h1>
              {user && (
                <p className="text-xs sm:text-sm text-gray-600">
                  Role: <span className="font-medium text-[#003087]">{user.role}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => setActiveSlider('users')}
              className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
            >
              Manage Users
            </button>
            <button
              onClick={() => setActiveSlider('admin')}
              className="py-1 px-2 sm:py-2 sm:px-4 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
            >
              Manage Admin
            </button>
            <button
              onClick={logout}
              className="text-[#C1272D] hover:text-[#a12025] font-medium transition-colors text-xs sm:text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {['MSD', 'ESD', 'LSD'].map((role) => {
          const roleReports = role === 'MSD' ? msdReports : role === 'ESD' ? esdReports : lsdReports
          const totalPages = roleReports.reduce((sum, r) => sum + r.no_of_pages, 0)

          return (
            <div key={role} className="mb-6 sm:mb-8">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
                {role} Reports
              </h2>
              {roleReports.length === 0 ? (
                <p className="text-gray-500 text-xs sm:text-sm md:text-base">No reports submitted for {role}.</p>
              ) : (
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full border-collapse table-auto text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#003087] text-white sticky top-0">
                        <th className="p-1 sm:p-2 text-left w-[40px] sm:w-[50px]">No.</th>
                        <th className="p-1 sm:p-2 text-left w-[150px] sm:w-[200px]">Type of Record</th>
                        <th className="p-1 sm:p-2 text-left w-[120px] sm:w-[150px]">Period Covered</th>
                        <th className="p-1 sm:p-2 text-left w-[80px] sm:w-[100px]">No. of Pages</th>
                        <th className="p-1 sm:p-2 text-left w-[80px] sm:w-[100px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleReports.map((r, index) => (
                        <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                          <td className="p-1 sm:p-2 truncate text-[#003087]" title={String(index + 1)}>{index + 1}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]" title={r.type_of_record}>{r.type_of_record}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]" title={r.period_covered}>{r.period_covered}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]" title={String(r.no_of_pages)}>{r.no_of_pages}</td>
                          <td className="p-1 sm:p-2">
                            <button
                              onClick={() => setViewReport(r)}
                              className="text-[#003087] hover:text-[#002060] font-medium transition-colors text-xs sm:text-sm"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td colSpan={3} className="p-1 sm:p-2 text-right text-[#003087]">Total No. of Pages</td>
                        <td className="p-1 sm:p-2 text-[#003087]">{totalPages}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}

        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
            Manage Type of Record Categories
          </h2>
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 mb-4">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
            >
              {roles.map((role) => (
                <option key={role} value={role} className="text-[#003087]">
                  {role}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Enter new category"
              className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
            />
            <button
              onClick={addCategory}
              className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium w-full sm:w-auto text-xs sm:text-sm"
            >
              Add Category
            </button>
          </div>
          <div className="overflow-x-auto max-h-60">
            <table className="w-full border-collapse table-auto text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#003087] text-white sticky top-0">
                  <th className="p-1 sm:p-2 text-left w-[40px] sm:w-[50px]">No.</th>
                  <th className="p-1 sm:p-2 text-left w-[80px] sm:w-[100px]">Role</th>
                  <th className="p-1 sm:p-2 text-left w-[150px] sm:w-[200px]">Category</th>
                  <th className="p-1 sm:p-2 text-left w-[100px] sm:w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, index) => (
                  <tr key={cat.id} className="border-b hover:bg-[#F5F6F5]">
                    <td className="p-1 sm:p-2 truncate text-[#003087]">{index + 1}</td>
                    <td className="p-1 sm:p-2 truncate text-[#003087]">{cat.role}</td>
                    <td className="p-1 sm:p-2 truncate text-[#003087]">
                      {editingCategory?.id === cat.id ? (
                        <input
                          type="text"
                          value={editingCategory.category}
                          onChange={(e) =>
                            setEditingCategory({ ...editingCategory, category: e.target.value })
                          }
                          className="border border-gray-300 rounded p-1 w-full text-[#003087] text-xs sm:text-sm"
                        />
                      ) : (
                        cat.category
                      )}
                    </td>
                    <td className="p-1 sm:p-2 flex flex-wrap space-x-2">
                      {editingCategory?.id === cat.id ? (
                        <>
                          <button
                            onClick={() => updateCategory(cat.id, editingCategory.category)}
                            className="text-[#003087] hover:text-[#002060] font-medium text-xs sm:text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="text-[#C1272D] hover:text-[#a12025] font-medium text-xs sm:text-sm"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingCategory(cat)}
                            className="text-[#003087] hover:text-[#002060] font-medium text-xs sm:text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCategory(cat.id)}
                            className="text-[#C1272D] hover:text-[#a12025] font-medium text-xs sm:text-sm"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
            Yearly Summary
          </h2>
          <div className="flex flex-col space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
              <button
                onClick={fetchYearlyReports}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
              >
                View Summary
              </button>
              <button
                onClick={isReportGenerated ? downloadYearlyReport : fetchYearlyReports}
                className={
                  "py-1 px-2 sm:py-2 sm:px-4 font-medium text-white rounded transition-colors text-xs sm:text-sm " +
                  (isReportGenerated ? 'bg-[#C1272D] hover:bg-[#a12025]' : 'bg-[#003087] hover:bg-[#002060]')
                }
              >
                {isReportGenerated ? 'Download Yearly Report' : 'Generate Report'}
              </button>
              <button
                onClick={deleteOldReports}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#C1272D] text-white rounded hover:bg-[#a12025] transition-colors font-medium text-xs sm:text-sm"
              >
                Delete Records
              </button>
            </div>
            <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <label className="text-[#003087] font-medium text-xs sm:text-sm md:text-base">Download Monthly Report:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
              >
                <option value="" disabled className="text-gray-500">Select Month</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value} className="text-[#003087]">
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border border-gray-300 rounded p-1 sm:p-2 w-full sm:w-auto text-xs sm:text-sm text-[#003087]"
              >
                <option value="" disabled className="text-gray-500">Select Year</option>
                {years.map((year) => (
                  <option key={year} value={year} className="text-[#003087]">
                    {year}
                  </option>
                ))}
              </select>
              <button
                onClick={downloadMonthlyReport}
                className="py-1 px-2 sm:py-2 sm:px-4 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium w-full sm:w-auto text-xs sm:text-sm"
              >
                Download
              </button>
            </div>
          </div>
        </div>

        {viewReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
                Report Details
              </h2>
              <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                <span className="font-medium text-[#003087]">Type of Record:</span> {viewReport?.type_of_record}
              </p>
              <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                <span className="font-medium text-[#003087]">Period Covered:</span> {viewReport?.period_covered}
              </p>
              <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                <span className="font-medium text-[#003087]">Number of Pages:</span> {viewReport?.no_of_pages}
              </p>
              <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                <span className="font-medium text-[#003087]">Role:</span> {viewReport?.role}
              </p>
              <button
                onClick={() => setViewReport(null)}
                className="mt-3 sm:mt-4 w-full py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showYearlyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-[#003087] mb-3 sm:mb-4 font-['Poppins']">
                Summary for Year {new Date().getFullYear()}
              </h2>

              <div className="mb-4 sm:mb-6 h-48 sm:h-64 md:h-80">
                <Bar data={chartData} options={chartOptions} />
              </div>

              <div className="overflow-x-auto max-h-60">
                <table className="w-full border-collapse table-auto text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#003087] text-white sticky top-0">
                      <th className="p-1 sm:p-2 text-left w-[40px] sm:w-[50px]">No.</th>
                      <th className="p-1 sm:p-2 text-left w-[150px] sm:w-[200px]">Type of Record</th>
                      <th className="p-1 sm:p-2 text-left w-[120px] sm:w-[150px]">Period Covered</th>
                      <th className="p-1 sm:p-2 text-left w-[80px] sm:w-[100px]">No. of Pages</th>
                      <th className="p-1 sm:p-2 text-left w-[80px] sm:w-[100px]">Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyReports
                      .filter(r => ['MSD', 'ESD', 'LSD'].includes(r.role.toUpperCase()))
                      .map((r, index) => (
                        <tr key={r.id} className="border-b hover:bg-[#F5F6F5]">
                          <td className="p-1 sm:p-2 truncate text-[#003087]" title={String(index + 1)}>{index + 1}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]" title={r.type_of_record}>{r.type_of_record}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]" title={r.period_covered}>{r.period_covered}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]" title={String(r.no_of_pages)}>{r.no_of_pages}</td>
                          <td className="p-1 sm:p-2 truncate text-[#003087]" title={r.role}>{r.role}</td>
                        </tr>
                      ))}
                    <tr className="font-bold">
                      <td colSpan={3} className="p-1 sm:p-2 text-right text-[#003087]">Total No. of Pages</td>
                      <td className="p-1 sm:p-2 text-[#003087]">
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
                className="mt-3 sm:mt-4 w-full py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Management Slider */}
      <div
        className={`fixed top-0 right-0 h-full w-64 sm:w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
          activeSlider === 'users' ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-3 sm:p-4">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-[#003087] font-['Poppins']">
              Manage Users
            </h2>
            <button
              onClick={() => setActiveSlider(null)}
              className="text-[#C1272D] hover:text-[#a12025] text-lg sm:text-xl"
            >
              ×
            </button>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <select
              value={selectedUser?.id || ''}
              onChange={(e) => {
                const user = users.find(u => u.id === e.target.value)
                setSelectedUser(user || null)
                setNewUsername(user?.username || '')
                setNewPassword('')
              }}
              className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
            >
              <option value="" disabled className="text-gray-500">Select User</option>
              {users
                .filter(u => ['MSD', 'LSD', 'ESD'].includes(u.role))
                .map((u) => (
                  <option key={u.id} value={u.id} className="text-[#003087]">
                    {u.username} ({u.role})
                  </option>
                ))}
            </select>
            {selectedUser && (
              <>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="New Username"
                  className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
                />
                <button
                  onClick={updateUserCredentials}
                  className="w-full py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
                >
                  Update Credentials
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Admin Management Slider */}
      <div
        className={`fixed top-0 right-0 h-full w-64 sm:w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
          activeSlider === 'admin' ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-3 sm:p-4">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-[#003087] font-['Poppins']">
              Manage Admin
            </h2>
            <button
              onClick={() => setActiveSlider(null)}
              className="text-[#C1272D] hover:text-[#a12025] text-lg sm:text-xl"
            >
              ×
            </button>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <input
              type="text"
              value={adminNewUsername}
              onChange={(e) => setAdminNewUsername(e.target.value)}
              placeholder="New Username"
              className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
            />
            <input
              type="password"
              value={adminNewPassword}
              onChange={(e) => setAdminNewPassword(e.target.value)}
              placeholder="New Password"
              className="border border-gray-300 rounded p-1 sm:p-2 w-full text-xs sm:text-sm text-[#003087]"
            />
            <button
              onClick={updateAdminCredentials}
              className="w-full py-1 sm:py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-xs sm:text-sm"
            >
              Update Admin Credentials
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for sliders on mobile */}
      {activeSlider && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setActiveSlider(null)}
        />
      )}
    </div>
  )
}
