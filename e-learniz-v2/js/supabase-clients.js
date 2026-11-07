if (typeof window.supabaseClient === 'undefined') {

    const SUPABASE_URL = "https://vttmwtlqzbbiaromohrp.supabase.co";
    const SUPABASE_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dG13dGxxemJiaWFyb21vaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg4NTMsImV4cCI6MjA4MDg0NDg1M30.16SwOEqD5ZNAgk1oWhLrL41Eqw4kkeAKTyHxkSqmpiY";

    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}