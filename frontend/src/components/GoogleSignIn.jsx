import { useEffect, useRef } from 'react'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function GoogleSignIn({ onCredential, disabled }) {
  const buttonRef = useRef(null)
  const callbackRef = useRef(onCredential)
  callbackRef.current = onCredential

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || disabled) return undefined

    const handleCredential = (response) => {
      if (response?.credential) callbackRef.current(response.credential)
    }

    const renderButton = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential
      })
      buttonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'rectangular'
      })
    }

    if (window.google?.accounts?.id) {
      renderButton()
      return undefined
    }

    const existing = document.getElementById('google-gsi-script')
    if (existing) {
      existing.addEventListener('load', renderButton)
      return () => existing.removeEventListener('load', renderButton)
    }

    const script = document.createElement('script')
    script.id = 'google-gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = renderButton
    document.body.appendChild(script)
    return undefined
  }, [disabled])

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="auth-hint">
        Google sign-in is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code>.
      </p>
    )
  }

  return <div className="google-btn-wrap" ref={buttonRef} />
}

export default GoogleSignIn
