"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"

// Types matching our database schema
interface Course {
  id: string
  course_code: string
  course_name: string
}

interface Enrollment {
  id: string
  course_id: string
  courses: Course
}

interface AttendanceRecord {
  id: string
  session_id: string
  status: "present" | "absent" | "late" | "excused"
  marked_at: string
  class_sessions: {
    id: string
    course_id: string
    courses: Course
  }
}

interface StudentProfile {
  id: string
  full_name: string
  email: string
  role: string
  device_uuid?: string
}

// Fallback high-fidelity mock data for Demo Mode
const MOCK_PROFILE: StudentProfile = {
  id: "demo-student-id",
  full_name: "Santhosh Kumar",
  email: "happyworks08@gmail.com",
  role: "student",
  device_uuid: "uuid-9876-demo-device"
}

const MOCK_COURSES: Course[] = [
  { id: "c1", course_code: "CS301", course_name: "Database Management Systems" },
  { id: "c2", course_code: "CS302", course_name: "Design & Analysis of Algorithms" },
  { id: "c3", course_code: "CS303", course_name: "Computer Networks" },
  { id: "c4", course_code: "CS304", course_name: "Software Engineering" },
  { id: "c5", course_code: "CS305", course_name: "Artificial Intelligence" }
]

const MOCK_ATTENDANCE: AttendanceRecord[] = [
  {
    id: "a1",
    session_id: "s1",
    status: "present",
    marked_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    class_sessions: { id: "s1", course_id: "c1", courses: MOCK_COURSES[0] }
  },
  {
    id: "a2",
    session_id: "s2",
    status: "present",
    marked_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    class_sessions: { id: "s2", course_id: "c2", courses: MOCK_COURSES[1] }
  },
  {
    id: "a3",
    session_id: "s3",
    status: "late",
    marked_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    class_sessions: { id: "s3", course_id: "c3", courses: MOCK_COURSES[2] }
  },
  {
    id: "a4",
    session_id: "s4",
    status: "present",
    marked_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    class_sessions: { id: "s4", course_id: "c4", courses: MOCK_COURSES[3] }
  },
  {
    id: "a5",
    session_id: "s5",
    status: "absent",
    marked_at: new Date(Date.now() - 3600000 * 96).toISOString(),
    class_sessions: { id: "s5", course_id: "c1", courses: MOCK_COURSES[0] }
  },
  {
    id: "a6",
    session_id: "s6",
    status: "present",
    marked_at: new Date(Date.now() - 3600000 * 120).toISOString(),
    class_sessions: { id: "s6", course_id: "c5", courses: MOCK_COURSES[4] }
  },
  {
    id: "a7",
    session_id: "s7",
    status: "excused",
    marked_at: new Date(Date.now() - 3600000 * 144).toISOString(),
    class_sessions: { id: "s7", course_id: "c2", courses: MOCK_COURSES[1] }
  }
]

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])

  // Overall calculations
  const [overallAttendance, setOverallAttendance] = useState(0)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const supabase = createClient()
        
        // 1. Get current auth user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          console.log("No authenticated user session, loading high-fidelity demo mode.")
          loadDemoData()
          return
        }

        // 2. Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError || !profileData) {
          console.warn("Profile not found, using demo mode.")
          loadDemoData()
          return
        }

        setProfile(profileData)

        // 3. Fetch course enrollments
        const { data: enrollmentsData, error: enrollError } = await supabase
          .from("enrollments")
          .select(`
            id,
            course_id,
            courses (
              id,
              course_code,
              course_name
            )
          `)
          .eq("student_id", user.id)

        // 4. Fetch attendance records
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("attendance_records")
          .select(`
            id,
            session_id,
            status,
            marked_at,
            class_sessions (
              id,
              course_id,
              courses (
                id,
                course_code,
                course_name
              )
            )
          `)
          .eq("student_id", user.id)

        const activeCourses = enrollmentsData 
          ? (enrollmentsData.map(e => e.courses).filter(Boolean) as unknown as Course[])
          : []
        
        const activeAttendance = attendanceData
          ? (attendanceData as unknown as AttendanceRecord[])
          : []

        setCourses(activeCourses)
        setAttendance(activeAttendance)
        setIsDemoMode(false)

        // Calculate attendance rate
        // In a real app we would compute (Present + Late + Excused) / Total class sessions
        // For dynamic display if records are empty, default to 100% or calculate:
        if (activeAttendance.length > 0) {
          const positiveAttendance = activeAttendance.filter(
            r => r.status === "present" || r.status === "late" || r.status === "excused"
          ).length
          const rate = Math.round((positiveAttendance / activeAttendance.length) * 100)
          setOverallAttendance(rate)
        } else {
          setOverallAttendance(100)
        }

      } catch (err) {
        console.error("Error fetching database records, falling back to demo mode:", err)
        loadDemoData()
      } finally {
        setLoading(false)
      }
    }

    function loadDemoData() {
      setIsDemoMode(true)
      setProfile(MOCK_PROFILE)
      setCourses(MOCK_COURSES)
      setAttendance(MOCK_ATTENDANCE)
      
      // Calculate from mock data
      const positiveCount = MOCK_ATTENDANCE.filter(
        r => r.status === "present" || r.status === "late" || r.status === "excused"
      ).length
      const rate = Math.round((positiveCount / MOCK_ATTENDANCE.length) * 100)
      // Hardcode to a typical 88% visual benchmark for gorgeous shield presentation
      setOverallAttendance(88)
    }

    loadDashboardData()
  }, [])

  // Calculate stats for specific courses
  const getCourseAttendanceStats = (courseId: string) => {
    const courseRecords = attendance.filter(r => r.class_sessions?.course_id === courseId)
    if (courseRecords.length === 0) return { percentage: 100, present: 0, total: 0 }
    
    const present = courseRecords.filter(
      r => r.status === "present" || r.status === "late" || r.status === "excused"
    ).length
    const percentage = Math.round((present / courseRecords.length) * 100)
    return { percentage, present, total: courseRecords.length }
  }

  // Safety Shield Color Tier Rules
  const getShieldColors = (percentage: number) => {
    if (percentage >= 85) {
      return {
        stroke: "stroke-emerald-500",
        text: "text-emerald-600",
        bg: "bg-emerald-50/50 border-emerald-100",
        ringBg: "stroke-emerald-100",
        glow: "shadow-emerald-100/50",
        label: "Secure Status",
        desc: "You are safely above the 75% attendance criteria."
      }
    } else if (percentage >= 75) {
      return {
        stroke: "stroke-amber-500",
        text: "text-amber-600",
        bg: "bg-amber-50/50 border-amber-100",
        ringBg: "stroke-amber-100",
        glow: "shadow-amber-100/50",
        label: "Warning Status",
        desc: "Close to the threshold. Attend the next few lectures."
      }
    } else {
      return {
        stroke: "stroke-rose-500",
        text: "text-rose-600",
        bg: "bg-rose-50/50 border-rose-100",
        ringBg: "stroke-rose-100",
        glow: "shadow-rose-100/50",
        label: "Critical Status",
        desc: "Attendance is critically low. Subject debarment risk!"
      }
    }
  }

  const shieldConfig = getShieldColors(overallAttendance)

  // Circular gauge drawing variables
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (overallAttendance / 100) * circumference

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Securing connection to CampuSync...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-slate-50/80 text-slate-800 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Header Navigation */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Student Dashboard
            </span>
            {isDemoMode && (
              <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                Demo Session
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, <span className="text-indigo-600">{profile?.full_name}</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage your courses, view live statistics, and check-in to classes.
          </p>
        </div>

        {/* Quick Profile/Status Bar */}
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
            {profile?.full_name?.charAt(0)}
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-800 leading-none">{profile?.full_name}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{profile?.email}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Safety Shield & Core Actions */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Safety Shield Circular Progress Gauge */}
          <section className={`bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-xl rounded-3xl p-6 flex flex-col items-center justify-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5`}>
            <h2 className="text-lg font-bold text-slate-900 mb-6 text-center self-start flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Attendance Safety Shield
            </h2>

            {/* Circular Gauge Visual */}
            <div className="relative w-44 h-44 flex items-center justify-center mb-6">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  className={`${shieldConfig.ringBg} stroke-[12]`}
                  fill="transparent"
                />
                {/* Animated Foreground Ring */}
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  className={`${shieldConfig.stroke} stroke-[12] transition-all duration-1000 ease-out`}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              
              {/* Inner Label */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  {overallAttendance}%
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                  Overall Rate
                </span>
              </div>
            </div>

            {/* Status Information Box */}
            <div className={`w-full p-4 border rounded-2xl ${shieldConfig.bg} text-center flex flex-col gap-1 transition-all duration-300`}>
              <span className={`text-sm font-bold ${shieldConfig.text}`}>
                {shieldConfig.label}
              </span>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {shieldConfig.desc}
              </p>
            </div>
          </section>

          {/* Quick Action Button: SCAN QR CODE */}
          <section className="bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-xl rounded-3xl p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Attendance Check-In
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Verify your attendance instantly. Prepare to capture a quick selfie and verify secure Wi-Fi details.
            </p>
            <Link 
              href="/dashboard/student/scan"
              className="group relative flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 overflow-hidden"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-violet-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              
              <svg className="w-5 h-5 relative z-10 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1M18 8h2M6 8H4M12 12h.01M19 12h-2m-4.01 4H12m-8 0h4m-3 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="relative z-10 uppercase">Scan QR Code</span>
            </Link>
          </section>

        </div>

        {/* Right Columns: Courses & Recent logs */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Section: Enrolled Courses List */}
          <section className="bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-xl rounded-3xl p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <svg className="w-5.5 h-5.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Enrolled Courses ({courses.length})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {courses.map((course) => {
                const stats = getCourseAttendanceStats(course.id)
                let pctColor = "text-emerald-600 bg-emerald-50 border-emerald-100"
                let barColor = "bg-emerald-500"
                
                if (stats.percentage < 75) {
                  pctColor = "text-rose-600 bg-rose-50 border-rose-100"
                  barColor = "bg-rose-500"
                } else if (stats.percentage < 85) {
                  pctColor = "text-amber-600 bg-amber-50 border-amber-100"
                  barColor = "bg-amber-500"
                }

                return (
                  <div key={course.id} className="p-5 bg-white border border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300/60 transition-all duration-200 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-xs font-bold font-mono tracking-wide px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {course.course_code}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${pctColor}`}>
                          {stats.percentage}%
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 min-h-[2.5rem] mb-4">
                        {course.course_name}
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase">
                        <span>Sessions attended</span>
                        <span>{stats.present} / {stats.total}</span>
                      </div>
                      
                      {/* Attendance Horizontal Progress Bar */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${barColor} transition-all duration-500`}
                          style={{ width: `${stats.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Section: Recent Attendance Logs */}
          <section className="bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-xl rounded-3xl p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <svg className="w-5.5 h-5.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recent Attendance History
            </h2>

            <div className="space-y-3.5">
              {attendance.map((record) => {
                let badgeStyle = "text-slate-600 bg-slate-100 border-slate-200"
                if (record.status === "present") badgeStyle = "text-emerald-700 bg-emerald-50 border-emerald-100/80"
                else if (record.status === "absent") badgeStyle = "text-rose-700 bg-rose-50 border-rose-100/80"
                else if (record.status === "late") badgeStyle = "text-amber-700 bg-amber-50 border-amber-100/80"
                else if (record.status === "excused") badgeStyle = "text-blue-700 bg-blue-50 border-blue-100/80"

                return (
                  <div key={record.id} className="p-4 bg-white/60 border border-slate-200/40 rounded-2xl flex justify-between items-center hover:bg-white transition-all duration-150">
                    <div className="flex items-center gap-3">
                      {/* Course Identity Symbol */}
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col items-center justify-center text-slate-400 font-bold text-xs uppercase">
                        {record.class_sessions?.courses?.course_code?.slice(0, 2)}
                      </div>
                      
                      <div className="text-left">
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">
                          {record.class_sessions?.courses?.course_name || "General Course"}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          {new Date(record.marked_at).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                    </div>

                    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${badgeStyle}`}>
                      {record.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
