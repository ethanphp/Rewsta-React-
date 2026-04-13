import * as SecureStore from 'expo-secure-store'

const SESSION_KEY = 'supabase_session'

export async function saveSession(session: any) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session))
}

export async function getSession() {
  const session = await SecureStore.getItemAsync(SESSION_KEY)
  return session ? JSON.parse(session) : null
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY)
}