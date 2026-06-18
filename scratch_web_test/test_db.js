require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabase() {
  console.log('--- TEST DE LA BASE DE DONNÉES SUPABASE ---');
  
  // 1. Test de lecture (Select) sur la table 'users'
  console.log('Tentative de lecture de la table "users"...');
  const { data: readData, error: readError } = await supabase.from('users').select('*').limit(1);
  
  if (readError) {
    console.error('❌ ERREUR DE LECTURE :', readError.message);
    if (readError.code === '42P01') {
      console.error('La table "users" n\'existe pas dans Supabase !');
    }
  } else {
    console.log('✅ Lecture réussie. Données :', readData);
  }

  // 2. Test d'insertion (Insert) sur la table 'users'
  console.log('\nTentative d\'insertion d\'un faux profil dans "users"...');
  const dummyId = '00000000-0000-0000-0000-000000000000';
  const { data: insertData, error: insertError } = await supabase.from('users').insert([{
    id: dummyId,
    role: 'driver',
    first_name: 'Test',
    last_name: 'Driver'
  }]);

  if (insertError) {
    console.error('❌ ERREUR D\'INSERTION :', insertError.message);
    if (insertError.message.includes('row-level security') || insertError.code === '42501') {
      console.error('C\'est un problème de sécurité (RLS) ! Vous devez configurer les Policies.');
    }
  } else {
    console.log('✅ Insertion réussie !');
    // Nettoyage
    await supabase.from('users').delete().eq('id', dummyId);
  }
}

testDatabase();
