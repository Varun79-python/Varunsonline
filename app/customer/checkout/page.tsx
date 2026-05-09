'use client'
import { Suspense } from 'react'
import CheckoutContent from './CheckoutContent'

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}><div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} /></div>}>
      <CheckoutContent />
    </Suspense>
  )
}
