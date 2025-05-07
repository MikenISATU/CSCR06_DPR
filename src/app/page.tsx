"use client"

import React, { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image' 
import { supabase } from './supbase'

export default function LoginPage(): React.ReactElement {
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [rememberMe, setRememberMe] = useState<boolean>(false)
  const router = useRouter()

  // Load saved credentials on component mount
  useEffect(() => {
    const savedCredentials = localStorage.getItem('scanflow360_credentials')
    if (savedCredentials) {
      const { username: savedUsername, password: savedPassword } = JSON.parse(savedCredentials)
      setUsername(savedUsername || '')
      setPassword(savedPassword || '')
      setRememberMe(true)
    }
  }, [])

  async function handleLogin(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    
    // Sanitize username input: trim and allow alphanumeric, underscores, and hyphens
    // Explicitly supports usernames with underscores (_)
    const sanitizedUsername = username.trim().replace(/[^a-zA-Z0-9_-]/g, '')
    if (!sanitizedUsername) {
      alert('Invalid username. Only alphanumeric characters, underscores, and hyphens are allowed.')
      return
    }

    if (!password) {
      alert('Password cannot be empty.')
      return
    }

    try {
      // Note: Supabase client uses parameterized queries, which helps prevent SQL injection
      // Passwords are not sanitized and can include special characters like @, #, $, etc.
      const { data: users, error } = await supabase
        .from('users2')
        .select('id, username, password, role')
        .eq('username', sanitizedUsername)

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

      // SECURITY NOTE: In a real application, passwords should be hashed (e.g., using bcrypt)
      // and compared server-side. Comparing plain-text passwords is insecure.
      // Passwords can include special characters (@, #, $, etc.) as they are not sanitized.
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

      // Save both username and password if rememberMe is checked
      // SECURITY WARNING: Storing passwords in localStorage is highly insecure due to XSS vulnerabilities.
      // In a production app, never store passwords client-side; use secure tokens (e.g., JWT) instead.
      if (rememberMe) {
        localStorage.setItem('scanflow360_credentials', JSON.stringify({
          username: sanitizedUsername,
          password: password,
        }))
      } else {
        localStorage.removeItem('scanflow360_credentials')
      }

      // Redirect based on role (case-insensitive comparison)
      if (user.role.toUpperCase() === 'ADMIN') {
        router.push('/adminpage')
      } else {
        router.push('/inputpage')
      }
    } catch (err) {
      alert('Unexpected error: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F5] flex flex-col items-center p-4 sm:p-6">
      <div className="mb-6">
        <Image
          src="/logo.png"
          alt="Website Logo"
          width={120}
          height={40}
          priority
          className="w-32 sm:w-40"
        />
      </div>
      <form onSubmit={handleLogin} className="bg-white rounded-lg shadow-lg p-6 sm:p-8 w-full max-w-sm mt-8 sm:mt-16">
        <h2 className="text-xl sm:text-2xl font-bold text-[#003087] mb-6 font-['Poppins'] text-center">
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
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
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
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="mr-2 h-4 w-4 text-[#C8102E] focus:ring-[#C8102E] border-gray-300 rounded accent-[#C8102E]"
            />
            <label htmlFor="rememberMe" className="text-sm text-[#003087]">
              Remember me
            </label>
          </div>
        </div>
        <button
          type="submit"
          className="w-full py-2 mt-6 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-sm sm:text-base"
        >
          Login
        </button>
      </form>
      <footer className="mt-8 text-sm text-gray-600">
        All rights reserved by CSC R06 2025
      </footer>
    </div>
  )
}
