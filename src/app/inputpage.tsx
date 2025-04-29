'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supbase'

type User = { id: string; username: string; role: string }

export default function InputPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [month, setMonth] = useState('')
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [pages, setPages] = useState(0)
  const [reports, setReports] = useState<
    { id: string; month: string; year: number; scanned_pages: number }[]
  >([])

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
    const { data } = await supabase
      .from('monthly_reports')
      .select('id, month, year, scanned_pages')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    setReports(data || [])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!month) return alert('Select a month')
    await supabase.from('monthly_reports').upsert({
      user_id: user!.id,
      month,
      year,
      scanned_pages: pages,
    })
    setMonth('')
    setPages(0)
    fetchReports()
  }

  async function handleDelete(id: string) {
    await supabase.from('monthly_reports').delete().eq('id', id)
    fetchReports()
  }

  function logout() {
    localStorage.removeItem('scanflow360_user')
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">My Monthly Reports</h1>
          <button onClick={logout} className="text-red-600 hover:underline">
            Logout
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label className="block mb-1 font-medium">Month</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">-- Select Month --</option>
              {[
                'January','February','March','April','May','June',
                'July','August','September','October','November','December',
              ].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Scanned Pages</label>
            <input
              type="number"
              value={pages}
              onChange={e => setPages(Number(e.target.value))}
              className="w-full p-2 border rounded"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Save / Update
          </button>
        </form>

        <ul className="divide-y">
          {reports.map(r => (
            <li key={r.id} className="flex justify-between py-2">
              <span>
                {r.month} {r.year}: <strong>{r.scanned_pages}</strong> pages
              </span>
              <button
                onClick={() => handleDelete(r.id)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
