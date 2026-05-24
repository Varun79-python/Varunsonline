'use client'
import { createClient } from '@/lib/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

export interface ExistingUserResult {
  exists: boolean
  userId?: string
  role?: 'shopkeeper' | 'delivery_agent' | 'customer' | 'admin'
  step1Completed?: boolean
  step2Completed?: boolean
  isApproved?: boolean
  isActive?: boolean
  profileData?: {
    full_name?: string
    phone?: string
    email?: string
    shop_name?: string
    vehicle_type?: string
    vehicle_number?: string
  }
  redirectTo?: string
  message?: string
}

export type UserRole = 'shopkeeper' | 'delivery_agent' | 'customer'

export async function checkExistingUser(
  phoneOrEmail: string,
  role: UserRole
): Promise<ExistingUserResult> {
  const supabase = createClient()
  const input = phoneOrEmail.trim()
  
  if (!input) {
    return { exists: false }
  }

  const isPhone = /^\d{10,}$/.test(input)
  const searchValue = isPhone ? input : input.toLowerCase()

  try {
    if (role === 'shopkeeper') {
      return await checkShopkeeper(supabase, searchValue, isPhone)
    } else if (role === 'delivery_agent') {
      return await checkDeliveryAgent(supabase, searchValue, isPhone)
    } else if (role === 'customer') {
      return await checkCustomer(supabase, searchValue, isPhone)
    }
  } catch (error) {
    console.error('Error checking existing user:', error)
  }

  return { exists: false }
}

async function checkShopkeeper(
  supabase: SupabaseClient,
  searchValue: string,
  isPhone: boolean
): Promise<ExistingUserResult> {
  const field = isPhone ? 'phone' : 'email'
  
  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, owner_id, name, phone, email, full_name, is_approved, is_active, shop_image_url')
    .eq(field, searchValue)
    .maybeSingle()

  if (error) {
    console.error('Error checking shop:', error)
    return { exists: false }
  }

  if (!shop) {
    return { exists: false }
  }

  const step1Completed = true
  const step2Completed = !!shop.shop_image_url
  const isApproved = shop.is_approved
  const isActive = shop.is_active

  if (isApproved && isActive) {
    return {
      exists: true,
      userId: shop.owner_id,
      role: 'shopkeeper',
      step1Completed: true,
      step2Completed: true,
      isApproved: true,
      isActive: true,
      profileData: {
        full_name: shop.full_name,
        phone: shop.phone,
        email: shop.email,
        shop_name: shop.name,
      },
      redirectTo: '/shopkeeper',
      message: 'Your shop is already approved! Redirecting to login...',
    }
  }

  if (step1Completed && !step2Completed) {
    return {
      exists: true,
      userId: shop.owner_id,
      role: 'shopkeeper',
      step1Completed: true,
      step2Completed: false,
      isApproved: false,
      isActive: false,
      profileData: {
        full_name: shop.full_name,
        phone: shop.phone,
        email: shop.email,
        shop_name: shop.name,
      },
      redirectTo: '/login/shopkeeper/register/documents',
      message: 'Existing registration found. Continuing to document upload...',
    }
  }

  return {
    exists: true,
    userId: shop.owner_id,
    role: 'shopkeeper',
    step1Completed: true,
    step2Completed: false,
    profileData: {
      full_name: shop.full_name,
      phone: shop.phone,
      email: shop.email,
      shop_name: shop.name,
    },
    redirectTo: '/login/shopkeeper/register/documents',
    message: 'Existing registration found. Continuing from saved progress.',
  }
}

async function checkDeliveryAgent(
  supabase: SupabaseClient,
  searchValue: string,
  isPhone: boolean
): Promise<ExistingUserResult> {
  const { data: agent, error } = await supabase
    .from('delivery_agents')
    .select('id, full_name, email, phone, vehicle_type, vehicle_number, is_approved, aadhar_url, license_url')
    .eq(isPhone ? 'phone' : 'email', searchValue)
    .maybeSingle()

  if (error) {
    console.error('Error checking delivery agent:', error)
    return { exists: false }
  }

  if (!agent) {
    return { exists: false }
  }

  const step1Completed = true
  const step2Completed = !!agent.aadhar_url && !!agent.license_url
  const isApproved = agent.is_approved

  if (isApproved) {
    return {
      exists: true,
      userId: agent.id,
      role: 'delivery_agent',
      step1Completed: true,
      step2Completed: true,
      isApproved: true,
      profileData: {
        full_name: agent.full_name,
        phone: agent.phone,
        email: agent.email,
        vehicle_type: agent.vehicle_type,
        vehicle_number: agent.vehicle_number,
      },
      redirectTo: '/delivery',
      message: 'Your account is already approved! Redirecting to dashboard...',
    }
  }

  if (step1Completed && !step2Completed) {
    return {
      exists: true,
      userId: agent.id,
      role: 'delivery_agent',
      step1Completed: true,
      step2Completed: false,
      isApproved: false,
      profileData: {
        full_name: agent.full_name,
        phone: agent.phone,
        email: agent.email,
        vehicle_type: agent.vehicle_type,
        vehicle_number: agent.vehicle_number,
      },
      redirectTo: '/login/delivery/register/documents',
      message: 'Existing registration found. Continuing to document upload...',
    }
  }

  return {
    exists: true,
    userId: agent.id,
    role: 'delivery_agent',
    step1Completed: true,
    step2Completed: false,
    profileData: {
      full_name: agent.full_name,
      phone: agent.phone,
      email: agent.email,
      vehicle_type: agent.vehicle_type,
      vehicle_number: agent.vehicle_number,
    },
    redirectTo: '/login/delivery/register/documents',
    message: 'Existing registration found. Continuing from saved progress.',
  }
}

async function checkCustomer(
  supabase: SupabaseClient,
  searchValue: string,
  isPhone: boolean
): Promise<ExistingUserResult> {
  // Customers details are in 'profiles' table with role='customer'
  const { data: customer, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, email, created_at')
    .eq(isPhone ? 'phone' : 'email', searchValue)
    .eq('role', 'customer')
    .maybeSingle()

  if (error) {
    console.error('Error checking customer:', error)
    return { exists: false }
  }

  if (!customer) {
    return { exists: false }
  }

  return {
    exists: true,
    userId: customer.id,
    role: 'customer',
    step1Completed: true,
    step2Completed: true,
    isApproved: true,
    isActive: true,
    profileData: {
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email,
    },
    redirectTo: '/customer',
    message: 'Account already exists. Redirecting to dashboard...',
  }
}

export async function handleExistingUserAuth(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password,
  })

  if (signInData?.user) {
    return { success: true, userId: signInData.user.id }
  }

  if (signInError) {
    if (signInError.message.includes('Invalid login') || signInError.message.includes('Invalid credentials')) {
      return { success: false, error: 'Account exists but password is incorrect. Please reset your password.' }
    }
    return { success: false, error: signInError.message }
  }

  return { success: false, error: 'Failed to sign in' }
}