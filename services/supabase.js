// services/supabase.js

// -----------------------------------------------------------------
// TODO: Add your Supabase URL and Anon Key here
// -----------------------------------------------------------------
const SUPABASE_URL = 'https://eidagqlezomywsjvdqvu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpZGFncWxlem9teXdzanZkcXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjAxMTQsImV4cCI6MjA3NTk5NjExNH0.r4XLwZeSjWqM-CBFD7IT0-uQpzUVt72s2rHnmxSBlNA';
// -----------------------------------------------------------------

let client;
try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Supabase URL and Anon Key are required. Please update services/supabase.js");
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Supabase client failed to initialize.", e.message);
    alert(`Error: Could not connect to the backend. ${e.message}`);
}


export const supabase = client;
