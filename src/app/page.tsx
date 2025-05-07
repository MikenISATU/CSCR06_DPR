"use client"

import React, { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image' 
import { supabase } from './supbase'

export default function LoginPage(): React.ReactElement {
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [rememberMe, setRememberMe] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false) // State for password visibility toggle
  const [loginAttempts, setLoginAttempts] = useState<number>(0) // Track login attempts for rate limiting
  const [isLocked, setIsLocked] = useState<boolean>(false) // Lock login after too many attempts
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

  // Reset login attempts after a delay (e.g., 5 minutes) if locked
  useEffect(() => {
    if (isLocked) {
      const timer = setTimeout(() => {
        setIsLocked(false)
        setLoginAttempts(0)
      }, 5 * 60 * 1000) // 5 minutes lockout
      return () => clearTimeout(timer)
    }
  }, [isLocked])

  async function handleLogin(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()

    // Simulate rate limiting: lock after 5 failed attempts
    if (isLocked) {
      alert('Too many failed attempts. Please wait 5 minutes before trying again.')
      return
    }

    // Sanitize username input: trim and allow alphanumeric, underscores, and hyphens
    const sanitizedUsername = username.trim().replace(/[^a-zA-Z0-9_-]/g, '')
    if (!sanitizedUsername) {
      alert('Invalid username. Only alphanumeric characters, underscores, and hyphens are allowed.')
      setLoginAttempts(prev => prev + 1)
      if (loginAttempts + 1 >= 5) setIsLocked(true)
      return
    }

    if (!password) {
      alert('Password cannot be empty.')
      setLoginAttempts(prev => prev + 1)
      if (loginAttempts + 1 >= 5) setIsLocked(true)
      return
    }

    try {
      const { data: users, error } = await supabase
        .from('users2')
        .select('id, username, password, role')
        .eq('username', sanitizedUsername)

      if (error) {
        alert('Error fetching user: ' + error.message)
        setLoginAttempts(prev => prev + 1)
        if (loginAttempts + 1 >= 5) setIsLocked(true)
        return
      }

      if (!users || users.length === 0) {
        alert('User not found')
        setLoginAttempts(prev => prev + 1)
        if (loginAttempts + 1 >= 5) setIsLocked(true)
        return
      }

      if (users.length > 1) {
        alert('Multiple users found with this username. Please contact support.')
        setLoginAttempts(prev => prev + 1)
        if (loginAttempts + 1 >= 5) setIsLocked(true)
        return
      }

      const user = users[0]

      if (user.password !== password) {
        alert('Wrong username or password')
        setLoginAttempts(prev => prev + 1)
        if (loginAttempts + 1 >= 5) setIsLocked(true)
        return
      }

      // Reset login attempts on successful login
      setLoginAttempts(0)
      setIsLocked(false)

      // Save user info to localStorage for session persistence
      localStorage.setItem('scanflow360_user', JSON.stringify({
        id: user.id,
        username: user.username,
        role: user.role,
      }))

      // Save credentials if rememberMe is checked
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
      setLoginAttempts(prev => prev + 1)
      if (loginAttempts + 1 >= 5) setIsLocked(true)
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
      <form 
        onSubmit={handleLogin} 
        className="bg-white rounded-lg shadow-lg p-6 sm:p-8 w-full max-w-sm mt-8 sm:mt-16"
        aria-label="Login Form"
      >
        <h2 className="text-xl sm:text-2xl font-bold text-[#003087] mb-6 font-['Poppins'] text-center">
          Digitization Project Report (Sign In)
        </h2>
        <div className="space-y-4">
          <div>
            <label 
              htmlFor="username" 
              className="block mb-1 text-sm font-medium text-[#003087]"
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              aria-required="true"
              aria-describedby="username-error"
            />
            {loginAttempts > 0 && (
              <p id="username-error" className="text-xs text-[#C1272D] mt-1">
                {loginAttempts < 5 ? `Attempts remaining: ${5 - loginAttempts}` : 'Account locked. Please wait 5 minutes.'}
              </p>
            )}
          </div>
          <div className="relative">
            <label 
              htmlFor="password" 
              className="block mb-1 text-sm font-medium text-[#003087]"
            >
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              aria-required="true"
              aria-describedby="password-error"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-9 text-[#003087] hover:text-[#002060] focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
            {loginAttempts > 0 && (
              <p id="password-error" className="text-xs text-[#C1272D] mt-1">
                {loginAttempts < 5 ? `Attempts remaining: ${5 - loginAttempts}` : 'Account locked. Please wait 5 minutes.'}
              </p>
            )}
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="mr-2 h-4 w-4 text-[#C8102E] focus:ring-[#C8102E] border-gray-300 rounded accent-[#C8102E]"
              aria-label="Remember me checkbox"
            />
            <label 
              htmlFor="rememberMe" 
              className="text-sm text-[#003087]"
            >
              Remember me
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={isLocked}
          className={`w-full py-2 mt-6 rounded font-medium text-sm sm:text-base transition-colors ${
            isLocked 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-[#003087] text-white hover:bg-[#002060]'
          }`}
          aria-label="Login button"
        >
          Login
        </button>
      </form>
      <footer className="mt-8 text-sm text-gray-600">
        All Rights Reserved by CSC R06 2025
      </footer>
    </div>
  )
}
