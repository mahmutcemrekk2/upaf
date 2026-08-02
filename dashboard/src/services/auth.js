import { supabase } from '../lib/supabase'

const PUBLIC_EMAIL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'
]

export const authService = {
  // Validate if it's a work email
  isWorkEmail(email) {
    const domain = email.split('@')[1]?.toLowerCase()
    return domain && !PUBLIC_EMAIL_PROVIDERS.includes(domain)
  },

  async signUp(email, password) {
    if (!this.isWorkEmail(email)) {
      throw new Error('Please use your work email address (non-public provider).')
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          is_free: true,
          trial_start: new Date().toISOString()
        }
      }
    })
    if (error) throw error
    return data
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error

    // Başarılı girişten sonra profil tablosundaki son giriş tarihini güncelle
    await supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id)

    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }
}
