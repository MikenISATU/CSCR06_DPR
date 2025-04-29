"use client"

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from './supbase'

type User = { id: string; username: string; role: string }
type Report = { id: string; type_of_record: string; period_covered: string; no_of_pages: number }

export default function InputPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [typeOfRecord, setTypeOfRecord] = useState('')
  const [periodCovered, setPeriodCovered] = useState('')
  const [noOfPages, setNoOfPages] = useState(0)
  const [reports, setReports] = useState<Report[]>([])
  const [viewReport, setViewReport] = useState<Report | null>(null)

  // Load user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('scanflow360_user')
    if (!stored) return router.replace('/login')
    setUser(JSON.parse(stored))
  }, [])

  // Fetch user's reports
  useEffect(() => {
    if (user) fetchReports()
  }, [user])

  async function fetchReports() {
    const { data, error } = await supabase
      .from('monthly_reports1')
      .select('id, type_of_record, period_covered, no_of_pages')
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
    const { error } = await supabase.from('monthly_reports1').upsert({
      useriud: user!.id,
      type_of_record: typeOfRecord,
      period_covered: periodCovered,
      no_of_pages: noOfPages,
    })
    if (error) {
      alert('Error saving report: ' + error.message)
      return
    }
    setTypeOfRecord('')
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

  // Function to truncate long type_of_record names
  function truncateRecordName(name: string, maxLength: number = 20): string {
    if (name.length <= maxLength) return name
    return `${name.substring(0, maxLength - 3)}...`
  }

  return (
    <div className="min-h-screen bg-[#F5F6F5] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
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
                Monthly Reports
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div>
            <label className="block mb-1 text-sm font-medium text-[#003087]">
              Type of Record
            </label>
            <input
              type="text"
              value={typeOfRecord}
              onChange={(e) => setTypeOfRecord(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500"
              placeholder="Enter type of record"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-[#003087]">
              Period Covered
            </label>
            <input
              type="text"
              value={periodCovered}
              onChange={(e) => setPeriodCovered(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500"
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
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500"
              min={0}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium"
          >
            Save Report
          </button>
        </form>

        {/* Reports List with Scrollable Container */}
        <div className="max-h-60 overflow-y-auto">
          <div className="space-y-4">
            {reports.length === 0 ? (
              <p className="text-center text-gray-500">No reports submitted yet.</p>
            ) : (
              reports.map((r) => (
                <div
                  key={r.id}
                  className="flex justify-between items-center p-4 bg-[#F5F6F5] rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <div>
                    <p className="text-[#003087] font-medium">
                      {truncateRecordName(r?.type_of_record)} - {r?.period_covered}
                    </p>
                    <p className="text-sm text-gray-600">
                      {r?.no_of_pages} pages
                    </p>
                  </div>
                  <div className="space-x-3">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-[#C1272D] hover:text-[#a12025] font-medium transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setViewReport(r)}
                      className="text-[#003087] hover:text-[#002060] font-medium transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal for Viewing Report */}
        {viewReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold text-[#003087] mb-4 font-['Poppins']">
                Report Details
              </h2>
              <p className="text-gray-700">
                <span className="font-medium text-[#003087]">Type of Record:</span>{' '}
                {viewReport?.type_of_record}
              </p>
              <p className="text-gray-700">
                <span className="font-medium text-[#003087]">Period Covered:</span>{' '}
                {viewReport?.period_covered}
              </p>
              <p className="text-gray-700">
                <span className="font-medium text-[#003087]">Number of Pages:</span>{' '}
                {viewReport?.no_of_pages}
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
      </div>
    </div>
  )
}
