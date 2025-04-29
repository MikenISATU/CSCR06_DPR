"use client"

import React, { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image' 
import { supabase } from './supbase'

export default function LoginPage(): React.ReactElement {
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const router = useRouter()

  async function handleLogin(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const usernameToQuery = username.trim()
    try {
      const { data: users, error } = await supabase
        .from('users2')
        .select('id, username, password, role')
        .eq('username', usernameToQuery)

      if (error) {
        alert('Error fetching user: ' + error.message)
        return
      }

      if (!users || users.length === 0) {
        alert('User not found')
        return
      }

      if (users.length > 1) {
        alert('Multiple users found with this username. Please contact support.')
        return
      }

      const user = users[0]

      if (user.password !== password) {
        alert('Wrong username or password')
        return
      }

      // Save user info to localStorage for session persistence
      localStorage.setItem('scanflow360_user', JSON.stringify({
        id: user.id,
        username: user.username,
        role: user.role,
      }))

      // Redirect based on role (case-insensitive comparison)
      if (user.role.toUpperCase() === 'ADMIN') {
        router.push('/adminpage')
      } else {
        router.push('/inputpage')
      }
    } catch (err) {
      alert('Unexpected error: ' + err)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F5] flex flex-col items-start p-4">
      <div className="mb-6">
        <Image
          src="/logo.png"
          alt="Website Logo"
          width={150}
          height={50}
          priority
          className="ml-4"
        />
      </div>
      <form onSubmit={handleLogin} className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm mx-auto mt-18">
        <h2 className="text-2xl font-bold text-[#003087] mb-6 font-['Poppins'] text-center">
          Digitization Project Report (Sign In)
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-[#003087]">
              Username
            </label>
            <input
              type="text"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-[#003087]">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-black placeholder-gray-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full py-2 mt-6 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium"
        >
          Login
        </button>
      </form>
    </div>
  )
}
