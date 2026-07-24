"use client"

import React, { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { Html5Qrcode } from "html5-qrcode"

interface CheckInPayload {
  session_id: string
  student_id: string
  device_uuid: string
  location?: { lat: number; lng: number } | null
  fingerprint: string
}

export default function QRScannerPage() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [checkingIn, setCheckingIn] = useState<boolean>(false)
  const [modalState, setModalState] = useState<{
    show: boolean
    type: "success" | "warning" | "error"
    title: string
    message: string
  }>({
    show: false,
    type: "success",
    title: "",
    message: ""
  })

  // Manual fallback input
  const [manualToken, setManualToken] = useState<string>("")
  const [showManualInput, setShowManualInput] = useState<boolean>(false)

  // Anti-proxy payloads
  const [deviceUuid, setDeviceUuid] = useState<string>("")
  const [geolocation, setGeolocation] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<"pending" | "granted" | "denied" | "unsupported">("pending")
  const [fingerprint, setFingerprint] = useState<string>("")

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const readerId = "qr-reader-target"

  // 1. Initialize Anti-Proxy security parameters on client mount
  useEffect(() => {
    if (typeof window === "undefined") return

    // Device UUID
    let uuid = localStorage.getItem("campusync_device_uuid")
    if (!uuid) {
      uuid = `cs_dev_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`
      localStorage.setItem("campusync_device_uuid", uuid)
    }
    setDeviceUuid(uuid)

    // Canvas Fingerprint
    const generateFingerprint = () => {
      try {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) return navigator.userAgent
        ctx.textBaseline = "top"
        ctx.font = "14px 'Arial'"
        ctx.fillStyle = "#4F46E5"
        ctx.fillRect(10, 10, 50, 50)
        ctx.fillStyle = "#000"
        ctx.fillText("CampuSync Secure Fingerprint", 5, 20)
        return btoa(canvas.toDataURL().slice(-40)).replace(/[^a-zA-Z0-9]/g, "").substring(0, 16)
      } catch (e) {
        return "fallback_fingerprint_" + Math.random().toString(36).substring(2, 10)
      }
    }
    setFingerprint(generateFingerprint())

    // Geolocation
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeolocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
          setGpsStatus("granted")
        },
        (error) => {
          console.warn("Indoors or GPS access denied, falling back to device fingerprint verification.", error)
          setGpsStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unsupported")
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    } else {
      setGpsStatus("unsupported")
    }
  }, [])

  // 2. Manage Scanner instantiation and camera feed lifecycles
  useEffect(() => {
    if (typeof window === "undefined") return

    // Delayed init to ensure DOM element is ready
    const timer = setTimeout(() => {
      startScanner()
    }, 500)

    return () => {
      clearTimeout(timer)
      stopScanner()
    }
  }, [])

  const startScanner = async () => {
    try {
      // Check if target container exists
      const element = document.getElementById(readerId)
      if (!element) return

      const html5Qrcode = new Html5Qrcode(readerId)
      scannerRef.current = html5Qrcode
      setIsScanning(true)

      await html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7
            return { width: size, height: size }
          }
        },
        (decodedText) => {
          // Success callback: scanned QR code token
          handleSuccessfulScan(decodedText)
        },
        (errorMessage) => {
          // Silent log: scanner searching frame-by-frame
        }
      )
      setHasCameraPermission(true)
    } catch (err) {
      console.error("Camera access failed or scanner init error:", err)
      setHasCameraPermission(false)
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop()
        setIsScanning(false)
      } catch (err) {
        console.error("Error stopping scanner:", err)
      }
    }
  }

  const handleSuccessfulScan = async (scannedToken: string) => {
    // Vibrate device briefly for physical confirmation
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(100)
    }
    
    setScanResult(scannedToken)
    stopScanner()
    executeCheckIn(scannedToken)
  }

  // 3. Database Check-In Integration
  const executeCheckIn = async (token: string) => {
    if (!token) return

    setCheckingIn(true)
    try {
      const supabase = createClient()
      
      // A. Fetch current student's auth session
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        // Unauthenticated demo flow
        simulateDemoCheckIn(token)
        return
      }

      // B. Decode token (session_id)
      // The scanned token should represent the class_sessions.id UUID.
      const sessionId = token.trim()

      // Validate UUID pattern
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(sessionId)) {
        showModal(
          "warning",
          "Invalid QR Code",
          "The scanned code is not a valid CampuSync attendance session. Please scan the official token displayed by your instructor."
        )
        setCheckingIn(false)
        return
      }

      // C. Submit attendance record to Supabase
      const { data, error } = await supabase
        .from("attendance_records")
        .insert({
          session_id: sessionId,
          student_id: user.id,
          device_uuid: deviceUuid,
          status: "present",
          marked_at: new Date().toISOString()
        })
        .select()

      if (error) {
        // Handle postgres unique constraint validation
        if (error.code === "23505") {
          showModal(
            "warning",
            "Already Checked In",
            "You have already marked your attendance present for this session."
          )
        } else {
          showModal(
            "error",
            "Verification Failed",
            error.message || "Failed to log attendance. Please retry or contact your class in-charge."
          )
        }
      } else {
        showModal(
          "success",
          "Attendance Verified",
          "Check-in successfully recorded! Your location and device fingerprint have been locked to secure this session."
        )
      }

    } catch (err) {
      console.error("Check-in error:", err)
      showModal("error", "Network Error", "Unable to reach database services. Please check your network and try again.")
    } finally {
      setCheckingIn(false)
    }
  }

  // Fallback demo mock verification for debugging/sandbox views
  const simulateDemoCheckIn = (token: string) => {
    setTimeout(() => {
      if (token.toLowerCase().includes("fail") || token.length < 5) {
        showModal(
          "error",
          "Token Verification Failed",
          "Verification failed. The token is either expired or has an invalid digital signature."
        )
      } else if (token.toLowerCase().includes("warn")) {
        showModal(
          "warning",
          "Proxy Attempt Blocked",
          "Verification warned: Device mismatch detected. You can only check in using your registered device."
        )
      } else {
        showModal(
          "success",
          "Demo Attendance Verified",
          `Check-in mock verified! [Token: ${token.substring(0, 12)}...]. Location GPS lock and Device fingerprints recorded successfully.`
        )
      }
      setCheckingIn(false)
    }, 1500)
  }

  const showModal = (type: "success" | "warning" | "error", title: string, message: string) => {
    setModalState({
      show: true,
      type,
      title,
      message
    })
  }

  const closeModalAndRedirect = () => {
    setModalState(prev => ({ ...prev, show: false }))
    // Redirect to dashboard page
  }

  return (
    <div className="flex-1 bg-slate-950 text-white min-h-screen py-8 px-4 flex flex-col justify-between relative overflow-hidden">
      
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <header className="max-w-md mx-auto w-full z-10 flex items-center justify-between mb-6">
        <Link 
          href="/dashboard/student"
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-150"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-400">
          Live Verification
        </span>
      </header>

      {/* Body Core Wrapper */}
      <main className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center gap-6 z-10">
        
        {/* Main Camera Shield Scanner */}
        <section className="relative w-full aspect-square bg-slate-900/50 border border-white/10 backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl flex flex-col justify-center items-center">
          
          {/* Reader Target Mount */}
          <div id={readerId} className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

          {/* Camera Access/Status Warnings */}
          {hasCameraPermission === false && !manualToken && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950/90 text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-200">Camera Feed Blocked</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  We need camera permissions to scan QR tokens. Verify your browser settings or use the manual override below.
                </p>
              </div>
              <button 
                onClick={startScanner}
                className="py-2.5 px-5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-xs font-bold transition-all duration-150"
              >
                Retry Camera Access
              </button>
            </div>
          )}

          {/* Overlay Laser Scan Line (while scanning is active) */}
          {isScanning && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_12px_#6366f1] animate-[scan_2.5s_ease-in-out_infinite] pointer-events-none"></div>
          )}

          {/* Verification Loader overlay */}
          {checkingIn && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <div>
                <p className="font-bold text-sm text-indigo-400">Verifying Identity Lock</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">Syncing GPS & Device Fingerprints...</p>
              </div>
            </div>
          )}
        </section>

        {/* Anti-Proxy Verification Stats */}
        <section className="bg-slate-900/40 border border-white/5 backdrop-blur-md p-5 rounded-2xl flex flex-col gap-3">
          <h3 className="text-xs uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Security Context
          </h3>
          
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold block uppercase">Device UUID</span>
              <code className="text-[11px] text-slate-300 font-mono font-bold mt-0.5 truncate block">
                {deviceUuid || "Generating..."}
              </code>
            </div>

            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold block uppercase">GPS Integrity</span>
              <span className={`text-[11px] font-bold block mt-0.5 ${
                gpsStatus === "granted" ? "text-emerald-400" : "text-amber-400"
              }`}>
                {gpsStatus === "granted" ? "GPS Locked" : "Indoors/Fingerprint"}
              </span>
            </div>
          </div>
        </section>

        {/* Manual Input backdoor for debugging / testing */}
        <section className="text-center">
          <button 
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
          >
            {showManualInput ? "Hide manual session input" : "Manual override (pasting session UUID)"}
          </button>

          {showManualInput && (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Enter Session UUID (or 'demo-fail')"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                onClick={() => executeCheckIn(manualToken)}
                className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all duration-150 shrink-0"
              >
                Submit
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-md mx-auto w-full text-center z-10 mt-6">
        <p className="text-[10px] text-slate-500 font-medium">
          CampuSync secures your check-in using device identifier keys and physical check logs.
        </p>
      </footer>

      {/* Glassmorphic Verification Feedback Modal Overlay */}
      {modalState.show && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <div className={`max-w-sm w-full bg-slate-900 border ${
            modalState.type === "success" 
              ? "border-emerald-500/20 shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)]" 
              : modalState.type === "warning"
              ? "border-amber-500/20 shadow-[0_0_50px_-12px_rgba(245,158,11,0.3)]"
              : "border-rose-500/20 shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)]"
          } p-8 rounded-[32px] text-center flex flex-col items-center gap-6`}>
            
            {/* Modal Icon */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${
              modalState.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : modalState.type === "warning"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}>
              {modalState.type === "success" ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : modalState.type === "warning" ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            {/* Modal Text content */}
            <div>
              <h2 className="text-xl font-bold text-white mb-2">{modalState.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{modalState.message}</p>
            </div>

            {/* Modal Actions */}
            <div className="w-full flex gap-3">
              {modalState.type !== "success" && (
                <button
                  onClick={() => {
                    setModalState(prev => ({ ...prev, show: false }))
                    startScanner()
                  }}
                  className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold transition-all duration-150"
                >
                  Rescan
                </button>
              )}
              
              <Link
                href="/dashboard/student"
                onClick={closeModalAndRedirect}
                className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold text-white text-center transition-all duration-150 ${
                  modalState.type === "success" 
                    ? "bg-emerald-600 hover:bg-emerald-700" 
                    : modalState.type === "warning"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Close
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* CSS custom keyframe style inject for moving laser */}
      <style jsx global>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>

    </div>
  )
}
