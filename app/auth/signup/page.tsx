'use client'
import Image from "next/image";
import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";

export default function Signup() {
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
    const [userType, setUserType] = useState<string>("candidate");
    const [name, setName] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [confirmPassword, setConfirmPassword] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [success, setSuccess] = useState<string>("");

    const router = useRouter();

    const validateForm = (): boolean => {
        // Reset error
        setError("");

        // Check if all fields are filled
        if (!name || !email || !password || !confirmPassword) {
            setError("All fields are required");
            return false;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Invalid email format");
            return false;
        }

        // Validate password strength
        if (password.length < 8) {
            setError("Password must be at least 8 characters long");
            return false;
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Validate form
        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            // Changed: Use the Next.js API route for signup instead of directly calling the backend
            const response = await fetch(`${process.env.API_BASE_URL || 'https://ats-software-backend.vercel.app'}/api/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    userType
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }

            // Registration successful
            setSuccess("Account created successfully! Redirecting to login...");

            // Clear form
            setName("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");

            // Redirect after a short delay
            setTimeout(() => {
                router.push('/auth/login?registered=true');
            }, 2000);

        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen">
            {/* Blue sidebar */}
            <div className="w-60 bg-blue-500">

            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 py-8 overflow-y-auto">
                <div className="w-full max-w-md">
                    {/* Logo */}
                    <div className="flex justify-center mb-8">
                        <Image
                            src="https://completestaffingsolutions.com/wp-content/themes/completestaffing/images/logo.svg"
                            alt="Complete Staffing Solutions Logo"
                            width={250}
                            height={100}
                            priority
                        />
                    </div>

                    <h1 className="text-2xl font-bold text-center mb-6">Create an Account</h1>


                    {/* Error message */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                            {error}
                        </div>
                    )}

                    {/* Success message */}
                    {success && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" role="alert">
                            {success}
                        </div>
                    )}

                    {/* Signup Form */}
                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        {/* User Type Selection */}
                        <div className="mb-4">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                                {["candidate", "recruiter", "developer", "admin", "owner"].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        className={`px-3 py-2 text-sm rounded-md capitalize ${userType === type
                                            ? "bg-blue-500 text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            }`}
                                        onClick={() => setUserType(type)}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Name field */}
                        <div className="relative">
                            <div className="absolute left-3 top-3 text-blue-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Full Name"
                                className="w-full py-3 pl-10 pr-3 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Email field */}
                        <div className="relative">
                            <div className="absolute left-3 top-3 text-blue-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                            </div>
                            <input
                                type="email"
                                placeholder="Email address"
                                className="w-full py-3 pl-10 pr-3 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {/* Password field */}
                        <div className="relative">
                            <div className="absolute left-3 top-3 text-blue-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                className="w-full py-3 pl-10 pr-10 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-3 text-gray-500 hover:text-gray-700"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                        <line x1="1" y1="1" x2="23" y2="23"></line>
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Confirm Password field */}
                        <div className="relative">
                            <div className="absolute left-3 top-3 text-blue-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm Password"
                                className="w-full py-3 pl-10 pr-10 border-b border-gray-300 focus:outline-none focus:border-blue-500"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-3 text-gray-500 hover:text-gray-700"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                                {showConfirmPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                        <line x1="1" y1="1" x2="23" y2="23"></line>
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* Sign Up button */}
                        <button
                            type="submit"
                            className="w-full py-3 mt-6 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex justify-center items-center"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : "SIGN UP"}
                        </button>

                        {/* Login link */}
                        <div className="text-center mt-4">
                            <p className="text-sm text-gray-600">
                                Already have an account?{" "}
                                <Link href="/auth/login" className="text-blue-500 hover:underline">
                                    Log In
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}