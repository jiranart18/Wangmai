import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://rrcvjagvsixepvyopuuy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyY3ZqYWd2c2l4ZXB2eW9wdXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDM4MTksImV4cCI6MjA4ODM3OTgxOX0.A96E4dXZI2b_EX4CAbW84RI2mkotlqKHAN6FnST5wus';
//const supabaseUrl = 'https://kqdjyqmdmmjdyfrooobs.supabase.co'; 
//const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZGp5cW1kbW1qZHlmcm9vb2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTkwMzIsImV4cCI6MjA4NjAzNTAzMn0.vIBOf5pxcs7FINIPVxx-C0BDnB-evINt40_E1imjm9M';

// สร้างตัวเชื่อมต่อและส่งออกไปให้ไฟล์อื่นใช้
export const supabase = createClient(supabaseUrl, supabaseKey)