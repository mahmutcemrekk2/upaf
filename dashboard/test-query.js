import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://svxujbjbictgsljtkyoi.supabase.co';
const supabaseKey = 'sb_publishable_3Il6B9-lM6YG3CmvR4GIZQ_lT9Pjd_t';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('run_sql', {
    sql: 'ALTER TABLE test_steps ADD COLUMN IF NOT EXISTS params text;'
  });
  console.log('Error:', error);
  console.log('Data:', data);
}
run();
