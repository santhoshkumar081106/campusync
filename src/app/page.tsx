import React from "react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="flex-1 bg-slate-900 text-white min-h-screen flex flex-col justify-between relative overflow-hidden font-sans">
      
      {/* Background radial glow accents */}
      <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none"></div>

      {/* Top Navigation */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-600/20">
            C
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            CampuSync
          </span>
        </div>
        
        <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          SaaS V1.0 Active
        </span>
      </header>

      {/* Main Showcase Hero */}
      <main className="max-w-4xl mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-center items-center text-center z-10">
        <div className="max-w-2xl flex flex-col gap-6 items-center">
          <span className="text-xs uppercase tracking-widest font-extrabold px-3 py-1 bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 rounded-full animate-pulse">
            Next-Gen Attendance Integrity
          </span>
          
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]">
            Seamless, Anti-Proxy <br />
            <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
              Campus Attendance
            </span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-lg mt-2">
            Secure, feather-light QR check-ins backed by device hardware locking and geolocation parameters.
          </p>
        </div>

        {/* Access Dashboard Portal Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl mt-12">
          
          {/* Card 1: Student Dashboard */}
          <Link 
            href="/dashboard/student"
            className="group p-6 bg-white/[0.03] border border-white/10 rounded-3xl text-left hover:bg-white/[0.06] hover:border-white/20 hover:shadow-2xl hover:shadow-indigo-600/5 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform duration-200 mb-5">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-1">
              Student Dashboard
              <svg className="w-4 h-4 text-indigo-400 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              View your real-time attendance rate, course safety indicators, and recent verification history log.
            </p>
          </Link>

          {/* Card 2: QR Scanner */}
          <Link 
            href="/dashboard/student/scan"
            className="group p-6 bg-white/[0.03] border border-white/10 rounded-3xl text-left hover:bg-white/[0.06] hover:border-white/20 hover:shadow-2xl hover:shadow-violet-600/5 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform duration-200 mb-5">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-1">
              QR Code Scanner
              <svg className="w-4 h-4 text-violet-400 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Scan dynamic classroom QR tokens. Fast verification with device hardware keys and geofencing.
            </p>
          </Link>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 py-8 text-center z-10 border-t border-white/5">
        <p className="text-[11px] text-slate-500 font-medium">
          CampuSync Secure Attendance Verification. Powered by Next.js and Supabase Postgres database.
        </p>
      </footer>

    </div>
  )
}
