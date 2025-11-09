import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('Testing Supabase connection...')
console.log('URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseKey)

// Test connection and check tables
async function testConnection() {
  try {
    // Test tokens table
    const { data: tokens, error: tokensError } = await supabase
      .from('tokens')
      .select('*')
      .limit(5)

    if (tokensError) {
      console.error('❌ Error fetching tokens:', tokensError.message)
    } else {
      console.log('✅ Tokens table exists. Found', tokens.length, 'tokens')
      if (tokens.length > 0) {
        console.log('Sample token:', tokens[0].name)
      }
    }

    // Test users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5)

    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message)
    } else {
      console.log('✅ Users table exists. Found', users.length, 'users')
    }

    // Test transactions table
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .limit(5)

    if (transactionsError) {
      console.error('❌ Error fetching transactions:', transactionsError.message)
    } else {
      console.log('✅ Transactions table exists. Found', transactions.length, 'transactions')
    }

  } catch (error) {
    console.error('❌ Connection error:', error.message)
  }
}

testConnection()
