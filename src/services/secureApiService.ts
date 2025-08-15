import { supabase } from './supabase' // Corrected import path

/**
 * Example of how to call a secure Supabase Edge Function.
 * This demonstrates the correct way to use the user's session token (JWT).
 */
export async function callMySecureEdgeFunction(payload: any) {
  // 1. Get the current session from the Supabase client.
  // The client library automatically handles refreshing the token if it's expired.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    console.error('Error getting session:', sessionError)
    throw new Error('Could not get user session')
  }

  if (!session) {
    // This means the user is not logged in.
    // You can handle this by redirecting to the login page or showing a message.
    throw new Error('User is not authenticated')
  }

  // 2. The `session.access_token` is the secure JWT. You don't even need to handle it manually
  // when using the Supabase client library. The `invoke` method will automatically
  // include the 'Authorization' header with the JWT.

  console.log('Calling Edge Function with a valid session...')

  // 3. Make the request to your Edge Function.
  const { data, error } = await supabase.functions.invoke('my-secure-function-name', {
    body: payload
  })

  if (error) {
    console.error('Edge Function error:', error)
    throw error
  }

  console.log('Edge Function returned:', data)
  return data
}