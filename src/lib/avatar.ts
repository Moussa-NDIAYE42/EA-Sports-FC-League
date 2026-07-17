import { supabase } from '@/lib/supabase'

export const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2 Mo, doit rester cohérent avec le bucket Storage
export const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Format non supporté. Utilise PNG, JPEG ou WebP.'
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return 'Image trop lourde (2 Mo maximum).'
  }
  return null
}

/**
 * Upload l'avatar dans le dossier propre à l'utilisateur (policies RLS
 * Storage : un membre ne peut écrire que dans "<son_id>/…"), puis met à
 * jour profiles.avatar_url avec l'URL publique + un paramètre de cache-bust
 * pour que l'image se rafraîchisse partout immédiatement.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600' })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)
  if (updateError) throw updateError

  return publicUrl
}

export async function removeAvatar(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
  if (error) throw error
}
