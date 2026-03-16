import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://maanfpmdbkklfwdozzmi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hYW5mcG1kYmtrbGZ3ZG96em1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Njc4MTMsImV4cCI6MjA4OTA0MzgxM30.EywVL1GBvcH8fHgZbkYIN3dmwON3I0WRjIR1HoYyRpc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
