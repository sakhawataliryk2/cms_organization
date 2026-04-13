"use client"
import { useEffect } from 'react';
import { useRouter } from 'nextjs-toploader/app'; // Changed from next/router to nextjs-toploader/app

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, [router]); // Added router to the dependency array

  return null;
}