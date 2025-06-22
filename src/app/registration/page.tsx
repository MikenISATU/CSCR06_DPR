"use client";

import React, { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../supbase';
import toast, { Toaster } from 'react-hot-toast';

export default function RegistrationPage(): React.ReactElement {
  const [name, setName] = useState<string>('');
  const [office, setOffice] = useState<string>('');
  const [officeHead, setOfficeHead] = useState<string>('');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i;
    return regex.test(email);
  };

  const validateUsername = (username: string): boolean => {
    const regex = /^[a-zA-Z0-9_-]+$/;
    return regex.test(username);
  };

  const validatePassword = (password: string): boolean => {
    return (
      password.length <= 10 &&
      /[A-Z]/.test(password) && // At least one uppercase letter
      /[!@#$%^&*(),.?":{}|<>]/.test(password) // At least one special character
    );
  };

  async function handleRegistration(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!office.trim()) {
      setError('Office is required.');
      return;
    }
    if (!officeHead.trim()) {
      setError('Office Head is required.');
      return;
    }
    if (!emailAddress.trim() || !validateEmail(emailAddress)) {
      setError('Valid email address is required.');
      return;
    }
    if (!role.trim()) {
      setError('Role is required.');
      return;
    }
    if (!/^[A-Z]+$/.test(role)) {
      setError('Division must be in all uppercase letters (e.g., LSD).');
      return;
    }
    if (!username.trim() || !validateUsername(username)) {
      setError('Username is required and can only contain alphanumeric characters, underscores, or hyphens.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (!validatePassword(password)) {
      setError('Password must be 10 characters max, include at least one uppercase letter, and one special character (!@#$%^&*(),.?":{}|<>).');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const { error: supabaseError } = await supabase
        .from('registration_pending')
        .insert({
          name: name.trim(),
          office: office.trim(),
          office_head: officeHead.trim(),
          email_address: emailAddress.trim().toLowerCase(),
          role: role.trim(),
          username: username.trim(),
          password,
        });

      if (supabaseError) {
        if (supabaseError.message.includes('duplicate key value')) {
          setError('Username or email address is already in use.');
        } else {
          setError('Error submitting registration: ' + supabaseError.message);
        }
        return;
      }

      toast.success('Registration submitted successfully! Awaiting admin approval.', { duration: 3000 });
      setName('');
      setOffice('');
      setOfficeHead('');
      setEmailAddress('');
      setRole('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F5] flex flex-col items-center p-4 sm:p-6">
      <Toaster position="top-right" />
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
        onSubmit={handleRegistration}
        className="bg-white rounded-lg shadow-lg p-6 sm:p-8 w-full max-w-md mt-8 sm:mt-16"
        aria-label="Registration Form"
      >
        <h2 className="text-xl sm:text-2xl font-bold text-[#003087] mb-6 font-['Poppins'] text-center">
          Register for Digitization Project
        </h2>
        {error && (
          <p className="text-xs text-[#C1272D] mb-4 text-center">{error}</p>
        )}
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block mb-1 text-sm font-medium text-[#003087]">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="office" className="block mb-1 text-sm font-medium text-[#003087]">
              Office
            </label>
            <input
              type="text"
              id="office"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={office}
              onChange={(e) => setOffice(e.target.value)}
              placeholder="Enter your office"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="officeHead" className="block mb-1 text-sm font-medium text-[#003087]">
              Office Head
            </label>
            <input
              type="text"
              id="officeHead"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={officeHead}
              onChange={(e) => setOfficeHead(e.target.value)}
              placeholder="Enter office head's name"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="emailAddress" className="block mb-1 text-sm font-medium text-[#003087]">
              Email Address
            </label>
            <input
              type="email"
              id="emailAddress"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="Enter your email address"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="role" className="block mb-1 text-sm font-medium text-[#003087]">
              Division in (Upper Case)
            </label>
            <input
              type="text"
              id="role"
              required
              className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400 ${error && error.includes('Division') ? 'border-[#C1272D] text-[#C1272D]' : 'border-gray-300'}`}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Enter your division (eg., LSD)"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="username" className="block mb-1 text-sm font-medium text-[#003087]">
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
            />
          </div>
          <div className="relative">
            <label htmlFor="password" className="block mb-1 text-sm font-medium text-[#003087]">
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
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-9 text-[#003087] hover:text-[#002060] focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block mb-1 text-sm font-medium text-[#003087]">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="confirmPassword"
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#003087] transition-colors text-[#003087] text-sm sm:text-base placeholder-gray-400"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              aria-required="true"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full py-2 mt-6 bg-[#003087] text-white rounded hover:bg-[#002060] transition-colors font-medium text-sm sm:text-base"
          aria-label="Submit registration"
        >
          Submit Registration
        </button>
        <p className="text-center text-sm text-[#003087] mt-4">
          Already have an account?{' '}
          <Link href="/" className="font-medium hover:text-[#002060] underline">
            Login here
          </Link>
        </p>
      </form>
      <footer className="mt-8 text-sm text-gray-600">
        All Rights Reserved by CSC R06 2025
      </footer>
    </div>
  );
}
